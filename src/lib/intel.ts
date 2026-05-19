/**
 * intel.ts — ambient intelligence layer.
 *
 * Time anchoring, current-block awareness, per-behavior streaks,
 * keystone-habit detection, and proactive (calm) suggestions.
 */
import type { AppState, DailyLog } from "./types";
import { compileTimeline, type TimelineItem } from "./engine";
import { packById, PACKS } from "./packs";
import { effectiveMinutes, nowMinutes } from "./time";

export {
  resolveMinutes,
  effectiveMinutes,
  fmtClock,
  nowMinutes,
  currentBlock,
} from "./time";

/**
 * Behavior set for analytics — the union across every weekday, not just
 * Monday. Day-of-week scheduling shouldn't make keystone / weekly review
 * blind to behaviors that only run on, say, weekends.
 */
function analyticsItems(state: AppState): TimelineItem[] {
  const map = new Map<string, TimelineItem>();
  for (let d = 0; d < 7; d++) {
    for (const it of compileTimeline(state, d)) {
      if (!map.has(it.canonicalKey)) map.set(it.canonicalKey, it);
    }
  }
  return [...map.values()];
}

// ── Per-behavior streaks ──────────────────────────────────────────

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BehaviorStat {
  streak: number;
  last7: number;
}

export function behaviorStats(
  state: AppState,
  key: string
): BehaviorStat {
  const logs = new Map(state.dailyLogs.map((l) => [l.date, l]));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const log = logs.get(dateKey(d));
    const done = !!log?.behaviorCompletions?.[key];
    if (done) streak++;
    else if (i === 0) continue; // today not done yet — don't break
    else break;
  }
  let last7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (logs.get(dateKey(d))?.behaviorCompletions?.[key]) last7++;
  }
  return { streak, last7 };
}

// ── Keystone detection ────────────────────────────────────────────

export interface Keystone {
  key: string;
  title: string;
  delta: number; // % points higher on days done
}

export function keystone(state: AppState): Keystone | null {
  const logs = state.dailyLogs.filter((l) => l.score > 0);
  if (logs.length < 6) return null;
  const items = analyticsItems(state);
  let best: Keystone | null = null;
  for (const it of items) {
    const done: number[] = [];
    const not: number[] = [];
    for (const l of logs) {
      (l.behaviorCompletions?.[it.canonicalKey] ? done : not).push(l.score);
    }
    if (done.length < 4 || not.length < 3) continue;
    const avg = (xs: number[]) =>
      xs.reduce((a, b) => a + b, 0) / xs.length;
    const delta = Math.round(avg(done) - avg(not));
    if (delta >= 8 && (!best || delta > best.delta)) {
      best = { key: it.canonicalKey, title: it.title, delta };
    }
  }
  return best;
}

// ── Adaptive suggestions ──────────────────────────────────────────

export type SuggestionAction =
  | { type: "install"; packId: string }
  | { type: "pause"; key: string }
  | { type: "none" };

export interface Suggestion {
  id: string;
  kind: "install" | "pause" | "progress";
  title: string;
  body: string;
  cta: string;
  action: SuggestionAction;
}

