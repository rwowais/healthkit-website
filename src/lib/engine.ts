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
import { PACKS } from "./packs";

export interface TimelineItem extends BehaviorDef {
  fromPacks: string[];
  muted: boolean;
}

const BLOCK_ORDER: Record<TimeBlock, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  anytime: 3,
};

function allPacks(state: AppState): ProtocolPack[] {
  return [...PACKS, ...(state.customPacks ?? [])];
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
export function compileTimeline(
  state: AppState,
  dayIndex: number
): TimelineItem[] {
  const installed = new Set(state.installedPacks ?? []);
  const overrides = state.behaviorOverrides ?? {};
  const merged = new Map<string, TimelineItem>();

  for (const pack of allPacks(state)) {
    if (!installed.has(pack.id)) continue;
    for (const b of pack.behaviors) {
      const ov: BehaviorOverride | undefined = overrides[b.canonicalKey];
      if (ov?.disabled) continue;
      const existing = merged.get(b.canonicalKey);
      if (!existing) {
        merged.set(b.canonicalKey, {
          ...b,
          daysActive: ov?.daysActive ?? b.daysActive,
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

  return [...merged.values()]
    .filter((it) => !it.daysActive || it.daysActive[dayIndex])
    .sort(
      (a, b) =>
        BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block] ||
        b.leverage - a.leverage ||
        a.offsetMin - b.offsetMin
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

  const sleepQuality = yLog?.sleepLog?.sleepQuality ?? null;
  const energy = yLog?.energyLevel ?? null;
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

  return {
    adherence7,
    recoveryProxy,
    sleepQuality,
    energy,
    gapDays,
    eveningMissedYesterday,
    trackedDays: recent.length,
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

export function adapt(state: AppState): Adaptation {
  const s = getSignals(state);

  if (s.gapDays >= 2) {
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
    reasons: [],
  };
}

const RECOVERY_DEMOTE = new Set(["strength", "zone2", "deep-work", "vo2"]);
const RECOVERY_PROMOTE = new Set([
  "nsdr",
  "extra-sleep",
  "wind-down",
  "magnesium-pm",
  "morning-sunlight",
]);

/** Apply the adaptation: mute + reprioritize for reduced cognitive load. */
export function shapeTimeline(
  items: TimelineItem[],
  mode: AdaptMode
): TimelineItem[] {
  if (mode === "essentials") {
    return items.map((it) => ({ ...it, muted: it.leverage < 3 }));
  }
  if (mode === "recovery") {
    const shaped = items.map((it) => ({
      ...it,
      muted: RECOVERY_DEMOTE.has(it.canonicalKey),
    }));
    return shaped.sort(
      (a, b) =>
        (RECOVERY_PROMOTE.has(b.canonicalKey) ? 1 : 0) -
          (RECOVERY_PROMOTE.has(a.canonicalKey) ? 1 : 0) ||
        BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block]
    );
  }
  if (mode === "rebuild") {
    const ranked = [...items].sort((a, b) => b.leverage - a.leverage);
    const keep = new Set(ranked.slice(0, 3).map((i) => i.canonicalKey));
    return items.map((it) => ({ ...it, muted: !keep.has(it.canonicalKey) }));
  }
  if (mode === "lighter") {
    return items.map((it) => ({ ...it, muted: it.leverage === 1 }));
  }
  return items;
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
