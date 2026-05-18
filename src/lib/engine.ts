/**
 * engine.ts — the adaptive core.
 *
 * compileTimeline: installed packs → a single, de-duplicated, scheduled
 * timeline (intelligent merge of overlapping behaviors).
 *
 * adapt: ambient intelligence — reshapes the day from recent signals.
 * Calm, non-judgmental, never punishing.
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
import { recoveryScore, sleepScore, pillarScore } from "./metrics";

export interface TimelineItem extends BehaviorDef {
  fromPacks: string[]; // pack names — provenance
  muted: boolean; // de-prioritized by the adaptive engine
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
        // merge: strongest leverage, combined provenance & sources
        existing.leverage = Math.max(existing.leverage, b.leverage) as 1 | 2 | 3;
        if (!existing.fromPacks.includes(pack.name))
          existing.fromPacks.push(pack.name);
        existing.recommendedBy = Array.from(
          new Set([...(existing.recommendedBy ?? []), ...(b.recommendedBy ?? [])])
        );
        if (!existing.dose && b.dose) existing.dose = b.dose;
        // union schedule: if either pack wants it daily, keep it daily
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

// ── Adaptive layer ────────────────────────────────────────────────

export type AdaptMode = "normal" | "essentials" | "recovery" | "primed";

export interface Adaptation {
  mode: AdaptMode;
  tone: string;
  headline: string;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getSignals(state: AppState) {
  const logs = state.dailyLogs;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yLog = logs.find((l) => l.date === dateKey(y));

  const recent = [...logs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const adherence7 = recent.length
    ? Math.round(recent.reduce((s, l) => s + l.score, 0) / recent.length)
    : null;

  return {
    recovery: yLog ? recoveryScore(yLog) : null,
    sleep: yLog ? sleepScore(yLog) : null,
    sleepAdherence: yLog ? pillarScore(yLog, "sleep") : null,
    adherence7,
    trackedDays: recent.length,
  };
}

export function adapt(state: AppState): Adaptation {
  const s = getSignals(state);

  if (s.recovery != null && s.recovery < 45) {
    return {
      mode: "recovery",
      headline: "Recovery mode",
      tone: "Your recovery is running low. I've eased today toward restoration — no guilt, this is the smart move.",
    };
  }
  if (s.adherence7 != null && s.adherence7 < 35 && s.trackedDays >= 3) {
    return {
      mode: "essentials",
      headline: "Essentials only",
      tone: "Let's keep today simple. Just the few behaviors that move the needle most.",
    };
  }
  if (s.sleep != null && s.sleep < 50) {
    return {
      mode: "normal",
      headline: "Lighter day",
      tone: "Last night was light. Lower the bar today — consistency beats intensity.",
    };
  }
  if (s.recovery != null && s.recovery >= 75) {
    return {
      mode: "primed",
      headline: "Primed",
      tone: "You're well recovered. A good day to push your hardest block.",
    };
  }
  return {
    mode: "normal",
    headline: "Today",
    tone: "A calm, complete day. Move through it block by block.",
  };
}

const RECOVERY_DEMOTE = new Set([
  "strength",
  "zone2",
  "deep-work",
  "vo2",
]);

/** Apply the adaptation to the compiled timeline. */
export function shapeTimeline(
  items: TimelineItem[],
  mode: AdaptMode
): TimelineItem[] {
  if (mode === "essentials") {
    return items.map((it) => ({
      ...it,
      muted: it.leverage < 3,
    }));
  }
  if (mode === "recovery") {
    return items.map((it) => ({
      ...it,
      muted: RECOVERY_DEMOTE.has(it.canonicalKey),
    }));
  }
  return items;
}

export function blockLabel(b: TimeBlock): string {
  return b === "anytime"
    ? "Anytime"
    : b.charAt(0).toUpperCase() + b.slice(1);
}

/** Completion helpers on the per-day behavior map. */
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
