/**
 * analytics.ts — derived, motivational analytics built on the daily log
 * history. These power the Insights "records / milestones / on-this-day /
 * when-you're-consistent / pillar deep-dives / correlation" surfaces and the
 * Today milestone moment.
 *
 * Design rules (consistent with metrics.ts / intel.ts):
 *   - Never fabricate a number. If there isn't enough signal, return null /
 *     an `insufficient` shape and let the UI show a calm cold-start state.
 *   - "Active day" means the SAME thing the live streak means (hasAnyActivity)
 *     so a "longest streak" record can never contradict the streak on screen.
 *   - "Completions" counts checked behaviors + supplements for the day.
 *   - All day math is timezone-aware via the saved tz (dateKeyInTz / addDays).
 */
import type {
  AppState,
  DailyLog,
  Pillar,
  TimeBlock,
  UserSettings,
} from "./types";
import { getTz, dateKeyInTz, addDaysToKey, dayIndexOfKeyInTz } from "./tz";
import { calculateStreak, hasAnyActivity, weeklyActiveDays } from "./scoring";
import { pillarScore, sleepDurationMinutes, PILLAR_LIST } from "./metrics";
import { getVacationDates } from "./storage";
import { compileTimeline } from "./engine";
import { listBehaviorAtoms } from "./packs";
import { biomarkerDef } from "./biomarkers";

// ── small shared helpers ──────────────────────────────────────────

/** Behaviors + supplements checked off on a given day. Ad-hoc one-off keys
 *  ("oneoff:…") are excluded — they're today-only extras and must not inflate
 *  lifetime milestones or consistency stats. */
export function completionsOnLog(log: DailyLog): number {
  return (
    Object.entries(log.behaviorCompletions ?? {}).filter(
      ([k, v]) => v && !k.startsWith("oneoff:")
    ).length +
    Object.values(log.supplementCompletions ?? {}).filter(Boolean).length
  );
}

