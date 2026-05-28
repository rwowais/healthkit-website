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
  TrustTier,
} from "./types";
import { activePacks, activeAdaptationRules } from "./knowledge";
import { pickMatchingRule, sanitizeEffect } from "./cms/rules";
import { effectiveMinutes } from "./time";
import { biomarkerDef, biomarkerBand } from "./biomarkers";
import { getTz, dateKeyInTz, dayIndexOfKeyInTz, addDaysToKey } from "./tz";
import { isSupplementBehavior } from "./supplements";
import { resolveBehaviorByKey, easierDayFromSwap } from "./workouts";
import { getAccess } from "./entitlements";

export interface TimelineItem extends BehaviorDef {
  fromPacks: string[];
  muted: boolean;
  /** User-chosen exact time, if set. */
  customTime?: string;
  /** The block the system recommended (before any user override). */
  recommendedBlock: TimeBlock;
  /** True when the user moved it off the recommended block/time. */
  retimed: boolean;
  /**
   * Governance class — computed at compile time. Downstream consumers
   * (keystone, suggestions, mastery, leverageTag) can branch on this
   * to enforce trust-tier semantics consistently across the engine.
   */
  trustTier: TrustTier;
  /**
   * Reason this item is muted, if it is. Populated by shapeTimeline
   * during the various mute passes (mode demotion, CONFLICT_PAIRS,
   * mastery graduation). Surfaced via explainBehavior() — gives the
   * user (or admin) a concrete "why isn't this on Today?" answer
   * instead of silent disappearance.
   */
  muteReason?: string;
  /**
   * Per-day workout swap markers (populated by applySwaps).
   * - `swappedTo`: this item was the user's PLANNED behavior; they
   *   swapped it for `swappedTo`. The row should render replaced,
   *   not as a normal todo. Engine renders it muted with a "swapped
   *   for X" caption; Today UI may hide it entirely.
   * - `swappedFrom`: this item is the REPLACEMENT. It was injected
   *   into today's timeline because the user swapped from another
   *   workout. UI labels it accordingly so the swap pairing reads.
   */
  swappedTo?: string;
  swappedFrom?: string;
}

/**
 * Classify a behavior into its trust tier without needing AppState.
 * The shape of canonicalKey is load-bearing here:
 *   - `custom:*`  → fully custom (no curated lineage)
 *   - `fork:*`    → user fork of a curated pack; treated like derived
 *   - anything else with a `derivedFrom` pointer → derived
 *   - anything else → curated
 *
 * Why derived from the data, not stored: keeps tier classification a
 * single-source-of-truth invariant. A custom atom that gains a
 * `derivedFrom` (via the atom-library picker) automatically promotes
 * itself; one that loses it (impossible today, but defensible) demotes.
 */
