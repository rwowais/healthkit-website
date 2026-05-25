/**
 * engine.ts — the adaptive core.
 *
 * compileTimeline: installed packs → one de-duplicated, scheduled timeline
 * (intelligent merge of overlapping behaviors).
 *
 * adapt: ambient intelligence. Reads the *new* behavior model + a light
 * daily check-in, reshapes the day, and explains itself. Calm, never punishing.
 */
import type {
  AppState,
  BehaviorDef,
  BehaviorOverride,
  DailyLog,
  ProtocolPack,
  TimeBlock,
} from "./types";
import { activePacks, activeAdaptationRules } from "./knowledge";
import { pickMatchingRule, sanitizeEffect } from "./cms/rules";
import { effectiveMinutes } from "./time";
import { biomarkerDef, biomarkerBand } from "./biomarkers";

export interface TimelineItem extends BehaviorDef {
  fromPacks: string[];
  muted: boolean;
  /** User-chosen exact time, if set. */
  customTime?: string;
  /** The block the system recommended (before any user override). */
  recommendedBlock: TimeBlock;
  /** True when the user moved it off the recommended block/time. */
  retimed: boolean;
}

const BLOCK_ORDER: Record<TimeBlock, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  anytime: 3,
};

function allPacks(state: AppState): ProtocolPack[] {
  // Hybrid: the timeline/merge/score path serves the active catalog —
  // a published bundle when one has been applied, else the built-in.
  return [...activePacks(), ...(state.customPacks ?? [])];
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoDayOf(dateStr: string) {
  const j = new Date(dateStr + "T00:00:00").getDay();
  return j === 0 ? 6 : j - 1;
}

/** Intelligent merge: same canonicalKey → one behavior, union of context. */
/**
 * @param packsOverride — when provided, the simulation/timeline uses
 * exactly these packs instead of `activePacks() + customPacks`. Used by
 * the admin Simulate tab to preview against built-in / drafts / live
 * without mutating module-level runtime state.
 */
export function compileTimeline(
  state: AppState,
  dayIndex: number,
  packsOverride?: ProtocolPack[]
): TimelineItem[] {
  const installed = new Set(state.installedPacks ?? []);
  const paused = new Set(state.pausedPacks ?? []);
  const overrides = state.behaviorOverrides ?? {};
  const merged = new Map<string, TimelineItem>();

  for (const pack of packsOverride ?? allPacks(state)) {
    if (!installed.has(pack.id) || paused.has(pack.id)) continue;
    for (const b of pack.behaviors) {
      const ov: BehaviorOverride | undefined = overrides[b.canonicalKey];
      if (ov?.disabled) continue;
      const existing = merged.get(b.canonicalKey);
      if (!existing) {
        const retimed =
          (!!ov?.block && ov.block !== b.block) || !!ov?.customTime;
        merged.set(b.canonicalKey, {
          ...b,
          daysActive: ov?.daysActive ?? b.daysActive,
          dose: ov?.dose ?? b.dose,
          block: ov?.block ?? b.block,
          customTime: ov?.customTime,
          recommendedBlock: b.block,
          retimed,
          fromPacks: [pack.name],
          muted: false,
        });
      } else {
        existing.leverage = Math.max(existing.leverage, b.leverage) as
          | 1
          | 2
          | 3;
        if (!existing.fromPacks.includes(pack.name))
          existing.fromPacks.push(pack.name);
        existing.recommendedBy = Array.from(
          new Set([
            ...(existing.recommendedBy ?? []),
            ...(b.recommendedBy ?? []),
          ])
        );
        if (!existing.dose && b.dose) existing.dose = b.dose;
        if (!existing.daysActive || !b.daysActive)
          existing.daysActive = undefined;
      }
    }
  }

  const settings = state.settings;
  const clock = (it: TimelineItem) => {
    const m = effectiveMinutes(it, settings);
    return m == null ? Number.MAX_SAFE_INTEGER : m;
  };
  return [...merged.values()]
    .filter((it) => !it.daysActive || it.daysActive[dayIndex])
    .sort(
      (a, b) =>
        BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block] ||
        clock(a) - clock(b) ||
        b.leverage - a.leverage
    );
}

// ── Signals (from the new behavior model + check-in) ──────────────