function sortedAsc(logs: DailyLog[]): DailyLog[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

/** Resolve human titles + display blocks for completion keys. */
function behaviorMaps(state: AppState): {
  title: Map<string, string>;
  block: Map<string, TimeBlock>;
} {
  const title = new Map<string, string>();
  const block = new Map<string, TimeBlock>();
  try {
    for (const it of compileTimeline(state, 0)) {
      title.set(it.canonicalKey, it.title);
      block.set(it.canonicalKey, it.block);
      if (it.derivedFrom) {
        title.set(it.derivedFrom, it.title);
        block.set(it.derivedFrom, it.block);
      }
    }
  } catch {
    /* timeline unavailable — fall back to the catalog below */
  }
  try {
    for (const a of listBehaviorAtoms()) {
      if (!title.has(a.canonicalKey)) title.set(a.canonicalKey, a.title);
      if (!block.has(a.canonicalKey)) block.set(a.canonicalKey, a.block);
    }
  } catch {
    /* catalog unavailable */
  }
  return { title, block };
}

function prettifyKey(key: string): string {
  const tail = key.split(":").pop() ?? key;
  return tail
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── 1. Personal records ───────────────────────────────────────────

export interface PersonalRecords {
  /** Longest run of consecutive active days (vacation-transparent). */
  longestStreak: number;
  /** Most active days within any rolling 7-day window (0–7). */
  bestWeek: number;
  /** Habit completed the most times across all history, if any. */
  topBehavior: { title: string; count: number } | null;
  /** Total behaviors+supplements ever checked off. */
  totalCompletions: number;
  /** Distinct active days ever. */
  activeDays: number;
}

export function personalRecords(state: AppState): PersonalRecords {
  const tz = getTz(state.settings);
  const logs = state.dailyLogs ?? [];
  const vac = getVacationDates(state);

  const activeKeys = sortedAsc(logs.filter(hasAnyActivity)).map((l) => l.date);
  const activeSet = new Set(activeKeys);

  // Longest consecutive run, treating vacation days as transparent.
  let longestStreak = 0;
  if (activeKeys.length) {
    let run = 0;
    let cursor: string | null = null;
    for (const key of activeKeys) {
      if (cursor === null) {
        run = 1;
      } else {
        // Walk from the day after `cursor` to `key`; the gap is OK only if
        // every in-between day was a vacation day.
        let probe = addDaysToKey(cursor, 1);
        let bridged = true;
        while (probe < key) {
          if (!vac.has(probe)) {
            bridged = false;
            break;
          }
          probe = addDaysToKey(probe, 1);
        }
        run = probe === key && bridged ? run + 1 : 1;
      }
      cursor = key;
      if (run > longestStreak) longestStreak = run;
    }
  }
  // Never let the record read lower than the current (grace-forgiven) streak.
  longestStreak = Math.max(
    longestStreak,
    calculateStreak(logs, vac, state.settings)
  );

  // Best rolling 7-day active-day count.
  let bestWeek = 0;
  if (activeKeys.length) {
    const today = dateKeyInTz(tz);
    let end = activeKeys[activeKeys.length - 1];
    if (today > end) end = today; // include the trailing window up to today
    // Cap the scan to the last ~2 years for safety on very long histories.
    let start = activeKeys[0];
    const floor = addDaysToKey(end, -729);
    if (start < floor) start = floor;
    for (let d = start; d <= end; d = addDaysToKey(d, 1)) {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        if (activeSet.has(addDaysToKey(d, -i))) count++;
      }
      if (count > bestWeek) bestWeek = count;
      if (bestWeek === 7) break;
    }
  }

  // Most-completed habit + totals.
  const counts = new Map<string, number>();
  let totalCompletions = 0;
  for (const l of logs) {
    for (const [k, done] of Object.entries(l.behaviorCompletions ?? {})) {
      if (!done) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      totalCompletions++;
    }
    totalCompletions += Object.values(l.supplementCompletions ?? {}).filter(
      Boolean
    ).length;
  }
  let topBehavior: PersonalRecords["topBehavior"] = null;
  if (counts.size) {
    const { title } = behaviorMaps(state);
    let bestKey = "";
    let best = 0;
    for (const [k, c] of counts) {
      if (c > best) {
        best = c;
        bestKey = k;
      }
    }
    topBehavior = { title: title.get(bestKey) ?? prettifyKey(bestKey), count: best };
  }

  return {
    longestStreak,
    bestWeek,
    topBehavior,
    totalCompletions,
    activeDays: activeSet.size,
  };
}

// ── 2. Milestones & moments ───────────────────────────────────────

export interface Milestone {
  id: string;
  kind: "streak" | "active" | "completions";
  threshold: number;
  /** Headline shown in the celebration moment. */
  headline: string;
  /** One-line, shareable body. */
  body: string;
}

const STREAK_TIERS = [7, 14, 30, 60, 100, 200, 365];
const ACTIVE_TIERS = [10, 30, 50, 100, 200, 365];
const COMPLETION_TIERS = [50, 100, 250, 500, 1000, 2500];

function activeDaysUpTo(logs: DailyLog[], lastKey: string): number {
  let n = 0;
  for (const l of logs)
    if (l.date <= lastKey && hasAnyActivity(l)) n++;
  return n;
}
function completionsUpTo(logs: DailyLog[], lastKey: string): number {
  let n = 0;
  for (const l of logs) if (l.date <= lastKey) n += completionsOnLog(l);
  return n;
}

function milestoneFor(
  kind: Milestone["kind"],
  threshold: number
): Milestone {
  if (kind === "streak")
    return {
      id: `streak-${threshold}`,
      kind,
      threshold,
      headline: `${threshold}-day streak`,
      body:
        threshold >= 100
          ? `${threshold} days running. This is who you are now.`
          : `${threshold} days in a row. The habit is carrying you now.`,
    };
  if (kind === "active")
    return {
      id: `active-${threshold}`,
      kind,
      threshold,
      headline: `${threshold} active days`,
      body: `${threshold} days you chose to show up. They compound.`,
    };
  return {
    id: `completions-${threshold}`,
    kind,
    threshold,
    headline: `${threshold} done`,
    body: `${threshold} behaviors completed. Small acts, stacked high.`,
  };
}

/**
 * The single most significant milestone the user crossed *today* (the metric
 * was below the threshold as of yesterday and is at/above it today). Returns
 * null if nothing was freshly crossed — so existing users who passed a mark
 * long ago never get a stale "100 days!" pop. Already-celebrated ids (stored
 * in settings) are filtered so it doesn't re-appear on reload the same day.
 */
export function freshMilestone(state: AppState): Milestone | null {
  const logs = state.dailyLogs ?? [];
  if (!logs.length) return null;
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const yesterday = addDaysToKey(today, -1);
  const vac = getVacationDates(state);
  const celebrated = new Set(state.settings.celebratedMilestones ?? []);

  const logsToYesterday = logs.filter((l) => l.date <= yesterday);

  const candidates: Milestone[] = [];

  // Streak (uses the live definition; "yesterday" view drops today's log).
  const streakToday = calculateStreak(logs, vac, state.settings);
  const streakYest = calculateStreak(logsToYesterday, vac, state.settings);
  for (const t of STREAK_TIERS)
    if (streakYest < t && streakToday >= t)
      candidates.push(milestoneFor("streak", t));

  // Active days.
  const activeToday = activeDaysUpTo(logs, today);
  const activeYest = activeDaysUpTo(logs, yesterday);
  for (const t of ACTIVE_TIERS)
    if (activeYest < t && activeToday >= t)
      candidates.push(milestoneFor("active", t));

  // Completions.
  const compToday = completionsUpTo(logs, today);
  const compYest = completionsUpTo(logs, yesterday);
  for (const t of COMPLETION_TIERS)
    if (compYest < t && compToday >= t)
      candidates.push(milestoneFor("completions", t));

  const fresh = candidates.filter((m) => !celebrated.has(m.id));
  if (!fresh.length) return null;
  // Highest threshold wins; streak breaks ties (most emotionally resonant).
  fresh.sort((a, b) => {
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    const rank = { streak: 0, active: 1, completions: 2 } as const;
    return rank[a.kind] - rank[b.kind];
  });
  return fresh[0];
}

/** All milestone tiers the user has reached (for an Insights record strip). */
export function achievedMilestones(state: AppState): Milestone[] {
  const logs = state.dailyLogs ?? [];
  if (!logs.length) return [];
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const vac = getVacationDates(state);
  const streak = calculateStreak(logs, vac, state.settings);
  const active = activeDaysUpTo(logs, today);
  const comp = completionsUpTo(logs, today);
  const out: Milestone[] = [];
  for (const t of STREAK_TIERS) if (streak >= t) out.push(milestoneFor("streak", t));
  for (const t of ACTIVE_TIERS) if (active >= t) out.push(milestoneFor("active", t));
  for (const t of COMPLETION_TIERS)
    if (comp >= t) out.push(milestoneFor("completions", t));
  return out;
}

// ── 3. On this day ────────────────────────────────────────────────

export interface OnThisDay {
  title: string;
  /** "a month ago", "3 months ago", "a year ago". */
  ago: string;
  daysAgo: number;
}

const LOOKBACKS: { days: number; label: string }[] = [
  { days: 365, label: "a year ago" },
  { days: 182, label: "6 months ago" },
  { days: 90, label: "3 months ago" },
  { days: 30, label: "a month ago" },
];

/**
 * A still-active habit whose first-ever completion lands on a lookback
 * anniversary (±3 days). Prefers the longest-ago anniversary. "Still active"
 * means completed at least once in the trailing 14 days.
 */
export function onThisDay(state: AppState): OnThisDay | null {
  const logs = state.dailyLogs ?? [];
  if (logs.length < 8) return null;
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const recentFloor = addDaysToKey(today, -14);

  // First completion date + recent activity per behavior key.
  const firstSeen = new Map<string, string>();
  const recent = new Set<string>();
  for (const l of sortedAsc(logs)) {
    for (const [k, done] of Object.entries(l.behaviorCompletions ?? {})) {
      if (!done) continue;
      if (!firstSeen.has(k)) firstSeen.set(k, l.date);
      if (l.date >= recentFloor) recent.add(k);
    }
  }
  if (!firstSeen.size) return null;

  const { title } = behaviorMaps(state);
  for (const { days, label } of LOOKBACKS) {
    const target = addDaysToKey(today, -days);
    const lo = addDaysToKey(target, -3);
    const hi = addDaysToKey(target, 3);
    for (const [k, first] of firstSeen) {
      if (first >= lo && first <= hi && recent.has(k)) {
        return { title: title.get(k) ?? prettifyKey(k), ago: label, daysAgo: days };
      }
    }
  }
  return null;
}

// ── 4. When you're consistent ─────────────────────────────────────

export interface ConsistencyWindows {
  /** avg completions per logged day, indexed Mon=0..Sun=6. null = no sample. */
  byWeekday: (number | null)[];
  /** share of completions by block (sums ~1 across blocks with data). */
  byBlock: { block: TimeBlock; share: number; count: number }[];
  strongestWeekday: number | null;
  weakestWeekday: number | null;
  /** Enough history + a meaningful spread to be worth showing. */
  confident: boolean;
  loggedDays: number;
}

const BLOCK_ORDER: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

export function consistencyWindows(state: AppState): ConsistencyWindows {
  const tz = getTz(state.settings);
  const logs = (state.dailyLogs ?? []).filter(hasAnyActivity);
  const { block } = behaviorMaps(state);

  const wdSum = new Array(7).fill(0);
  const wdDays = new Array(7).fill(0);
  const blockCount = new Map<TimeBlock, number>();

  for (const l of logs) {
    const wd = dayIndexOfKeyInTz(tz, l.date);
    wdDays[wd]++;
    wdSum[wd] += completionsOnLog(l);
    for (const [k, done] of Object.entries(l.behaviorCompletions ?? {})) {
      if (!done) continue;
      const b = block.get(k) ?? "anytime";
      blockCount.set(b, (blockCount.get(b) ?? 0) + 1);
    }
  }

  const byWeekday = wdSum.map((s, i) => (wdDays[i] > 0 ? s / wdDays[i] : null));
  const sampled = byWeekday
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  let strongestWeekday: number | null = null;
  let weakestWeekday: number | null = null;
  if (sampled.length >= 2) {
    strongestWeekday = sampled.reduce((a, b) => (b.v > a.v ? b : a)).i;
    weakestWeekday = sampled.reduce((a, b) => (b.v < a.v ? b : a)).i;
  }

  const totalBlock = [...blockCount.values()].reduce((a, b) => a + b, 0);
  const byBlock = BLOCK_ORDER.filter((b) => (blockCount.get(b) ?? 0) > 0).map(
    (b) => ({
      block: b,
      count: blockCount.get(b) ?? 0,
      share: totalBlock ? (blockCount.get(b) ?? 0) / totalBlock : 0,
    })
  );

  const loggedDays = logs.length;
  const spread =
    strongestWeekday != null && weakestWeekday != null
      ? (byWeekday[strongestWeekday] ?? 0) - (byWeekday[weakestWeekday] ?? 0)
      : 0;
  const confident = loggedDays >= 14 && spread >= 1;

  return {
    byWeekday,
    byBlock,
    strongestWeekday,
    weakestWeekday,
    confident,
    loggedDays,
  };
}

// ── 5. Pillar deep-dives ──────────────────────────────────────────

export interface PillarSummary {
  pillar: Pillar;
  tracked: boolean;
  latest: number | null;
  avg: number | null;
  /** "up" | "down" | "steady" over the window (recent half vs older half). */
  trend: "up" | "down" | "steady" | null;
  series: { label: string; value: number }[];
  guidance: string;
}

const PILLAR_LABEL: Record<Pillar, string> = {
  sleep: "Sleep",
  exercise: "Movement",
  nutrition: "Nutrition",
  supplements: "Supplements",
};

function pillarGuidance(
  p: Pillar,
  trend: "up" | "down" | "steady" | null,
  avg: number | null
): string {
  if (avg == null)
    return `Track ${PILLAR_LABEL[p].toLowerCase()} for a few days and a trend will appear here.`;
  const noun = PILLAR_LABEL[p].toLowerCase();
  if (trend === "up")
    return `Your ${noun} is trending up. Whatever you changed recently, keep it.`;
  if (trend === "down")
    return `Your ${noun} has slipped lately — worth one small, protected fix this week.`;
  if (avg >= 70)
    return `Your ${noun} is steady and strong. This is a foundation, not a project.`;
  return `Your ${noun} is steady. One deliberate nudge could move it up a band.`;
}

export function pillarSummaries(
  state: AppState,
  windowDays = 30
): PillarSummary[] {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const floor = addDaysToKey(today, -(windowDays - 1));
  const logs = sortedAsc(
    (state.dailyLogs ?? []).filter((l) => l.date >= floor && l.date <= today)
  );

  return PILLAR_LIST.map((p) => {
    const points: { label: string; value: number }[] = [];
    for (const l of logs) {
      const v = pillarScore(l, p);
      if (v != null) points.push({ label: l.date.slice(5), value: v });
    }
    const tracked = points.length > 0;
    const latest = tracked ? points[points.length - 1].value : null;
    const avg = tracked
      ? Math.round(points.reduce((a, b) => a + b.value, 0) / points.length)
      : null;
    let trend: PillarSummary["trend"] = null;
    if (points.length >= 4) {
      const mid = Math.floor(points.length / 2);
      const older = points.slice(0, mid);
      const recent = points.slice(mid);
      const oa = older.reduce((a, b) => a + b.value, 0) / older.length;
      const ra = recent.reduce((a, b) => a + b.value, 0) / recent.length;
      const d = ra - oa;
      trend = d >= 6 ? "up" : d <= -6 ? "down" : "steady";
    }
    return {
      pillar: p,
      tracked,
      latest,
      avg,
      trend,
      series: points,
      guidance: pillarGuidance(p, trend, avg),
    };
  });
}

// ── 6. Correlation explorer ───────────────────────────────────────

export type FactorKey =
  | "energy"
  | "mood"
  | "sleepQuality"
  | "sleepDuration"
  | "score"
  | "completions"
  | "sleep"
  | "exercise"
  | "nutrition"
  | "supplements";

export interface FactorDef {
  key: FactorKey;
  label: string;
}

export function listFactors(): FactorDef[] {
  return [
    { key: "energy", label: "Energy" },
    { key: "mood", label: "Mood" },
    { key: "sleepQuality", label: "Sleep quality" },
    { key: "sleepDuration", label: "Sleep duration" },
    { key: "completions", label: "Behaviors done" },
    { key: "score", label: "Daily score" },
    { key: "sleep", label: "Sleep pillar" },
    { key: "exercise", label: "Movement pillar" },
    { key: "nutrition", label: "Nutrition pillar" },
    { key: "supplements", label: "Supplements pillar" },
  ];
}

function factorValue(log: DailyLog, key: FactorKey): number | null {
  switch (key) {
    case "energy":
      return log.energyLevel;
    case "mood":
      return log.moodLevel;
    case "sleepQuality":
      return log.sleepLog?.sleepQuality ?? null;
    case "sleepDuration":
      return sleepDurationMinutes(log);
    case "score":
      return typeof log.score === "number" && log.score > 0 ? log.score : null;
    case "completions": {
      const c = completionsOnLog(log);
      // Only treat days the user actually logged as data points (0 on a
      // fully-untracked day would bias the correlation downward).
      return hasAnyActivity(log) ? c : null;
    }
    case "sleep":
    case "exercise":
    case "nutrition":
    case "supplements":
      return pillarScore(log, key as Pillar);
    default:
      return null;
  }
}

export interface Correlation {
  a: FactorKey;
  b: FactorKey;
  n: number;
  r: number | null;
  strength: "strong" | "moderate" | "weak" | "none";
  direction: "positive" | "negative" | "none";
}

const MIN_PAIRS = 8;

export function correlate(
  logs: DailyLog[],
  a: FactorKey,
  b: FactorKey
): Correlation {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const l of logs) {
    const x = factorValue(l, a);
    const y = factorValue(l, b);
    if (x == null || y == null) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (a === b || n < MIN_PAIRS)
    return { a, b, n, r: null, strength: "none", direction: "none" };

  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    num += ex * ey;
    dx += ex * ex;
    dy += ey * ey;
  }
  if (dx === 0 || dy === 0)
    return { a, b, n, r: null, strength: "none", direction: "none" };
  const r = num / Math.sqrt(dx * dy);
  const abs = Math.abs(r);
  const strength =
    abs >= 0.6 ? "strong" : abs >= 0.4 ? "moderate" : abs >= 0.25 ? "weak" : "none";
  const direction =
    strength === "none" ? "none" : r > 0 ? "positive" : "negative";
  return { a, b, n, r, strength, direction };
}