export function suggestions(state: AppState): Suggestion[] {
  const out: Suggestion[] = [];
  const installed = new Set(state.installedPacks ?? []);

  // 1. Sleep quality trending low → suggest Better Sleep
  const sq = state.dailyLogs
    .filter((l) => l.sleepLog?.sleepQuality != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((l) => l.sleepLog.sleepQuality as number);
  if (
    sq.length >= 4 &&
    sq.reduce((a, b) => a + b, 0) / sq.length <= 2.7 &&
    !installed.has("better-sleep")
  ) {
    out.push({
      id: "sug-sleep",
      kind: "install",
      title: "Your sleep keeps coming up short",
      body: "The Better Sleep protocol targets exactly this — light, temperature, and timing.",
      cta: "Install Better Sleep",
      action: { type: "install", packId: "better-sleep" },
    });
  }

  // 2. Chronically skipped behavior → offer to pause (kills guilt)
  const items = analyticsItems(state);
  const activeDays = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (activeDays.length >= 5) {
    for (const it of items) {
      if (state.behaviorOverrides?.[it.canonicalKey]?.disabled) continue;
      const everDone = activeDays.some(
        (l) => l.behaviorCompletions?.[it.canonicalKey]
      );
      if (!everDone) {
        out.push({
          id: `sug-pause-${it.canonicalKey}`,
          kind: "pause",
          title: `“${it.title}” isn't landing`,
          body: "It's been skipped every recent day. Pausing it is not failure — it clears space for what works.",
          cta: "Pause this behavior",
          action: { type: "pause", key: it.canonicalKey },
        });
        break;
      }
    }
  }

  // 3. Keystone slipping → gentle awareness (no guilt, no pause)
  const ks = keystone(state);
  if (
    ks &&
    !state.behaviorOverrides?.[ks.key]?.disabled &&
    activeDays.length >= 5
  ) {
    const stat = behaviorStats(state, ks.key);
    if (stat.last7 < Math.ceil(activeDays.length / 2)) {
      out.push({
        id: `sug-keystone-${ks.key}`,
        kind: "progress",
        title: `Your keystone is slipping`,
        body: `On days you do “${ks.title}” your score runs ${ks.delta} points higher — but it's been light lately. Re-anchor it tomorrow.`,
        cta: "Got it",
        action: { type: "none" },
      });
    }
  }

  // 4. Consistently strong → suggest a progression pack
  const recent = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (
    recent.length >= 6 &&
    recent.reduce((a, b) => a + b.score, 0) / recent.length >= 75
  ) {
    const next = PACKS.find(
      (p) =>
        !installed.has(p.id) &&
        ["deep-focus", "blood-sugar", "burnout-recovery"].includes(p.id)
    );
    if (next) {
      out.push({
        id: "sug-progress",
        kind: "progress",
        title: "You've earned a new layer",
        body: `Your consistency is excellent. ${next.name} stacks cleanly on your current system — overlaps merge automatically.`,
        cta: `Explore ${next.name}`,
        action: { type: "install", packId: next.id },
      });
    }
  }

  return out.slice(0, 2);
}

export function packName(id: string): string {
  return packById(id)?.name ?? id;
}

// ── Weekly review (calm narrative) ────────────────────────────────

export interface WeeklyReview {
  headline: string;
  statLine: string;
  wins: string[];
  focus: string;
  delta: number | null;
}

const DOW = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weeklyReview(state: AppState): WeeklyReview | null {
  const logs = state.dailyLogs ?? [];
  const dayList = (offset: number) => {
    const out: DailyLog[] = [];
    for (let i = offset; i < offset + 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const l = logs.find((x) => x.date === dateKey(d));
      if (l) out.push(l);
    }
    return out;
  };

  const thisWeek = dayList(0);
  const tracked = thisWeek.filter((l) => l.score > 0);
  if (tracked.length < 4) return null;

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const avgThis = Math.round(avg(tracked.map((l) => l.score)));
  const prev = dayList(7).filter((l) => l.score > 0);
  const avgPrev = prev.length
    ? Math.round(avg(prev.map((l) => l.score)))
    : null;
  const delta = avgPrev != null ? avgThis - avgPrev : null;

  // best day
  const best = [...tracked].sort((a, b) => b.score - a.score)[0];
  const bestName = best
    ? DOW[new Date(best.date + "T00:00:00").getDay()]
    : null;

  // most-kept behavior this week
  const items = analyticsItems(state);
  let topTitle: string | null = null;
  let topCount = 0;
  for (const it of items) {
    const c = tracked.filter(
      (l) => l.behaviorCompletions?.[it.canonicalKey]
    ).length;
    if (c > topCount) {
      topCount = c;
      topTitle = it.title;
    }
  }

  const wins: string[] = [];
  wins.push(`${tracked.length} of 7 days active`);
  if (bestName && best)
    wins.push(`Best day was ${bestName} at ${best.score}`);
  if (topTitle && topCount >= 3)
    wins.push(`Kept “${topTitle}” ${topCount} days`);

  // focus: weakest behavior among essentials
  const essentials = items.filter((i) => i.leverage === 3);
  let focusTitle: string | null = null;
  let focusCount = 99;
  for (const it of essentials) {
    const c = tracked.filter(
      (l) => l.behaviorCompletions?.[it.canonicalKey]
    ).length;
    if (c < focusCount) {
      focusCount = c;
      focusTitle = it.title;
    }
  }
  const focus =
    focusTitle && focusCount < tracked.length
      ? `Next week, tighten one thing: “${focusTitle}”. It's your highest-leverage gap.`
      : `Next week, hold the line. Consistency at this level compounds quietly.`;

  let headline: string;
  if (delta != null && delta >= 5)
    headline = `A stronger week — up ${delta} points. Momentum is real.`;
  else if (delta != null && delta <= -5)
    headline = `A lighter week, down ${Math.abs(
      delta
    )}. Not a setback — a signal to simplify.`;
  else if (avgThis >= 75)
    headline = `A strong, steady week. This is what good looks like.`;
  else headline = `A solid week of showing up. That's the whole game.`;

  return {
    headline,
    statLine: `${avgThis} avg${
      avgPrev != null ? ` · last week ${avgPrev}` : ""
    }`,
    wins,
    focus,
    delta,
  };
}


/** Due-aware ordering helper for the live timeline. */
export function dueRank(
  it: TimelineItem,
  settings: { wakeTime: string; bedtime: string }
): number {
  const m = effectiveMinutes(it, settings);
  if (m == null) return 9999; // anytime — lowest urgency
  const diff = m - nowMinutes();
  // overdue (negative) and near-future rank highest (smallest)
  return diff < 0 ? -diff * 0.4 : diff;
}