export interface Signals {
  adherence7: number | null;
  recoveryProxy: number | null;
  sleepQuality: number | null; // 1-5
  energy: number | null; // 1-5
  gapDays: number; // days since last active before today
  eveningMissedYesterday: boolean;
  trackedDays: number;
  bioConcern: string | null;
  bioRecoveryFlag: boolean;
  /**
   * Wearable readiness seam (0-100). Null until a device stream exists;
   * when present it *replaces* the subjective recovery proxy. Nothing
   * downstream changes — adapt() only reads recoveryProxy.
   */
  readiness: number | null;
}

/** Future wearable hook: return device readiness (0-100) or null. */
function deviceReadiness(_state: AppState): number | null {
  // No wearable integration yet — the seam is here so HRV/sleep can plug
  // in without touching adapt() or any screen.
  return null;
}

// Recovery-relevant markers whose "Watch" band should soften the day.
const BIO_RECOVERY = new Set(["hrv", "restingHR", "hsCRP"]);

function biomarkerConcern(state: AppState): {
  text: string | null;
  recovery: boolean;
} {
  const bms = state.biomarkers ?? [];
  if (bms.length === 0) return { text: null, recovery: false };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cut = `${cutoff.getFullYear()}-${String(
    cutoff.getMonth() + 1
  ).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const latest = new Map<string, number>();
  for (const b of [...bms].sort((a, c) => a.date.localeCompare(c.date)))
    if (b.date >= cut) latest.set(b.metric, b.value);
  for (const [metric, value] of latest) {
    const def = biomarkerDef(metric);
    if (!def || def.direction === "range") continue;
    if (biomarkerBand(def, value).label === "Watch") {
      return {
        text: `Recent ${def.label.toLowerCase()} (${value} ${def.unit}) is outside its optimal range`,
        recovery: BIO_RECOVERY.has(metric),
      };
    }
  }
  return { text: null, recovery: false };
}

function logHasActivity(l: DailyLog): boolean {
  return (
    l.score > 0 ||
    Object.values(l.behaviorCompletions ?? {}).some(Boolean) ||
    l.energyLevel != null ||
    l.sleepLog?.sleepQuality != null
  );
}

export function getSignals(state: AppState): Signals {
  const logs = state.dailyLogs ?? [];
  const today = new Date();
  const tKey = dateKey(today);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yLog = logs.find((l) => l.date === dateKey(y));
  const tLog = logs.find((l) => l.date === tKey);

  const recent = [...logs]
    .filter((l) => l.score > 0 && l.date !== tKey)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const adherence7 = recent.length
    ? Math.round(recent.reduce((s, l) => s + l.score, 0) / recent.length)
    : null;

  // gap since last active day (not counting today)
  const active = [...logs]
    .filter((l) => logHasActivity(l) && l.date !== tKey)
    .sort((a, b) => b.date.localeCompare(a.date));
  let gapDays = 0;
  if (active.length) {
    const last = new Date(active[0].date + "T00:00:00");
    gapDays = Math.max(
      0,
      Math.round((today.setHours(0, 0, 0, 0) - last.getTime()) / 86400000) - 1
    );
  }

  // Prefer *today's* check-in the moment it exists — otherwise the whole
  // adaptive read (recovery/lighter/primed) is always a full day stale.
  const sleepQuality =
    tLog?.sleepLog?.sleepQuality ?? yLog?.sleepLog?.sleepQuality ?? null;
  const energy = tLog?.energyLevel ?? yLog?.energyLevel ?? null;
  let recoveryProxy: number | null = null;
  const parts: { v: number; w: number }[] = [];
  if (sleepQuality != null)
    parts.push({ v: (sleepQuality / 5) * 100, w: 0.6 });
  if (energy != null) parts.push({ v: (energy / 5) * 100, w: 0.4 });
  if (parts.length) {
    const ws = parts.reduce((s, p) => s + p.w, 0);
    recoveryProxy = Math.round(
      parts.reduce((s, p) => s + p.v * p.w, 0) / ws
    );
  }
  // Device readiness, when available, supersedes the subjective proxy.
  const readiness = deviceReadiness(state);
  if (readiness != null) recoveryProxy = readiness;

  // evening adherence yesterday
  let eveningMissedYesterday = false;
  if (yLog && logHasActivity(yLog)) {
    const yItems = compileTimeline(state, isoDayOf(yLog.date)).filter(
      (i) => i.block === "evening"
    );
    if (yItems.length >= 2) {
      const done = yItems.filter(
        (i) => yLog.behaviorCompletions?.[i.canonicalKey]
      ).length;
      eveningMissedYesterday = done / yItems.length < 0.34;
    }
  }

  const bio = biomarkerConcern(state);

  return {
    adherence7,
    recoveryProxy,
    sleepQuality,
    energy,
    gapDays,
    eveningMissedYesterday,
    trackedDays: recent.length,
    bioConcern: bio.text,
    bioRecoveryFlag: bio.recovery,
    readiness,
  };
}

// ── Adaptation ────────────────────────────────────────────────────

export type AdaptMode =
  | "normal"
  | "essentials"
  | "recovery"
  | "lighter"
  | "primed"
  | "rebuild";

export interface Adaptation {
  mode: AdaptMode;
  headline: string;
  tone: string;
  reasons: string[];
}

function baselineAdapt(s: ReturnType<typeof getSignals>): Adaptation {
  // "Welcome back" requires there to BE a back to welcome to. A user
  // who finished onboarding 2 days ago, never opened the app, and
  // returns on day 3 isn't returning — they're starting. The signal
  // for genuine prior engagement is `trackedDays > 0`.
  if (s.gapDays >= 2 && s.trackedDays > 0) {
    return {
      mode: "rebuild",
      headline: "Welcome back",
      tone: `It's been a few days — no problem. I've trimmed today to just a few essentials so restarting feels effortless.`,
      reasons: [`You were away ${s.gapDays} days — easing back in`],
    };
  }
  if (s.recoveryProxy != null && s.recoveryProxy < 45) {
    return {
      mode: "recovery",
      headline: "Recovery mode",
      tone: "Your recovery is low. I've eased today toward restoration and moved demanding work aside — this is the smart play, not a setback.",
      reasons: [
        s.sleepQuality != null && s.sleepQuality <= 2
          ? "Sleep quality was low"
          : "Energy / recovery is down",
        ...(s.bioConcern ? [s.bioConcern] : []),
      ],
    };
  }
  if (s.adherence7 != null && s.adherence7 < 35 && s.trackedDays >= 3) {
    return {
      mode: "essentials",
      headline: "Essentials only",
      tone: "Let's keep today simple — just the few behaviors that move the needle most. Small wins rebuild momentum.",
      reasons: [`7-day adherence is light (${s.adherence7})`],
    };
  }
  if (s.sleepQuality != null && s.sleepQuality <= 2) {
    return {
      mode: "lighter",
      headline: "Lighter day",
      tone: "Last night was rough. Lower the bar today — consistency beats intensity, and tonight's sleep is the priority.",
      reasons: ["You rated last night's sleep poor"],
    };
  }
  if (s.bioRecoveryFlag && s.bioConcern) {
    return {
      mode: "lighter",
      headline: "Ease in",
      tone: "A recent biomarker suggests your system is under load. Keep today moderate and let recovery lead — this is data working for you.",
      reasons: [s.bioConcern],
    };
  }
  if (s.recoveryProxy != null && s.recoveryProxy >= 78) {
    return {
      mode: "primed",
      headline: "Primed",
      tone: "You're well recovered. A strong day to push your hardest training and deepest focus block.",
      reasons: ["Sleep & energy are high"],
    };
  }
  if (s.eveningMissedYesterday) {
    return {
      mode: "normal",
      headline: "Protect tonight",
      tone: "Your evening wind-down slipped yesterday. Today's leverage is in the last 90 minutes before bed — guard them.",
      reasons: ["Evening routine was missed yesterday"],
    };
  }
  return {
    mode: "normal",
    headline: "Today",
    tone: "A calm, complete day. Move through it block by block — momentum over perfection.",
    reasons: s.bioConcern ? [s.bioConcern] : [],
  };
}

/**
 * Public adapt: hardcoded baseline first, then any matching CMS rule
 * may override mode / headline / tone / reasons by priority. With no
 * published rules the function is byte-identical to the previous
 * pure-hardcoded version.
 */
export function adapt(state: AppState): Adaptation {
  const s = getSignals(state);
  const baseline = baselineAdapt(s);
  const rules = activeAdaptationRules();
  if (rules.length === 0) return baseline;
  const ctx: Record<string, unknown> = {
    gapDays: s.gapDays,
    recoveryProxy: s.recoveryProxy,
    adherence7: s.adherence7,
    sleepQuality: s.sleepQuality,
    energy: s.energy,
    trackedDays: s.trackedDays,
    eveningMissedYesterday: s.eveningMissedYesterday,
    bioRecoveryFlag: s.bioRecoveryFlag,
  };
  const hit = pickMatchingRule(rules, ctx);
  if (!hit) return baseline;
  const e = sanitizeEffect(hit.effect);
  return {
    mode: e.setMode ?? baseline.mode,
    headline: e.headline ?? baseline.headline,
    tone: e.tone ?? baseline.tone,
    reasons: e.reason
      ? [...baseline.reasons, e.reason]
      : baseline.reasons,
  };
}

export const RECOVERY_DEMOTE = new Set(["strength", "zone2", "deep-work", "vo2"]);
export const RECOVERY_PROMOTE = new Set([
  "nsdr",
  "extra-sleep",
  "wind-down",
  "magnesium-pm",
  "morning-sunlight",
]);

// Restraint behaviors that semantically forbid hard training. When one
// is active we must not also instruct the user to train hard — that's a
// contradiction, not a protocol.
export const RESTRAINT_KEYS = new Set(["no-intense"]);
export const TRAINING_KEYS = new Set(["strength", "zone2", "vo2", "sprint"]);

/** A deterministic, stable rank: leverage desc, then block, then key. */
function stableRank(a: TimelineItem, b: TimelineItem): number {
  return (
    b.leverage - a.leverage ||
    BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block] ||
    a.canonicalKey.localeCompare(b.canonicalKey)
  );
}

/** At scale, never let a load-reduction mode mute a block to nothing. */
function guaranteePerBlock(items: TimelineItem[]): TimelineItem[] {
  const byBlock = new Map<string, TimelineItem[]>();
  for (const it of items) {
    (byBlock.get(it.block) ?? byBlock.set(it.block, []).get(it.block)!).push(
      it
    );
  }
  const keepKeys = new Set<string>();
  for (const group of byBlock.values()) {
    if (group.some((g) => !g.muted)) continue;
    const top = [...group].sort(stableRank)[0];
    if (top) keepKeys.add(top.canonicalKey);
  }
  return keepKeys.size
    ? items.map((it) =>
        keepKeys.has(it.canonicalKey) ? { ...it, muted: false } : it
      )
    : items;
}

/**
 * Periodization: behaviors mastered over a long run shouldn't keep
 * crowding the day forever. Once a behavior has a long streak AND high
 * recent adherence it graduates to "maintenance" — collapsed into the
 * calm optional group most days, but resurfaced on a deterministic
 * weekly spot-check so it isn't silently forgotten. Keeps dense,
 * long-term systems light instead of plateauing into noise.
 */
function daysSinceEpoch(dayKey: string): number {
  return Math.floor(
    new Date(dayKey + "T00:00:00").getTime() / 86_400_000
  );
}
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Returns the set of canonical keys that *just* tipped into mastery —
 * mastered today but not yesterday. Lets the surface celebrate the
 * transition (a calm one-time graduation moment) instead of silently
 * muting a behavior the user just spent three weeks earning. Tied to a
 * specific dayKey so the caller decides what "today" means.
 */
export function freshlyMastered(
  state: AppState,
  dayKey: string
): Set<string> {
  const today = masteredKeys(state, dayKey);
  if (today.size === 0) return new Set();
  const d = new Date(dayKey + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const yesterdayKey = `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterday = masteredKeys(state, yesterdayKey);
  const out = new Set<string>();
  for (const k of today) if (!yesterday.has(k)) out.add(k);
  return out;
}