// ── 7. Monthly report ─────────────────────────────────────────────

export interface MonthlyReport {
  monthLabel: string; // "May 2026"
  monthShort: string; // "May"
  activeDays: number;
  daysElapsed: number;
  pillars: { pillar: Pillar; label: string; avg: number }[];
  topBehaviors: { title: string; count: number }[];
  totalCompletions: number;
}

const MONTH_PILLAR_LABEL: Record<Pillar, string> = {
  sleep: "Sleep",
  exercise: "Movement",
  nutrition: "Nutrition",
  supplements: "Supplements",
};

/** A month-in-review summary for the current calendar month (saved tz). */
export function monthlyReport(state: AppState): MonthlyReport {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const monthKey = today.slice(0, 7); // YYYY-MM
  const logs = (state.dailyLogs ?? []).filter((l) =>
    l.date.startsWith(monthKey)
  );
  const activeDays = logs.filter(hasAnyActivity).length;
  const daysElapsed = Number(today.slice(8, 10));

  const pillars: MonthlyReport["pillars"] = [];
  for (const p of PILLAR_LIST) {
    const vals = logs
      .map((l) => pillarScore(l, p))
      .filter((v): v is number => v != null);
    if (vals.length)
      pillars.push({
        pillar: p,
        label: MONTH_PILLAR_LABEL[p],
        avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      });
  }

  const counts = new Map<string, number>();
  let totalCompletions = 0;
  for (const l of logs) {
    for (const [k, done] of Object.entries(l.behaviorCompletions ?? {})) {
      if (!done) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      totalCompletions++;
    }
    totalCompletions += Object.values(l.supplementCompletions ?? {}).filter(
      Boolean
    ).length;
  }
  const { title } = behaviorMaps(state);
  const topBehaviors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, c]) => ({ title: title.get(k) ?? prettifyKey(k), count: c }));

  const [y, m] = monthKey.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, 1));
  const monthLabel = anchor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthShort = anchor.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return {
    monthLabel,
    monthShort,
    activeDays,
    daysElapsed,
    pillars,
    topBehaviors,
    totalCompletions,
  };
}

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── 8. Trend forecasting ──────────────────────────────────────────
//
// A gentle "if this continues" projection for body metrics that have a
// clear, statistically meaningful trend. Honest by construction: we only
// surface a forecast when there are enough readings, over a long enough
// span, with a strong enough fit (|r|). No fit, no forecast — never a
// fabricated line. We deliberately do NOT forecast behavior scores
// (too noisy day-to-day to project responsibly).