export function trustTier(b: {
  canonicalKey: string;
  derivedFrom?: string;
}): TrustTier {
  if (b.canonicalKey.startsWith("custom:")) {
    // A custom atom WITH a derivedFrom (the atom-library pick path) is
    // "derived" — it inherits curated metadata via effectiveKey. A
    // custom atom WITHOUT one (free-text escape hatch) is "custom".
    return b.derivedFrom ? "derived" : "custom";
  }
  if (b.canonicalKey.startsWith("fork:")) {
    // Forks always carry derivedFrom (storage.ts ensures this); they're
    // derived for governance purposes.
    return b.derivedFrom ? "derived" : "custom";
  }
  // Anything else is curated (in PACKS or STANDALONE_ATOMS, or an
  // admin-authored protocol that passed validateAtom at publish time).
  return "curated";
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

/**
 * Local-day key. Was: device-clock parts. Now: timezone-aware so a
 * user in NY late at night doesn't get UTC's "tomorrow" key, and a
 * user who travels keeps writing logs against the timezone they chose
 * in onboarding (or their device's current resolved tz as fallback).
 */
function dateKey(d: Date, tz: string) {
  return dateKeyInTz(tz, d);
}
/**
 * Weekday (Mon=0..Sun=6) of a YYYY-MM-DD key as seen in the user's
 * timezone. Replaces `new Date(dateStr + "T00:00:00").getDay()` which
 * silently used the device's local tz and could disagree with the
 * user's stored tz for a stored log near midnight.
 */
function isoDayOf(dateStr: string, tz: string) {
  return dayIndexOfKeyInTz(tz, dateStr);
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
  // Vacation mode: returns an empty timeline. The user sees a calm
  // "you're on a break" surface on Today, no packs auto-resume until
  // they toggle it off in Profile. Streak math (in scoring.ts) skips
  // these days so the user isn't penalized for the break.
  if (state.settings?.vacationMode) return [];
  const installed = new Set(state.installedPacks ?? []);
  const paused = new Set(state.pausedPacks ?? []);
  const overrides = state.behaviorOverrides ?? {};
  // Calm safety gating: if the user has any safetyFlags set, suppress
  // contraindicated atoms from the merged timeline entirely. The atom
  // is still installable from the library picker (so a user can choose
  // to override consciously per-instance), but the system never
  // foregrounds it. This is the "lightweight safety gating without
  // clinical intake" the calm-system direction calls for.
  const userFlags = state.settings?.safetyFlags ?? {};
  const hasFlag = (b: BehaviorDef): boolean => {
    if (!b.contraindications || b.contraindications.length === 0)
      return false;
    return b.contraindications.some(
      (flag) => userFlags[flag] === true
    );
  };
  // Merge by effectiveKey (derivedFrom ?? canonicalKey) so a forked
  // pack's "wind-down" (canonicalKey: "fork:abc:wind-down", derivedFrom:
  // "wind-down") merges with the curated Better Sleep "wind-down" into
  // ONE timeline row instead of two visually-similar cards. The fork
  // still owns its independent behaviorOverrides (those are keyed by
  // the namespaced canonicalKey), but at render time the user sees one
  // unified behavior — which is what they actually expect.
  const merged = new Map<string, TimelineItem>();

  for (const pack of packsOverride ?? allPacks(state)) {
    if (!installed.has(pack.id) || paused.has(pack.id)) continue;
    for (const b of pack.behaviors) {
      const ov: BehaviorOverride | undefined = overrides[b.canonicalKey];
      if (ov?.disabled) continue;
      // Supplements have their own surface (state.supplements +
      // SupplementBlockCard on Today). Skip them here so they don't
      // ALSO appear as inline behavior rows. Detection is broad —
      // canonical key, derivedFrom, icon=pill, and title regex
      // patterns — so CMS-edited bundles with renamed titles and
      // legacy forks without derivedFrom both get caught.
      if (isSupplementBehavior(b)) continue;
      // Suppress contraindicated atoms. The user toggled a safety flag
      // during onboarding (or in profile); we honor it without ever
      // showing a clinical warning. Quiet trust.
      if (hasFlag(b)) continue;
      const mergeKey = b.derivedFrom ?? b.canonicalKey;
      const existing = merged.get(mergeKey);
      if (!existing) {
        const retimed =
          (!!ov?.block && ov.block !== b.block) || !!ov?.customTime;
        merged.set(mergeKey, {
          ...b,
          daysActive: ov?.daysActive ?? b.daysActive,
          dose: ov?.dose ?? b.dose,
          block: ov?.block ?? b.block,
          // Honor a user override first, then the behavior's OWN baked
          // clock time. Previously this was `ov?.customTime` alone, which
          // silently dropped a behavior's intrinsic customTime (e.g. a
          // custom behavior authored with an exact time) — so it fell
          // back to anchor math and mis-sorted on Today.
          customTime: ov?.customTime ?? b.customTime,
          recommendedBlock: b.block,
          retimed,
          fromPacks: [pack.name],
          muted: false,
          // Trust tier — derived from the originating behavior's
          // canonicalKey + derivedFrom. Two atoms merging by
          // effectiveKey may have different tiers (a custom-derived
          // copy + the curated original); the first-wins rule gives
          // curated precedence in practice (the curated atom is
          // visited first via pack-iteration order). Downstream code
          // branches on this — keystone, suggestions, mastery, etc.
          trustTier: trustTier(b),
        });
      } else {
        existing.leverage = Math.max(existing.leverage, b.leverage) as
          | 1
          | 2
          | 3;
        if (!existing.fromPacks.includes(pack.name))
          existing.fromPacks.push(pack.name);
        // Trust tier on merge: ALWAYS prefer the most-authoritative
        // tier (curated > derived > custom). A user's custom-derived
        // "Magnesium glycinate" merging with the curated `magnesium-pm`
        // should expose curated governance (contraindications,
        // evidenceTier, recommendation eligibility), not the user's.
        // This is the central guardrail against ontology pollution.
        const incomingTier = trustTier(b);
        const upgrading =
          (existing.trustTier === "custom" && incomingTier !== "custom") ||
          (existing.trustTier === "derived" && incomingTier === "curated");
        if (upgrading) {
          existing.trustTier = incomingTier;
          // Governance metadata copy on tier upgrade. Without this, a
          // row first seeded by a custom-derived atom would keep the
          // user's free-text rationale + zero contraindications, even
          // after merging with the curated atom that has full
          // governance data. The trust tier would claim "curated" but
          // the surfaces (BehaviorSheet, safety gating, evidence
          // hedging) would render against custom-quality metadata.
          // Only copy when curated metadata exists — preserves a
          // user-provided rationale on a curated atom whose own
          // rationale field happens to be empty.
          if (b.rationale && b.rationale.trim())
            existing.rationale = b.rationale;
          if (b.evidence && b.evidence.trim())
            existing.evidence = b.evidence;
          if (b.evidenceTier) existing.evidenceTier = b.evidenceTier;
          if (b.contraindications && b.contraindications.length > 0)
            existing.contraindications = b.contraindications;
          if (b.targets && b.targets.length > 0)
            existing.targets = b.targets;
          if (b.timingReason && b.timingReason.trim())
            existing.timingReason = b.timingReason;
          // Title comes from the curated source on upgrade too — a
          // user's typo'd "Magnezium" should display as the curated
          // "Magnesium PM" once merged.
          if (b.title) existing.title = b.title;
        }
        existing.recommendedBy = Array.from(
          new Set([
            ...(existing.recommendedBy ?? []),
            ...(b.recommendedBy ?? []),
          ])
        );
        if (!existing.dose && b.dose) existing.dose = b.dose;
        // daysActive UNION across packs (was: collapse-to-undefined
        // when either side was missing or arrays disagreed, which made
        // Heart Health's Tue/Thu/Sun strength and Longevity Foundation's
        // Mon/Wed/Fri strength merge into "every day" — quietly more
        // than either pack actually wanted). Now: missing = all 7 days
        // by convention; union per-day so a user with both packs gets
        // strength on Mon/Tue/Wed/Thu/Fri/Sun (everything either pack
        // requested), not silent collapse.
        const a = existing.daysActive ?? [true, true, true, true, true, true, true];
        const c = b.daysActive ?? [true, true, true, true, true, true, true];
        const union = a.map((v, i) => v || c[i]);
        existing.daysActive = union.every((v) => v) ? undefined : union;
        // Apply THIS behavior's override even on merge — without
        // this, when a forked pack's `fork:abc:wind-down` merges with
        // the curated `wind-down`, only the first-visited behavior's
        // override sticks. The fork's customTime / block / dose would
        // be silently dropped. Apply the override if and only if the
        // existing row hasn't already been explicitly retimed
        // (preserves first-wins for conflicting overrides; lets
        // missing-but-then-set fields fill in).
        if (ov) {
          if (ov.daysActive) existing.daysActive = ov.daysActive;
          if (ov.dose) existing.dose = ov.dose;
          if (ov.block && !existing.retimed) {
            existing.block = ov.block;
            existing.retimed = true;
          }
          if (ov.customTime && !existing.customTime) {
            existing.customTime = ov.customTime;
            existing.retimed = true;
          }
        }
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
    .sort((a, b) => {
      const blockDiff = BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block];
      if (blockDiff !== 0) return blockDiff;
      // Near-time tiebreaker: items within 5 minutes of each other
      // are treated as visually concurrent — break by leverage desc
      // so an Essential (lev 3) like Morning sunlight floats above
      // a stack of lev-1 supplements that happen to land 1-2 min
      // earlier on the clock. Without this, sunlight at 8:01 sat
      // below six supplements at 8:00, even though it's the
      // headline behavior of the block.
      const dt = clock(a) - clock(b);
      if (Math.abs(dt) < 5) {
        const levDiff = b.leverage - a.leverage;
        if (levDiff !== 0) return levDiff;
      }
      return dt || b.leverage - a.leverage;
    });
}

/**
 * Apply per-day workout swaps to a compiled timeline. Pure — takes
 * the timeline + the day's log and returns a new timeline with:
 *
 *   - the swapped-FROM item annotated (swappedTo set, muted true,
 *     muteReason populated). Today UI can choose to render it as a
 *     "Swapped for Y" placeholder or hide it; the engine just marks.
 *   - the swapped-TO behavior added if it's not already there
 *     (looking it up across all packs and standalones so the
 *     replacement renders even when its daysActive excludes today).
 *     If it IS already in the timeline (e.g., both workouts were
 *     scheduled today), we just annotate the existing item.
 *
 * Order: call this AFTER compileTimeline, BEFORE shapeTimeline. The
 * adaptation pass should see the swap-adjusted set, since the
 * user's intent ("I did yoga instead") is what matters for muting/
 * reprioritization.
 */
export function applySwaps(
  items: TimelineItem[],
  log: { swaps?: Record<string, string> } | undefined
): TimelineItem[] {
  const swaps = log?.swaps;
  if (!swaps || Object.keys(swaps).length === 0) return items;
  // Index existing items by canonicalKey for O(1) lookups.
  const byKey = new Map(items.map((it) => [it.canonicalKey, it]));
  // 1. Annotate originals.
  const next: TimelineItem[] = items.map((it) => {
    const toKey = swaps[it.canonicalKey];
    if (!toKey) return it;
    return {
      ...it,
      swappedTo: toKey,
      muted: true,
      muteReason: `swapped for ${toKey}`,
    };
  });
  // 2. Inject replacements that aren't already in the timeline.
  for (const [fromKey, toKey] of Object.entries(swaps)) {
    if (byKey.has(toKey)) {
      // Replacement was already in today's timeline — annotate it.
      const idx = next.findIndex((it) => it.canonicalKey === toKey);
      if (idx >= 0) next[idx] = { ...next[idx], swappedFrom: fromKey };
      continue;
    }
    const def = resolveBehaviorByKey(toKey);
    if (!def) continue;
    next.push({
      ...def,
      fromPacks: [],
      muted: false,
      recommendedBlock: def.block,
      retimed: false,
      trustTier: trustTier(def),
      swappedFrom: fromKey,
    });
  }
  return next;
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
  /**
   * True when the user swapped a higher-intensity workout for a lower-
   * intensity one today (e.g. strength → walk, hiit → mobility).
   * adapt() reads this to bump toward "lighter" mode so the rest of
   * the day reflects the user's stated intent — a swap feels
   * intelligent, not just logged.
   */
  easierDayFromSwap: boolean;
  /**
   * Has the user ever logged a scored day? Distinct from trackedDays
   * (which is a 7-day recent window). adapt() uses this to gate the
   * rebuild branch — a 40-day returner DOES have history, even if
   * their last 7 days are empty.
   */
  hasHistory: boolean;
}

/** Future wearable hook: return device readiness (0-100) or null. */
function deviceReadiness(_state: AppState): number | null {
  // No wearable integration yet — the seam is here so HRV/sleep can plug
  // in without touching adapt() or any screen.
  return null;
}

// Recovery-relevant markers whose "Watch" band should soften the day.
// hsCRP was dropped with the bloodwork panel — the live recovery signal
// now rides entirely on HRV + resting HR (both wearable-friendly).
const BIO_RECOVERY = new Set(["hrv", "restingHR"]);

function biomarkerConcern(state: AppState): {
  text: string | null;
  recovery: boolean;
} {
  const bms = state.biomarkers ?? [];
  if (bms.length === 0) return { text: null, recovery: false };
  // 30-day cutoff in the user's tz — was previously device-clock,
  // which could drift by up to a day for travelers.
  const tz = getTz(state.settings);
  const cut = addDaysToKey(dateKeyInTz(tz), -30);
  const latest = new Map<string, { value: number; date: string }>();
  for (const b of [...bms].sort((a, c) => a.date.localeCompare(c.date)))
    if (b.date >= cut) latest.set(b.metric, { value: b.value, date: b.date });
  // Pick the most-recent metric that's outside its band — was
  // previously insertion-order which surfaced the oldest metric on a
  // user with multiple "Watch" readings.
  const candidates: {
    metric: string;
    value: number;
    date: string;
    def: ReturnType<typeof biomarkerDef>;
  }[] = [];
  for (const [metric, entry] of latest) {
    const def = biomarkerDef(metric);
    if (!def || def.direction === "range") continue;
    if (biomarkerBand(def, entry.value).label === "Watch") {
      candidates.push({ metric, ...entry, def });
    }
  }
  if (candidates.length === 0) return { text: null, recovery: false };
  // Sort by date desc — most-recent Watch wins.
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  const pick = candidates[0];
  return {
    text: `Recent ${pick.def!.label.toLowerCase()} (${pick.value} ${pick.def!.unit}) is outside its optimal range`,
    recovery: BIO_RECOVERY.has(pick.metric),
  };
}

function logHasActivity(l: DailyLog): boolean {
  return (
    l.score > 0 ||
    Object.values(l.behaviorCompletions ?? {}).some(Boolean) ||
    l.energyLevel != null ||
    l.sleepLog?.sleepQuality != null
  );
}

/**
 * Compute the set of date keys the user was in vacation mode for.
 * Duplicated here (also lives in storage.ts as getVacationDates)
 * because storage imports from engine — adding the reverse would
 * create a cycle. Walks settings.vacationPeriods, emitting every
 * day in each range (start..end inclusive). For an active vacation
 * (end === null), uses today (in the user's tz) as the end.
 *
 * Why getSignals needs this: the streak math (scoring.ts) already
 * skips vacation days transparently; without the same treatment in
 * signals, a user returning from a 2-week trip sees their day flip
 * to "Welcome back / rebuild" mode AND a stale 0% adherence on the
 * last 7 calendar days — even though the trip was a sanctioned
 * break. Vacation transparency has to be honored end-to-end.
 */
function vacationDates(state: AppState): Set<string> {
  const out = new Set<string>();
  const periods = state.settings?.vacationPeriods ?? [];
  if (periods.length === 0) return out;
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  for (const p of periods) {
    if (!p?.start) continue;
    const end = p.end ?? today;
    let cursor = p.start;
    // Cap at 365 iterations per range so a malformed period can't hang.
    for (let i = 0; i < 366; i++) {
      out.add(cursor);
      if (cursor === end) break;
      cursor = addDaysToKey(cursor, 1);
    }
  }
  return out;
}

export function getSignals(state: AppState): Signals {
  const logs = state.dailyLogs ?? [];
  const tz = getTz(state.settings);
  const tKey = dateKeyInTz(tz);
  // Yesterday in the user's tz — addDaysToKey is DST-stable, unlike
  // `new Date(); y.setDate(y.getDate() - 1)` which used device tz
  // and could disagree with stored YYYY-MM-DD keys for travelers.
  const yKey = addDaysToKey(tKey, -1);
  const yLog = logs.find((l) => l.date === yKey);
  const tLog = logs.find((l) => l.date === tKey);

  // adherence7 — 7-day windowed mean of scored days. Was previously
  // ".slice(0, 7)" which took "the 7 most-recent scored logs of all
  // time," meaning after a 40-day ghost the value was a 69%
  // adherence from data 40 days stale. Now we filter by calendar
  // window so adherence reflects *recent* engagement.
  const sevenDaysAgo = addDaysToKey(tKey, -7);
  const recent = [...logs]
    .filter(
      (l) => l.score > 0 && l.date !== tKey && l.date >= sevenDaysAgo
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const adherence7 = recent.length
    ? Math.round(recent.reduce((s, l) => s + l.score, 0) / recent.length)
    : null;
  // trackedDays — scored days WITHIN the 7-day window. Matches the
  // "recent engagement" semantics (essentials mode gates on
  // trackedDays >= 3). After a 40-day ghost this correctly reads 0,
  // not "last 7 scored ever" which would inflate to 7 with 40-day-
  // stale data.
  const trackedDays = recent.length;
  // hasHistory — has the user EVER had a scored log? Used by the
  // rebuild branch to distinguish "user is genuinely returning"
  // from "user just started and hasn't logged yet." Doesn't conflate
  // with trackedDays (which is now a recent-window signal).
  const hasHistory = logs.some((l) => l.score > 0);

  // Gap since last active day (not counting today). Calendar-day
  // math in the user's tz — DST-stable. Vacation days are TRANSPARENT
  // (they don't count as gaps), mirroring the streak math in
  // scoring.ts. A user returning from a 2-week trip should see
  // gapDays === 0, not 14.
  const active = [...logs]
    .filter((l) => logHasActivity(l) && l.date !== tKey)
    .sort((a, b) => b.date.localeCompare(a.date));
  let gapDays = 0;
  const vacays = vacationDates(state);
  if (active.length) {
    const lastKey = active[0].date;
    let cursor = tKey;
    for (let i = 0; i < 366; i++) {
      cursor = addDaysToKey(cursor, -1);
      if (cursor === lastKey) break;
      // Skip vacation days — they're sanctioned breaks. Only
      // increment for real "I forgot to open the app" gaps.
      if (!vacays.has(cursor)) gapDays++;
    }
    // Tz-crossing grace: forward crossing (PST → Tokyo, +16h)
    // makes the "yesterday-in-destination-tz" calendar key be 2
    // days after the last log key written in the source tz, even
    // though no actual logging gap exists. Without correction this
    // shows up as gapDays=1 on arrival day (and ratchets toward 2,
    // which would tip the rebuild branch). Squelch a 1-day gap
    // when the user has been continuously active just before —
    // i.e., the second-most-recent log is itself within 1 calendar
    // day of the last log. This preserves the signal for genuine
    // gaps (longer than 1 day OR not preceded by recent activity).
    if (gapDays === 1 && active.length >= 2) {
      const prevKey = active[1].date;
      // If the two most-recent logs are calendar-adjacent (no real
      // gap between them), the apparent 1-day gap today is a
      // tz-crossing artifact, not a real absence.
      if (addDaysToKey(lastKey, -1) === prevKey) {
        gapDays = 0;
      }
    }
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
    const yItems = compileTimeline(state, isoDayOf(yLog.date, tz)).filter(
      (i) => i.block === "evening"
    );
    if (yItems.length >= 2) {
      const done = yItems.filter(
        (i) => yLog.behaviorCompletions?.[i.canonicalKey]
      ).length;
      eveningMissedYesterday = done / yItems.length < 0.34;
    }
  }

  // Biomarker-aware adaptation is a Premium feature per CLAUDE.md
  // ("biomarker-aware adaptation, and unlimited history"). Gate the
  // signal at the source so a free-tier / expired-trial user adding
  // an HRV reading doesn't accidentally get a premium mode shift.
  // Subjective recoveryProxy (sleep + energy) is still free and
  // unaffected — only the body-marker-derived signal is gated.
  const bio = getAccess(state).premium
    ? biomarkerConcern(state)
    : { text: null, recovery: false };

  return {
    adherence7,
    recoveryProxy,
    sleepQuality,
    energy,
    gapDays,
    eveningMissedYesterday,
    trackedDays,
    bioConcern: bio.text,
    bioRecoveryFlag: bio.recovery,
    readiness,
    easierDayFromSwap: easierDayFromSwap(tLog),
    hasHistory,
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
  if (s.gapDays >= 2 && s.hasHistory) {
    // Tier the tone by gap length — "a few days" reads oblivious for
    // a 40-day return. Each tier keeps the same calm posture but
    // matches the actual interval so the system feels like it
    // notices.
    const tone =
      s.gapDays > 30
        ? "It's been a while — welcome back. I've trimmed today to a couple of essentials; the rest will catch back up on its own as you re-engage."
        : s.gapDays > 7
        ? "It's been over a week — no problem. Today's pared back so restarting feels light. Build from here."
        : "It's been a few days — no problem. I've trimmed today to just a few essentials so restarting feels effortless.";
    return {
      mode: "rebuild",
      headline: "Welcome back",
      tone,
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
  // Workout-swap signal: user told us they dialed today's training
  // intensity DOWN (e.g. swapped strength → walk). Honor that intent
  // by mode-shifting to "lighter" so the rest of the day reflects
  // the lighter posture — high-stress co-occurring items (cold
  // plunge, late caffeine, intense intervals) get demoted by the
  // existing lighter-mode shape pass.
  //
  // Skipped if a more-specific signal already chose recovery /
  // essentials / lighter above; we never *upgrade* a recovery
  // signal into lighter (which would feel like the system
  // ignoring something heavier).
  if (s.easierDayFromSwap) {
    return {
      mode: "lighter",
      headline: "Lighter day",
      tone: "You dialed today's training back — I've eased the rest of the day to match. Recovery is part of the program, not a setback.",
      reasons: ["You swapped to an easier workout"],
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

/**
 * Effective canonical key for intelligence-layer matches. A behavior
 * picked from the atom library (e.g., custom "Magnesium glycinate"
 * with `derivedFrom: "magnesium-pm"`) gets the curated key for
 * conflict resolution, recovery demotion, CIRCADIAN tagging, etc. —
 * even though its own canonicalKey is namespaced (`custom:...`).
 * Free-text customs (no derivedFrom) keep their namespaced key and
 * skip the official key matches entirely.
 */
export function effectiveKey(it: { canonicalKey: string; derivedFrom?: string }): string {
  return it.derivedFrom ?? it.canonicalKey;
}

/**
 * Runtime invariant check on an atom. Returns a list of human-readable
 * violations (empty = valid). Run at:
 *   - CMS bundle publish time (reject the bundle if any atom fails)
 *   - Custom-pack upsert (reject the user input with the violation list)
 *   - Build-time test (asserts the entire PACKS + STANDALONE_ATOMS set
 *     is valid; catches typos in newly-added curated atoms)
 *
 * The point isn't to encode every possible business rule — it's to
 * catch the silent-semantic-bug class (typos in canonicalKey, malformed
 * daysActive, contradictory anchor/block, references to keys that don't
 * exist) that the TS type system can't see.
 */
export interface AtomValidationError {
  field: string;
  message: string;
}
export function validateAtom(
  b: BehaviorDef,
  knownKeys?: Set<string>
): AtomValidationError[] {
  const errs: AtomValidationError[] = [];
  // canonicalKey shape — lowercase, hyphens only, optional namespace
  // prefix for custom/fork atoms. Curated atoms reject the namespaces.
  if (!b.canonicalKey || typeof b.canonicalKey !== "string")
    errs.push({ field: "canonicalKey", message: "missing or not a string" });
  else if (!/^([a-z][a-z0-9-]*|custom:[^:]+:[a-z0-9-]+|fork:[^:]+:[a-z0-9-]+)$/.test(b.canonicalKey))
    errs.push({
      field: "canonicalKey",
      message: `"${b.canonicalKey}" doesn't match the required shape (lowercase + hyphens, or custom:/fork: namespace)`,
    });
  // daysActive must be 7-length boolean if present — the engine indexes
  // by JS day-of-week (mapped to Mon=0..Sun=6).
  if (b.daysActive !== undefined) {
    if (!Array.isArray(b.daysActive) || b.daysActive.length !== 7)
      errs.push({
        field: "daysActive",
        message: `must be a 7-element boolean array (got ${
          Array.isArray(b.daysActive) ? `length ${b.daysActive.length}` : typeof b.daysActive
        })`,
      });
    else if (b.daysActive.some((v) => typeof v !== "boolean"))
      errs.push({ field: "daysActive", message: "must contain booleans only" });
  }
  // offsetMin sanity — humans don't have wake-relative offsets > 18h
  // or bed-relative offsets > 12h before/after. Catches typos like -9999.
  if (typeof b.offsetMin !== "number" || !Number.isFinite(b.offsetMin))
    errs.push({ field: "offsetMin", message: "must be a finite number" });
  else if (b.offsetMin < -720 || b.offsetMin > 1080)
    errs.push({
      field: "offsetMin",
      message: `${b.offsetMin} is outside the sensible range (-720..1080)`,
    });
  // Block + anchor consistency. A bed-anchored atom in the morning
  // block is contradictory; flag it.
  if (b.anchor === "bed" && b.block === "morning")
    errs.push({
      field: "block",
      message: "bed-anchored atoms shouldn't land in the morning block",
    });
  if (b.anchor === "wake" && b.block === "evening" && b.offsetMin < 360)
    errs.push({
      field: "block",
      message:
        "wake-anchored atoms in the evening block need offsetMin >= 360 (6h after wake)",
    });
  // leverage typed-but-trust-but-verify
  if (![1, 2, 3].includes(b.leverage as number))
    errs.push({ field: "leverage", message: `must be 1, 2, or 3 (got ${b.leverage})` });
  // derivedFrom / targets reference real keys (when knownKeys provided)
  if (knownKeys) {
    if (b.derivedFrom && !knownKeys.has(b.derivedFrom))
      errs.push({
        field: "derivedFrom",
        message: `"${b.derivedFrom}" is not a known canonicalKey`,
      });
    for (const t of b.targets ?? []) {
      if (!knownKeys.has(t))
        errs.push({
          field: "targets",
          message: `target "${t}" is not a known canonicalKey`,
        });
    }
  }
  // kind === "avoid" should usually have targets — soft warning, not an
  // error, because some avoids are stand-alone rules (no-liquid-sugar).
  // Skip.
  return errs;
}

export const RECOVERY_DEMOTE = new Set([
  "strength",
  "zone2",
  "deep-work",
  // Was "vo2" — actual canonicalKey is "vo2max-intervals". The old
  // entry never matched anything; high-intensity intervals slipped
  // through the recovery-mode mute.
  "vo2max-intervals",
]);
export const RECOVERY_PROMOTE = new Set([
  "nsdr",
  "extra-sleep",
  "wind-down",
  "magnesium-pm",
  "morning-sunlight",
]);

/**
 * Explicit cross-behavior conflict map. When a restraint is present
 * and not muted, every paired target is muted — preventing the surface
 * from showing two contradictory instructions side by side.
 *
 * Why a flat list (not a graph or solver): each entry is auditable,
 * and the set of real cross-pack contradictions is small (<10). A
 * typed constraint engine would be the right answer when this grows
 * past ~15 pairs or when constraints need offsets/severity.
 *
 * Whitelist semantics: only `source: "official"` behaviors participate
 * (enforced at the call site in shapeTimeline). That prevents a user-
 * typed custom behavior named "no-intense" from silently muting their
 * strength training, or a custom "strength" being muted by Burnout
 * Recovery's "no-intense" rule.
 */
export const CONFLICT_PAIRS: ReadonlyArray<{
  restraint: string;
  target: string;
}> = [
  // Burnout Recovery's "no intense training" mutes the hard-training
  // behaviors so the recovery contract isn't contradicted.
  { restraint: "no-intense", target: "strength" },
  { restraint: "no-intense", target: "zone2" },
  { restraint: "no-intense", target: "vo2max-intervals" },
  // Fasted Mornings' delay-first-meal contradicts a protein-led
  // breakfast — both have leverage 3, and the timeline would otherwise
  // tell the user "eat now" and "don't eat until 11am" in the same
  // morning block. The restraint wins (it's the active discipline).
  { restraint: "delay-first-meal", target: "protein-breakfast" },
  // Jetlag Recovery's anchor-meal is semantically the same "eat
  // breakfast at destination" — also contradicted by the fasting
  // restraint. Without this entry, a user with Fasted Mornings +
  // Jetlag installed saw the breakfast card survive while
  // protein-breakfast was muted.
  { restraint: "delay-first-meal", target: "anchor-meal" },
  // Weekly Recovery Day's deload-day (Sunday-only avoid) mutes any
  // training behavior that happens to be scheduled the same day —
  // most relevant for Heart Health (strength Tue/Thu/Sun, vo2max
  // Sat). Without this, a Sunday with both packs shows "Full deload"
  // and "Strength training" side by side.
  { restraint: "deload-day", target: "strength" },
  { restraint: "deload-day", target: "zone2" },
  { restraint: "deload-day", target: "vo2max-intervals" },
  // Cold/Heat Therapy's "no cold post-lift" rule mutes the morning
  // cold plunge on days a strength session was completed yesterday
  // (the timeline-level mute happens at install time; the per-day
  // gating refines later if a constraint engine arrives).
  { restraint: "no-cold-post-lift", target: "cold-plunge-am" },
];

// Derived sets — used in mode-specific shaping (rebuild excludes
// training-keys from its 3-pick lineup; recovery demotes them).
export const RESTRAINT_KEYS = new Set(CONFLICT_PAIRS.map((p) => p.restraint));
export const TRAINING_KEYS = new Set(CONFLICT_PAIRS.map((p) => p.target));

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
  // dayKey is YYYY-MM-DD in the user's local calendar. Convert to a
  // UTC-anchored day index that doesn't drift across DST or device
  // timezone changes. Used only for the weekly spot-check modulo, so
  // it just needs to be stable — not aligned with any particular zone.
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(
    Date.UTC(y, m - 1, d, 12, 0, 0) / 86_400_000
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
  // Step back one calendar day in a tz-stable way (addDaysToKey uses
  // noon-UTC anchoring, so DST and device-tz don't matter).
  const yesterdayKey = addDaysToKey(dayKey, -1);
  const yesterday = masteredKeys(state, yesterdayKey);
  // Compare against the WEEK-PRIOR mastery set too. The weekly
  // spot-check inside masteredKeys deterministically excludes a
  // mastered key one day in 7 — so the naive `today \ yesterday`
  // diff fires a fake "freshly mastered" the day after every spot-
  // check (a week-long false positive cycle that re-celebrates the
  // same behavior). Requiring the key to be ALSO missing 7 days ago
  // gates the celebration to actual graduation, not a spot-check
  // return.
  const weekAgoKey = addDaysToKey(dayKey, -7);
  const weekAgo = masteredKeys(state, weekAgoKey);
  const out = new Set<string>();
  for (const k of today) {
    if (!yesterday.has(k) && !weekAgo.has(k)) out.add(k);
  }
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

  // Build a per-key daysActive lookup from the live catalog. A
  // behavior scheduled only Mon/Wed/Fri shouldn't have its streak
  // broken every Tuesday — we need to walk the streak in scheduled
  // days, not calendar days. Falls back to "every day" when a key
  // isn't found (custom atoms without explicit scheduling).
  const allBehaviors = activePacks().flatMap((p) => p.behaviors);
  const daysActiveFor = new Map<string, boolean[] | undefined>();
  for (const b of allBehaviors) {
    if (!daysActiveFor.has(b.canonicalKey)) {
      daysActiveFor.set(b.canonicalKey, b.daysActive);
    }
  }
  // Day-of-week helper — must match engine's Mon=0..Sun=6 convention.
  const isoDow = (k: string): number => {
    const j = new Date(k + "T00:00:00").getDay();
    return j === 0 ? 6 : j - 1;
  };
  const isScheduledOn = (k: string, dkey: string): boolean => {
    const d = daysActiveFor.get(k);
    if (!d || d.length !== 7) return true;
    return d[isoDow(dkey)] === true;
  };

  // Swap-aware completion check: a behavior credited via swapBehavior
  // (auto-completed as the replacement) should NOT count toward
  // mastery for that day. Per the DailyLog.swaps contract in
  // types.ts: "the replacement is a one-off — neither should
  // accumulate streak credit for the other." Without this, repeated
  // strength→walk swaps would silently master "walk."
  const wasGenuinelyCompleted = (l: DailyLog, k: string): boolean => {
    if (!l.behaviorCompletions?.[k]) return false;
    const swaps = l.swaps;
    if (!swaps) return true;
    // If this key is the TO of a swap, the completion was auto-set.
    return !Object.values(swaps).includes(k);
  };

  const keys = new Set<string>();
  for (const l of logs)
    for (const k in l.behaviorCompletions ?? {})
      if (l.behaviorCompletions![k] && wasGenuinelyCompleted(l, k))
        keys.add(k);

  // Trust-tier gate: graduation to maintenance is a SYSTEM CLAIM
  // ("you've mastered this — we'll background it"). For curated and
  // derived atoms we own the definition and stand behind the claim.
  // For a free-text custom ("Aunt Mary's herbal blend"), the system
  // would be claiming authority over a behavior it can't even define;
  // the right move is to keep custom-tier behaviors visible on the
  // timeline every day, no matter how consistent the user is.
  // Build a per-key derivedFrom lookup from customPacks to classify.
  const derivedLookup = new Map<string, string | undefined>();
  for (const pack of state.customPacks ?? []) {
    for (const b of pack.behaviors ?? []) {
      derivedLookup.set(b.canonicalKey, b.derivedFrom);
    }
  }
  const isCustomTier = (k: string): boolean => {
    if (!k.startsWith("custom:") && !k.startsWith("fork:")) return false;
    // For namespaced keys: only custom-tier when no derivedFrom is set.
    // Atom-library picks (derived) and forks (always have derivedFrom)
    // remain mastery-eligible.
    return !derivedLookup.get(k);
  };

  for (const k of keys) {
    if (isCustomTier(k)) continue;
    // Streak walk: step back through SCHEDULED days only — bp-check
    // (Mon-only) shouldn't have its streak broken every Tue–Sun. Un-
    // scheduled days are transparent (mirrors how vacation days
    // already work). 365 calendar days bounds the walk; for a weekly
    // behavior this naturally yields ~52 scheduled days, well above
    // the 21-day mastery threshold.
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const dk = addDaysToKey(dayKey, -i);
      if (!isScheduledOn(k, dk)) continue; // transparent skip
      const lg = byDate.get(dk);
      if (lg && wasGenuinelyCompleted(lg, k)) streak++;
      else break;
    }
    if (streak < 21) continue;
    // Two separate gates over the last 30 calendar days:
    //
    //  (a) GENERAL ENGAGEMENT — user opened the app + did *anything*
    //      on at least 14 days. Confirms the user is still showing up;
    //      protects against "21 days completed → silent disappearance
    //      → mastery decision based on no current data."
    //
    //  (b) THIS-KEY ADHERENCE — of the days this key was SCHEDULED in
    //      the last 30 calendar days, ≥85% were genuinely completed.
    //      Scales naturally with cadence: a Mon-only key needs ≥85%
    //      of its 4 Mondays, a daily key needs ≥85% of 30 days.
    //
    // Was previously one combined check that required ≥14 active
    // SCHEDULED days, unreachable for weekly behaviors (max ~4
    // Mondays in 30 days). bp-check / vo2max-intervals could never
    // master, no matter how perfectly the user adhered.
    let engagedDays = 0;
    let scheduledForKey = 0;
    let didForKey = 0;
    for (let i = 1; i <= 30; i++) {
      const dk = addDaysToKey(dayKey, -i);
      const lg = byDate.get(dk);
      if (!lg) continue;
      const anyActivity =
        lg.score > 0 ||
        Object.values(lg.behaviorCompletions ?? {}).some(Boolean) ||
        lg.energyLevel != null ||
        lg.moodLevel != null ||
        lg.sleepLog?.sleepQuality != null;
      if (anyActivity) engagedDays++;
      if (isScheduledOn(k, dk)) {
        scheduledForKey++;
        if (wasGenuinelyCompleted(lg, k)) didForKey++;
      }
    }
    if (engagedDays < 14) continue;
    // For low-cadence keys with very few scheduled days in the
    // window, require an absolute minimum sample (3 instances) before
    // declaring mastery. Otherwise a Mon-only key with 1 scheduled
    // day in 30 (DST month boundaries) could over-fit.
    if (scheduledForKey < 3 || didForKey / scheduledForKey < 0.85)
      continue;
    // Weekly spot-check: this key resurfaces ~1 day in 7
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
    shaped = items.map((it) =>
      it.leverage < 3
        ? { ...it, muted: true, muteReason: "essentials mode: only leverage-3 behaviors" }
        : { ...it, muted: false, muteReason: undefined }
    );
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
          : {
              ...it,
              muted: true,
              muteReason: "essentials mode: 7-behavior ceiling",
            }
      );
    }
  } else if (mode === "recovery") {
    // effectiveKey lets atom-library-derived custom behaviors (e.g.,
    // a custom "Heavy back squats" derivedFrom: "strength") still
    // demote correctly in recovery — without it, custom-derived
    // training behaviors silently slip through the mute.
    shaped = items
      .map((it) => {
        const demoted = RECOVERY_DEMOTE.has(effectiveKey(it));
        return {
          ...it,
          muted: demoted,
          muteReason: demoted
            ? "recovery mode: training/cognitive demands eased"
            : undefined,
        };
      })
      .sort(
        (a, b) =>
          (RECOVERY_PROMOTE.has(effectiveKey(b)) ? 1 : 0) -
            (RECOVERY_PROMOTE.has(effectiveKey(a)) ? 1 : 0) ||
          BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block]
      );
    shaped = guaranteePerBlock(shaped);
  } else if (mode === "rebuild") {
    // Deterministic, block-diverse, keystone-first: at most 2 per block,
    // exactly the 3 highest-leverage that span the day — never a random
    // 3 that all land in the morning. Restraint targets (the SPECIFIC
    // ones from CONFLICT_PAIRS, not every training key) are excluded
    // from the slots up front so reconciliation can't later mute a kept
    // item and break the "exactly 3" contract.
    // Use effectiveKey so a custom-derived restraint (someone built
    // their own "no intense training" derivedFrom: "no-intense") also
    // triggers the rebuild-mode training exclusion.
    const activeRestraintsRebuild = new Set(
      items
        .filter((it) => RESTRAINT_KEYS.has(effectiveKey(it)))
        .map((it) => effectiveKey(it))
    );
    const targetsExcluded = new Set<string>();
    for (const pair of CONFLICT_PAIRS) {
      if (activeRestraintsRebuild.has(pair.restraint))
        targetsExcluded.add(pair.target);
    }
    const eligible = items.filter(
      (it) => !targetsExcluded.has(effectiveKey(it))
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
    shaped = items.map((it) =>
      keep.has(it.canonicalKey)
        ? { ...it, muted: false, muteReason: undefined }
        : {
            ...it,
            muted: true,
            muteReason: "rebuild mode: keeping 3 high-leverage behaviors",
          }
    );
  } else if (mode === "lighter") {
    shaped = items.map((it) =>
      it.leverage === 1
        ? {
            ...it,
            muted: true,
            muteReason: "lighter mode: optional behaviors muted",
          }
        : { ...it, muted: false, muteReason: undefined }
    );
    shaped = guaranteePerBlock(shaped);
  } else {
    shaped = items;
  }

  // Always-on conflict reconciliation. Each restraint mutes only its
  // SPECIFIC targets from CONFLICT_PAIRS — the old "every restraint
  // mutes every target" lumped fasting and intense-training restraints
  // together, which would mute strength training when the only active
  // restraint was "delay-first-meal" (no relation). The pair list keeps
  // mutes precise.
  // effectiveKey: atom-library-derived custom restraints still trigger
  // their target mutes; atom-library-derived custom targets still get
  // muted by curated restraints. Pure-free-text customs (no derivedFrom)
  // are correctly invisible to this pass.
  const activeRestraints = new Set(
    shaped
      .filter(
        (it) => RESTRAINT_KEYS.has(effectiveKey(it)) && !it.muted
      )
      .map((it) => effectiveKey(it))
  );
  if (activeRestraints.size > 0) {
    const targetsToMute = new Map<string, string>(); // key → restraint key
    for (const pair of CONFLICT_PAIRS) {
      if (activeRestraints.has(pair.restraint))
        targetsToMute.set(pair.target, pair.restraint);
    }
    // Index restraints by their source pack so we can name the
    // protocol responsible when surfacing the mute reason. A user
    // who installs Burnout Recovery and sees strength training
    // "Resting today" deserves to know WHICH protocol asked for it
    // — that's the entire point of provenance.
    const restraintPack = new Map<string, string>(); // restraint key → pack name
    for (const it of shaped) {
      const k = effectiveKey(it);
      if (RESTRAINT_KEYS.has(k) && !it.muted && it.fromPacks?.[0]) {
        if (!restraintPack.has(k)) restraintPack.set(k, it.fromPacks[0]);
      }
    }
    shaped = shaped.map((it) => {
      const restraint = targetsToMute.get(effectiveKey(it));
      if (!restraint) return it;
      // Encode both the rule key and the source pack name so the
      // sheet can surface a specific "Your Burnout Recovery
      // protocol asks you to skip..." line. Pipe-delimited so the
      // humanizer can parse without ambiguity.
      const pack = restraintPack.get(restraint) ?? "";
      return {
        ...it,
        muted: true,
        muteReason: `conflict pair: "${restraint}"${pack ? ` | from: ${pack}` : ""}`,
      };
    });
  }

  // Graduate mastered behaviors to maintenance (collapsed) — never the
  // keystone, which is the one thing we always keep front-and-centre.
  if (opts.mastered && opts.mastered.size) {
    shaped = shaped.map((it) =>
      opts.mastered!.has(it.canonicalKey) &&
      it.canonicalKey !== opts.keystoneKey
        ? {
            ...it,
            muted: true,
            muteReason: "graduated to maintenance (21+ day streak, high adherence)",
          }
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

/**
 * Calm, per-block intelligence: detect overstuffed blocks and same-day
 * combinations that benefit from explicit framing. Renders as a single
 * one-line note above the block's behaviors in Today — not an alert,
 * not a warning, just acknowledgment that the system sees what's on
 * the plate.
 *
 * Returns `null` when the block is well-balanced; otherwise returns one
 * concise note. Picks the most-important note when multiple could fire
 * (overstuffed > training-stacking > general note) so we never stack
 * two intelligence banners on the same block.
 */
export type BlockNote = {
  kind: "density" | "training" | "combo";
  text: string;
};

const TRAINING_KEY_SET = new Set([
  "strength",
  "zone2",
  "vo2max-intervals",
  "tabata-hiit",
]);
const HARD_TRAINING_KEY_SET = new Set([
  "strength",
  "vo2max-intervals",
  "tabata-hiit",
]);
const COLD_KEYS = new Set(["cold-plunge-am", "contrast-shower"]);

export function blockIntelligence(
  allItems: TimelineItem[],
  block: TimeBlock,
  dayIndex: number
): BlockNote | null {
  const inBlock = allItems.filter((i) => i.block === block && !i.muted);
  if (inBlock.length === 0) return null;

  // Day-aware filter: skip behaviors whose daysActive excludes today,
  // so a 3×/wk strength behavior doesn't trigger a "Zone 2 + strength
  // same day" note on a day strength isn't actually scheduled.
  const isActiveToday = (it: TimelineItem) =>
    !it.daysActive || it.daysActive[dayIndex];
  const today = inBlock.filter(isActiveToday);
  const essentials = today.filter((i) => i.leverage === 3);
  const allDayItems = allItems.filter(
    (i) => !i.muted && isActiveToday(i)
  );

  // 1. Same-day training stacking — most user-relevant note.
  // Two HARD training stimuli on the same day = explicit framing so
  // the user knows to scale one (not both at full intensity).
  const trainingToday = allDayItems.filter((i) =>
    TRAINING_KEY_SET.has(effectiveKey(i))
  );
  const hardToday = trainingToday.filter((i) =>
    HARD_TRAINING_KEY_SET.has(effectiveKey(i))
  );
  if (hardToday.length >= 2 && block === "afternoon") {
    const names = hardToday
      .map((i) => i.title)
      .slice(0, 2)
      .join(" + ");
    return {
      kind: "training",
      text: `Two training stimuli today (${names}). Pick one to push, take the other lighter.`,
    };
  }
  // Zone 2 + strength same day: NOT a contradiction (Attia-style
  // protocols schedule both), but worth flagging so the user sequences
  // them (strength first, Zone 2 after — or different times of day).
  if (
    block === "afternoon" &&
    trainingToday.some((i) => effectiveKey(i) === "zone2") &&
    trainingToday.some((i) => effectiveKey(i) === "strength")
  ) {
    return {
      kind: "training",
      text: "Zone 2 and strength on the same day — lift first, then easy aerobic. Or split across blocks.",
    };
  }

  // 2. Cold + sauna same day — pairing benefit, just acknowledge it.
  const hasColdToday = allDayItems.some((i) =>
    COLD_KEYS.has(effectiveKey(i))
  );
  const hasSaunaToday = allDayItems.some(
    (i) => effectiveKey(i) === "sauna-pm"
  );
  if (block === "morning" && hasColdToday && hasSaunaToday) {
    return {
      kind: "combo",
      text: "Cold this morning, sauna tonight — classic hormesis pairing.",
    };
  }

  // 3. Overstuffed block — the catch-all. When more than 5 visible
  // behaviors land in one block (especially evening), point at the
  // essentials and let the rest land if they land.
  if (today.length >= 6) {
    const essCount = essentials.length;
    if (essCount > 0) {
      const labels =
        essCount === 1
          ? `the essential here — ${essentials[0].title}`
          : `the ${essCount} essentials in this block`;
      return {
        kind: "density",
        text: `${today.length} behaviors this ${block}. If time's tight, focus on ${labels}.`,
      };
    }
    return {
      kind: "density",
      text: `${today.length} behaviors this ${block}. Pick the 2–3 that feel most important today.`,
    };
  }

  return null;
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
  if (mode === "recovery" && RECOVERY_PROMOTE.has(effectiveKey(it)))
    return { text: "Recovery-critical", tone: "recovery" };
  if (CIRCADIAN.has(effectiveKey(it)))
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
  if (KEY_MESSAGE[effectiveKey(it)]) return KEY_MESSAGE[effectiveKey(it)];
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