export function masteredKeys(
  state: AppState,
  dayKey: string
): Set<string> {
  const logs = state.dailyLogs ?? [];
  if (logs.length < 21) return new Set();
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out = new Set<string>();
  const dayNum = daysSinceEpoch(dayKey);

  const keys = new Set<string>();
  for (const l of logs)
    for (const k in l.behaviorCompletions ?? {})
      if (l.behaviorCompletions![k]) keys.add(k);

  for (const k of keys) {
    // current streak up to (but not requiring) today
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const d = new Date(dayKey + "T00:00:00");
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      if (byDate.get(dk)?.behaviorCompletions?.[k]) streak++;
      else break;
    }
    if (streak < 21) continue;
    // recent adherence over the last 30 *active* days
    let active = 0;
    let did = 0;
    for (let i = 1; i <= 30; i++) {
      const d = new Date(dayKey + "T00:00:00");
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const lg = byDate.get(dk);
      if (!lg) continue;
      const anyActivity =
        lg.score > 0 ||
        Object.values(lg.behaviorCompletions ?? {}).some(Boolean);
      if (!anyActivity) continue;
      active++;
      if (lg.behaviorCompletions?.[k]) did++;
    }
    if (active < 14 || did / active < 0.85) continue;
    // weekly spot-check: this key resurfaces ~1 day in 7
    if ((dayNum + hashKey(k)) % 7 === 0) continue;
    out.add(k);
  }
  return out;
}