/** Integer day number for a YYYY-MM-DD key (UTC epoch days). */
function dayNum(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Ordinary least-squares fit + Pearson r over (x,y) points. */
function linfit(pts: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r: number;
} | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept, r };
}

export interface BiomarkerForecast {
  metric: string;
  label: string;
  unit: string;
  /** Most recent reading. */
  current: number;
  /** Projected value `horizonDays` out, if the trend holds. */
  projected: number;
  horizonDays: number;
  /** Signed change per week, in metric units. */
  perWeek: number;
  /** Relative to what's healthy for this metric. */
  direction: "improving" | "worsening" | "drifting";
  betterIs: "lower" | "higher" | "range";
  n: number;
  /** Fit strength |r|, 0–1. */
  fit: number;
  /** Calm one-liner. */
  note: string;
}

/**
 * Forecasts for tracked body metrics with a confident linear trend.
 * Returns the strongest few (by fit), or [] when nothing qualifies.
 */
export function biomarkerForecasts(
  state: AppState,
  horizonDays = 30
): BiomarkerForecast[] {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const lookFloor = addDaysToKey(today, -180);

  // Group recent readings by metric (one value per day — last write wins).
  const byMetric = new Map<string, Map<string, number>>();
  for (const b of state.biomarkers ?? []) {
    if (!b?.date || b.date < lookFloor || b.date > today) continue;
    if (typeof b.value !== "number" || !isFinite(b.value)) continue;
    if (!byMetric.has(b.metric)) byMetric.set(b.metric, new Map());
    byMetric.get(b.metric)!.set(b.date, b.value);
  }

  const out: BiomarkerForecast[] = [];
  for (const [metric, dayMap] of byMetric) {
    const def = biomarkerDef(metric);
    if (!def) continue;
    const dates = [...dayMap.keys()].sort();
    if (dates.length < 6) continue; // not enough signal
    const spanDays = dayNum(dates[dates.length - 1]) - dayNum(dates[0]);
    if (spanDays < 21) continue; // readings too clustered to project
    const x0 = dayNum(dates[0]);
    const pts = dates.map((d) => ({ x: dayNum(d) - x0, y: dayMap.get(d)! }));
    const fit = linfit(pts);
    if (!fit) continue;
    const absR = Math.abs(fit.r);
    if (absR < 0.5) continue; // weak/no trend → stay silent

    const current = dayMap.get(dates[dates.length - 1])!;
    const lastX = dayNum(dates[dates.length - 1]) - x0;
    const rawProjected = fit.intercept + fit.slope * (lastX + horizonDays);
    // Clamp the projection to a sane band around observed values so a steep
    // short-term slope can't extrapolate to something physiologically absurd.
    const ys = pts.map((p) => p.y);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = Math.max((hi - lo) * 0.5, Math.abs(current) * 0.15, 1);
    const projected = Math.max(lo - pad, Math.min(hi + pad, rawProjected));
    const perWeek = fit.slope * 7;
    // Ignore trends too small to matter (< ~0.3% of the value per week).
    if (Math.abs(perWeek) < Math.max(Math.abs(current) * 0.003, 0.05)) continue;

    const betterIs = def.direction;
    let direction: BiomarkerForecast["direction"];
    if (betterIs === "range") direction = "drifting";
    else if (betterIs === "lower")
      direction = fit.slope < 0 ? "improving" : "worsening";
    else direction = fit.slope > 0 ? "improving" : "worsening";

    const round = (v: number) =>
      Math.round(v * (def.step && def.step < 1 ? 10 : 1)) /
      (def.step && def.step < 1 ? 10 : 1);
    const rate = `${Math.abs(perWeek) >= 1 ? Math.round(Math.abs(perWeek)) : Math.abs(perWeek).toFixed(1)} ${def.unit}/week`;
    const trendWord = fit.slope > 0 ? "rising" : "falling";
    let note: string;
    if (direction === "drifting") {
      note = `Trending ${trendWord} ~${rate}. About ${round(projected)} ${def.unit} in ${horizonDays} days if it holds.`;
    } else if (direction === "improving") {
      const reachesOptimal =
        betterIs === "lower" ? projected <= def.optimal : projected >= def.optimal;
      note = `Moving the right way — ~${rate}. ${
        reachesOptimal
          ? `On track to reach your optimal range (~${round(projected)} ${def.unit}) within ${horizonDays} days.`
          : `~${round(projected)} ${def.unit} projected in ${horizonDays} days if it holds.`
      }`;
    } else {
      note = `Drifting the wrong way — ~${rate}. Worth one protected fix this month; ~${round(projected)} ${def.unit} projected in ${horizonDays} days if nothing changes.`;
    }

    out.push({
      metric,
      label: def.label,
      unit: def.unit,
      current: round(current),
      projected: round(projected),
      horizonDays,
      perWeek,
      direction,
      betterIs,
      n: dates.length,
      fit: absR,
      note,
    });
  }

  return out.sort((a, b) => b.fit - a.fit).slice(0, 3);
}