/** Apply the adaptation: mute + reprioritize for reduced cognitive load. */
export function shapeTimeline(
  items: TimelineItem[],
  mode: AdaptMode,
  opts: { keystoneKey?: string; mastered?: Set<string> } = {}
): TimelineItem[] {
  let shaped: TimelineItem[];

  if (mode === "essentials") {
    shaped = items.map((it) => ({ ...it, muted: it.leverage < 3 }));
    shaped = guaranteePerBlock(shaped);
    // Ceiling: if "essentials" still shows a wall (power users with many
    // leverage-3 behaviors), keep the strongest 7 and rest the others —
    // the whole point is reduced load.
    const visible = shaped
      .filter((i) => !i.muted)
      .sort(stableRank);
    if (visible.length > 7) {
      const keep = new Set(visible.slice(0, 7).map((i) => i.canonicalKey));
      shaped = shaped.map((it) =>
        it.muted || keep.has(it.canonicalKey)
          ? it
          : { ...it, muted: true }
      );
    }
  } else if (mode === "recovery") {
    shaped = items
      .map((it) => ({
        ...it,
        muted: RECOVERY_DEMOTE.has(it.canonicalKey),
      }))
      .sort(
        (a, b) =>
          (RECOVERY_PROMOTE.has(b.canonicalKey) ? 1 : 0) -
            (RECOVERY_PROMOTE.has(a.canonicalKey) ? 1 : 0) ||
          BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block]
      );
    shaped = guaranteePerBlock(shaped);
  } else if (mode === "rebuild") {
    // Deterministic, block-diverse, keystone-first: at most 2 per block,
    // exactly the 3 highest-leverage that span the day — never a random
    // 3 that all land in the morning. If a restraint is active, training
    // behaviors are excluded from the slots up front, so reconciliation
    // can't later mute a kept item and break the "exactly 3" contract.
    const restraint = items.some((it) =>
      RESTRAINT_KEYS.has(it.canonicalKey)
    );
    const eligible = items.filter(
      (it) => !(restraint && TRAINING_KEYS.has(it.canonicalKey))
    );
    const ranked = [...eligible].sort(stableRank);
    const perBlock = new Map<string, number>();
    const keep = new Set<string>();
    const ksKey = opts.keystoneKey;
    if (
      ksKey &&
      eligible.some((i) => i.canonicalKey === ksKey)
    ) {
      keep.add(ksKey);
      const ksItem = eligible.find((i) => i.canonicalKey === ksKey)!;
      perBlock.set(ksItem.block, 1);
    }
    for (const it of ranked) {
      if (keep.size >= 3) break;
      if (keep.has(it.canonicalKey)) continue;
      const n = perBlock.get(it.block) ?? 0;
      if (n >= 2) continue;
      keep.add(it.canonicalKey);
      perBlock.set(it.block, n + 1);
    }
    shaped = items.map((it) => ({
      ...it,
      muted: !keep.has(it.canonicalKey),
    }));
  } else if (mode === "lighter") {
    shaped = items.map((it) => ({ ...it, muted: it.leverage === 1 }));
    shaped = guaranteePerBlock(shaped);
  } else {
    shaped = items;
  }

  // Always-on conflict reconciliation: if an active restraint behavior
  // forbids hard training, mute the training behaviors rather than
  // present the user with contradictory instructions.
  const restraintActive = shaped.some(
    (it) => RESTRAINT_KEYS.has(it.canonicalKey) && !it.muted
  );
  if (restraintActive) {
    shaped = shaped.map((it) =>
      TRAINING_KEYS.has(it.canonicalKey) ? { ...it, muted: true } : it
    );
  }

  // Graduate mastered behaviors to maintenance (collapsed) — never the
  // keystone, which is the one thing we always keep front-and-centre.
  if (opts.mastered && opts.mastered.size) {
    shaped = shaped.map((it) =>
      opts.mastered!.has(it.canonicalKey) &&
      it.canonicalKey !== opts.keystoneKey
        ? { ...it, muted: true }
        : it
    );
  }

  return shaped;
}