// ── 9. "What changed" — week-over-week digest ─────────────────────

export interface WeekChange {
  key: string;
  label: string;
  unit: string;
  now: number;
  prev: number;
  delta: number;
  /** Which direction of change is good for this metric. */
  betterIs: "up" | "down";
  dir: "up" | "down" | "flat";
  good: boolean;
}

export interface WhatChanged {
  hasData: boolean;
  headline: string;
  changes: WeekChange[];
  /** The single most-worth-attention slip, phrased gently. null if none. */
  attention: string | null;
}

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => n != null && isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * Compares the trailing 7 days against the 7 before. Reports the metrics
 * that moved, a calm headline, and the one slip most worth attention.
 * Requires both windows to carry enough samples to be honest.
 */
export function whatChanged(state: AppState): WhatChanged {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const logs = state.dailyLogs ?? [];

  const inWindow = (from: number, to: number) =>
    logs.filter((l) => {
      const lo = addDaysToKey(today, from);
      const hi = addDaysToKey(today, to);
      return l.date >= lo && l.date <= hi;
    });
  const nowLogs = inWindow(-6, 0);
  const prevLogs = inWindow(-13, -7);

  const nowActive = nowLogs.filter(hasAnyActivity);
  const prevActive = prevLogs.filter(hasAnyActivity);
  // Need a comparable amount of real data on both sides.
  if (nowActive.length < 2 || prevActive.length < 2) {
    return { hasData: false, headline: "", changes: [], attention: null };
  }

  const num = (v: number | null) => (v == null ? null : v);
  type Spec = {
    key: string;
    label: string;
    unit: string;
    betterIs: "up" | "down";
    val: (logs: DailyLog[]) => number | null;
    round?: number;
  };
  const specs: Spec[] = [
    {
      key: "active",
      label: "Active days",
      unit: "/wk",
      betterIs: "up",
      val: (ls) => ls.filter(hasAnyActivity).length,
    },
    {
      key: "energy",
      label: "Energy",
      unit: "/5",
      betterIs: "up",
      val: (ls) => num(avg(ls.map((l) => l.energyLevel).filter((v): v is number => v != null))),
      round: 1,
    },
    {
      key: "mood",
      label: "Mood",
      unit: "/5",
      betterIs: "up",
      val: (ls) => num(avg(ls.map((l) => l.moodLevel).filter((v): v is number => v != null))),
      round: 1,
    },
    {
      key: "sleep",
      label: "Sleep",
      unit: "h",
      betterIs: "up",
      val: (ls) => {
        const a = avg(
          ls.map((l) => sleepDurationMinutes(l)).filter((v): v is number => v != null)
        );
        return a == null ? null : a / 60;
      },
      round: 1,
    },
    {
      key: "done",
      label: "Behaviors / day",
      unit: "",
      betterIs: "up",
      val: (ls) => {
        const act = ls.filter(hasAnyActivity);
        return act.length ? avg(act.map(completionsOnLog)) : null;
      },
      round: 1,
    },
  ];

  const changes: WeekChange[] = [];
  for (const s of specs) {
    const now = s.val(nowLogs);
    const prev = s.val(prevLogs);
    if (now == null || prev == null) continue;
    const rnd = (v: number) =>
      s.round ? Math.round(v * 10 ** s.round) / 10 ** s.round : Math.round(v);
    const rNow = rnd(now);
    const rPrev = rnd(prev);
    const delta = Math.round((rNow - rPrev) * 100) / 100;
    const eps = s.round ? 0.1 : 0.5;
    const dir = delta > eps ? "up" : delta < -eps ? "down" : "flat";
    const good = dir === "flat" ? true : dir === s.betterIs;
    changes.push({
      key: s.key,
      label: s.label,
      unit: s.unit,
      now: rNow,
      prev: rPrev,
      delta,
      betterIs: s.betterIs,
      dir,
      good,
    });
  }

  if (!changes.length)
    return { hasData: false, headline: "", changes: [], attention: null };

  // Sort by magnitude of (normalized) movement — biggest movers first.
  const moved = [...changes].filter((c) => c.dir !== "flat");
  moved.sort((a, b) => Math.abs(b.delta / (b.prev || 1)) - Math.abs(a.delta / (a.prev || 1)));

  const ups = changes.filter((c) => c.dir !== "flat" && c.good).length;
  const downs = changes.filter((c) => c.dir !== "flat" && !c.good).length;
  let headline: string;
  if (!moved.length) headline = "A steady week — much like the one before.";
  else if (ups > downs) headline = "A stronger week than the last.";
  else if (downs > ups) headline = "A lighter week than the last — that's okay.";
  else headline = "A mixed week — some up, some down.";

  const slip = moved.find((c) => !c.good) ?? null;
  const attention = slip
    ? `${slip.label} eased off this week (${slip.prev}${slip.unit} → ${slip.now}${slip.unit}). One small, protected nudge could bring it back.`
    : null;

  return { hasData: true, headline, changes, attention };
}

// ── 10. Anonymous benchmarks (built-in reference, not peer data) ──
//
// Honest framing: this compares the user's consistency to a FIXED,
// built-in reference range for habit-tracking — NOT to other users' data
// (we never collect or share that). It's computed entirely on-device. The
// UI must say "a typical range" and footnote that it isn't peer data.

/** Linear-interpolate a percentile from monotonic (value, percentile) anchors. */
function pctFromAnchors(
  anchors: [number, number][],
  value: number
): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, p0] = anchors[i - 1];
    const [x1, p1] = anchors[i];
    if (value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return Math.round(p0 + t * (p1 - p0));
    }
  }
  return last[1];
}

function bandFor(pct: number): "top" | "above" | "typical" | "building" {
  if (pct >= 80) return "top";
  if (pct >= 60) return "above";
  if (pct >= 35) return "typical";
  return "building";
}

export interface Benchmark {
  key: string;
  label: string;
  value: number;
  unit: string;
  percentile: number;
  band: "top" | "above" | "typical" | "building";
  note: string;
}

export interface Benchmarks {
  items: Benchmark[];
  loggedDays: number;
  /** Enough history to compare honestly. */
  confident: boolean;
}

const BAND_NOTE: Record<Benchmark["band"], string> = {
  top: "Top tier — you're more consistent than most people ever get.",
  above: "Above the typical range. The habit is clearly holding.",
  typical: "Right in the typical range. Steady, sustainable territory.",
  building: "Still building. Every active day moves this up.",
};