export function blockLabel(b: TimeBlock): string {
  return b === "anytime"
    ? "Anytime"
    : b.charAt(0).toUpperCase() + b.slice(1);
}

export function isDone(log: DailyLog, key: string): boolean {
  return !!log.behaviorCompletions?.[key];
}

export function timelineProgress(
  items: TimelineItem[],
  log: DailyLog
): { done: number; total: number; essentialsDone: number; essentials: number } {
  const active = items.filter((i) => !i.muted);
  const ess = active.filter((i) => i.leverage === 3);
  return {
    done: active.filter((i) => isDone(log, i.canonicalKey)).length,
    total: active.length,
    essentialsDone: ess.filter((i) => isDone(log, i.canonicalKey)).length,
    essentials: ess.length,
  };
}

// ── Semantic leverage labels ──────────────────────────────────────

export const CIRCADIAN = new Set([
  "morning-sunlight",
  "dim-lights",
  "screens-off",
  "caffeine-cutoff",
  "wind-down",
  "last-meal-3h",
  "delay-caffeine",
]);

export interface LeverageTag {
  text: string;
  tone: "accent" | "recovery" | "sleep" | "warm" | "vitality" | "muted";
}

/**
 * A semantic, context-aware label for a behavior — guides attention
 * by meaning, not by a flat 1/2/3.
 */