/**
 * Where the user falls within a built-in reference range for consistency.
 * Reference curves are fixed (not peer data) — the UI labels them as such.
 * Returns confident:false until there's ~2 weeks of history.
 */
export function benchmarks(state: AppState): Benchmarks {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const logs = state.dailyLogs ?? [];
  const active = logs.filter(hasAnyActivity);
  const loggedDays = active.length;

  const items: Benchmark[] = [];

  // 30-day consistency: share of the last 30 days that were active.
  const floor30 = addDaysToKey(today, -29);
  const active30 = active.filter((l) => l.date >= floor30 && l.date <= today).length;
  const consistency = Math.round((active30 / 30) * 100);
  items.push({
    key: "consistency",
    label: "30-day consistency",
    value: consistency,
    unit: "%",
    percentile: pctFromAnchors(
      [
        [10, 8],
        [30, 30],
        [50, 50],
        [70, 70],
        [85, 85],
        [95, 95],
        [100, 99],
      ],
      consistency
    ),
    band: "typical",
    note: "",
  });

  // Weekly active days (trailing 7).
  const wk = weeklyActiveDays(logs, state.settings);
  items.push({
    key: "weekly",
    label: "Active days this week",
    value: wk,
    unit: "/7",
    percentile: pctFromAnchors(
      [
        [0, 5],
        [2, 25],
        [3, 45],
        [4, 60],
        [5, 75],
        [6, 88],
        [7, 97],
      ],
      wk
    ),
    band: "typical",
    note: "",
  });

  // Behaviors completed per active day (last 30).
  const recent = active.filter((l) => l.date >= floor30 && l.date <= today);
  const perDay = recent.length
    ? Math.round((recent.reduce((s, l) => s + completionsOnLog(l), 0) / recent.length) * 10) / 10
    : 0;
  if (perDay > 0) {
    items.push({
      key: "perday",
      label: "Behaviors per day",
      value: perDay,
      unit: "",
      percentile: pctFromAnchors(
        [
          [0.5, 10],
          [1.5, 35],
          [2.5, 55],
          [4, 72],
          [6, 86],
          [9, 96],
        ],
        perDay
      ),
      band: "typical",
      note: "",
    });
  }

  for (const it of items) {
    it.band = bandFor(it.percentile);
    it.note = BAND_NOTE[it.band];
  }

  return { items, loggedDays, confident: loggedDays >= 14 };
}