export function leverageTag(
  it: TimelineItem,
  mode: AdaptMode,
  opts: { isKeystone?: boolean; streak?: number } = {}
): LeverageTag {
  if (it.muted) return { text: "Optional today", tone: "muted" };
  if (opts.isKeystone) return { text: "Your keystone", tone: "warm" };
  if (mode === "recovery" && RECOVERY_PROMOTE.has(it.canonicalKey))
    return { text: "Recovery-critical", tone: "recovery" };
  if (CIRCADIAN.has(it.canonicalKey))
    return { text: "Circadian anchor", tone: "sleep" };
  if (it.leverage === 3) return { text: "Essential", tone: "accent" };
  if ((opts.streak ?? 0) >= 3)
    return { text: "Momentum builder", tone: "warm" };
  if (it.leverage === 1) return { text: "Easy win", tone: "vitality" };
  return { text: "Core", tone: "accent" };
}

// ── Adaptive Up Next message ──────────────────────────────────────

const KEY_MESSAGE: Record<string, string> = {
  "wind-down": "Your wind-down window is open — protect it.",
  "morning-sunlight":
    "First light is the highest-leverage move of the day.",
  "caffeine-cutoff":
    "Caffeine window closing — this guards tonight's deep sleep.",
  "dim-lights": "Lower the lights now to let melatonin rise on time.",
  "screens-off": "Screens down soon — your sleep onset depends on it.",
  "magnesium-pm": "A small cue that tells your system the day is closing.",
  nsdr: "Ten minutes here resets dopamine and lowers the load.",
  "last-meal-3h": "Closing the kitchen now protects overnight repair.",
};

/** Predictive, emotionally-aware line for the focal behavior. */
export function upNextMessage(
  it: TimelineItem,
  ctx: {
    mode: AdaptMode;
    minutesToStart: number | null; // resolved time - now
    isKeystone?: boolean;
  }
): string {
  if (ctx.isKeystone)
    return "On the days you do this, everything else lands better.";
  if (KEY_MESSAGE[it.canonicalKey]) return KEY_MESSAGE[it.canonicalKey];
  if (ctx.mode === "recovery")
    return "Recovery suggests a lower-stimulation path — this one still counts.";
  if (ctx.mode === "rebuild")
    return "Just this one. Re-entry is about momentum, not volume.";
  if (
    ctx.minutesToStart != null &&
    ctx.minutesToStart <= 15 &&
    ctx.minutesToStart > -45
  )
    return "Its ideal window is open right now.";
  if (it.leverage === 3)
    return "The highest-leverage move you can make right now.";
  if (it.kind === "avoid")
    return "A small act of restraint that pays back tonight.";
  return it.rationale;
}
