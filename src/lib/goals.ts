/**
 * goals.ts — derived progress for outcome goals and self-experiments.
 *
 * Same honesty rules as analytics.ts / metrics.ts: progress is computed
 * from real logged data, never stored or fabricated. An experiment refuses
 * a verdict until both its windows carry enough data, and never claims
 * causation — it reports a before/during difference, plainly.
 */
import type { AppState, OutcomeGoal, Experiment, DailyLog } from "./types";
import { getTz, dateKeyInTz, addDaysToKey } from "./tz";
import { calculateStreak, weeklyActiveDays } from "./scoring";
import { getVacationDates } from "./storage";
import { biomarkerDef } from "./biomarkers";
import { sleepDurationMinutes } from "./metrics";

/** Short unique id for a user-created goal / experiment. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

// ── Outcome goals ─────────────────────────────────────────────────

export interface GoalProgress {
  goal: OutcomeGoal;
  /** Current value (latest biomarker reading / live streak / weekly days). */
  current: number | null;
  start: number;
  target: number;
  /** 0–1 progress from start → target (clamped). */
  pct: number;
  achieved: boolean;
  unit: string;
  detail: string;
}

/** Latest dated reading for a biomarker metric, or null. */
function latestBiomarker(state: AppState, metric: string): number | null {
  let best: { date: string; value: number } | null = null;
  for (const b of state.biomarkers ?? []) {
    if (b.metric !== metric || typeof b.value !== "number") continue;
    if (!best || b.date > best.date) best = { date: b.date, value: b.value };
  }
  return best ? best.value : null;
}

export function goalProgress(state: AppState, goal: OutcomeGoal): GoalProgress {
  const target = goal.target;
  let current: number | null = null;
  let start = goal.startValue ?? 0;
  let unit = "days";
  let detail = "";
  // Which direction is "good" — used only for the degenerate denom===0 case
  // (target===start), where the start→target vector can't encode direction.
  // Streak / weekly-active are higher-is-better; biomarker comes from its def.
  let betterHigher = true;

  if (goal.kind === "biomarker" && goal.metric) {
    const def = biomarkerDef(goal.metric);
    unit = def?.unit ?? "";
    betterHigher = def?.direction !== "lower";
    current = latestBiomarker(state, goal.metric);
    // Anchor: the value when the goal was set; fall back to current so a
    // missing anchor degrades gracefully instead of dividing by zero.
    start = goal.startValue ?? current ?? target;
  } else if (goal.kind === "streak") {
    current = calculateStreak(
      state.dailyLogs ?? [],
      getVacationDates(state),
      state.settings
    );
    start = 0;
  } else if (goal.kind === "weeklyActive") {
    current = weeklyActiveDays(state.dailyLogs ?? [], state.settings);
    start = 0;
    unit = "/wk";
  }

  // Progress along the user's own start→target vector — direction-agnostic,
  // so "lower is better" (resting HR) and "higher is better" (HRV) both work.
  const denom = target - start;
  let pct: number;
  let achieved: boolean;
  if (current == null) {
    pct = 0;
    achieved = false;
  } else if (denom === 0) {
    // Already at the anchor value === target: "achieved" depends on the
    // goal's own direction, not the (zero) start→target vector.
    achieved = betterHigher ? current >= target : current <= target;
    pct = achieved ? 1 : 0;
  } else {
    pct = Math.max(0, Math.min(1, (current - start) / denom));
    achieved = denom > 0 ? current >= target : current <= target;
  }

  if (current == null) {
    detail =
      goal.kind === "biomarker"
        ? "Log a reading on Body trends to start tracking this."
        : "Keep showing up — progress appears as you log.";
  } else if (achieved) {
    detail = "Reached. Beautifully done.";
  } else {
    const remaining = Math.abs(target - current);
    const rounded =
      remaining >= 10 ? Math.round(remaining) : Math.round(remaining * 10) / 10;
    detail =
      goal.kind === "biomarker"
        ? `${rounded} ${unit} to target.`
        : `${Math.max(0, Math.ceil(remaining))} ${
            goal.kind === "streak" ? "more day" : "more active day"
          }${Math.ceil(remaining) === 1 ? "" : "s"} to go.`;
  }

  return { goal, current, start, target, pct, achieved, unit, detail };
}

// ── Self-experiments ──────────────────────────────────────────────

const EXP_METRIC_LABEL: Record<Experiment["metric"], string> = {
  sleepQuality: "Sleep quality",
  energy: "Energy",
  mood: "Mood",
  sleepDuration: "Sleep duration",
};

const EXP_METRIC_UNIT: Record<Experiment["metric"], string> = {
  sleepQuality: "/5",
  energy: "/5",
  mood: "/5",
  sleepDuration: "h",
};

function expMetricValue(log: DailyLog, metric: Experiment["metric"]): number | null {
  if (metric === "sleepQuality") return log.sleepLog?.sleepQuality ?? null;
  if (metric === "energy") return log.energyLevel;
  if (metric === "mood") return log.moodLevel;
  const dur = sleepDurationMinutes(log);
  return dur == null ? null : dur / 60;
}

export interface ExperimentReadout {
  exp: Experiment;
  metricLabel: string;
  unit: string;
  baselineAvg: number | null;
  duringAvg: number | null;
  delta: number | null;
  nBaseline: number;
  nDuring: number;
  enough: boolean;
  active: boolean;
  daysLeft: number;
  verdict: "better" | "worse" | "no-change" | "inconclusive";
  summary: string;
}

export function experimentReadout(
  state: AppState,
  exp: Experiment
): ExperimentReadout {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const logs = state.dailyLogs ?? [];

  const baseFrom = addDaysToKey(exp.startDate, -exp.baselineDays);
  const baseTo = addDaysToKey(exp.startDate, -1);
  const duringTo = today < exp.endDate ? today : exp.endDate;

  const collect = (from: string, to: string): number[] =>
    logs
      .filter((l) => l.date >= from && l.date <= to)
      .map((l) => expMetricValue(l, exp.metric))
      .filter((v): v is number => v != null);

  const baseVals = collect(baseFrom, baseTo);
  const duringVals = collect(exp.startDate, duringTo);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const baselineAvg = mean(baseVals);
  const duringAvg = mean(duringVals);
  const enough = baseVals.length >= 4 && duringVals.length >= 4;
  const delta =
    baselineAvg != null && duringAvg != null
      ? Math.round((duringAvg - baselineAvg) * 100) / 100
      : null;

  const concluded = !!exp.concludedAt;
  const active = !concluded && today <= exp.endDate;
  // Epoch-day index for a YYYY-MM-DD key. NOTE: Date.UTC's month arg is
  // 0-based, so we must pass m-1 — passing the raw 1-based month shifts both
  // dates ~1 month and, across a month boundary, the shift doesn't cancel
  // (off by several days). This helper makes the difference correct.
  const epochDay = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  const daysLeft = Math.max(0, epochDay(exp.endDate) - epochDay(today));

  const thresh = 0.3; // both /5 scales and hours: ~a third of a point/hour
  let verdict: ExperimentReadout["verdict"];
  if (!enough || delta == null) verdict = "inconclusive";
  else if (delta >= thresh) verdict = "better";
  else if (delta <= -thresh) verdict = "worse";
  else verdict = "no-change";

  const unit = EXP_METRIC_UNIT[exp.metric];
  const label = EXP_METRIC_LABEL[exp.metric];
  let summary: string;
  if (verdict === "inconclusive") {
    summary = enough
      ? "Not enough difference to call yet."
      : `Need ~4 check-ins each side to compare (${baseVals.length} before, ${duringVals.length} during so far).`;
  } else if (verdict === "better") {
    summary = `${label} averaged ${Math.abs(delta!)}${unit} higher during the test than your baseline. Can't prove the change caused it, but it's a promising sign.`;
  } else if (verdict === "worse") {
    summary = `${label} averaged ${Math.abs(delta!)}${unit} lower during the test than your baseline. Might be the change, might be something else — worth a closer look.`;
  } else {
    summary = `${label} barely moved (${delta! >= 0 ? "+" : ""}${delta}${unit}). No clear difference either way.`;
  }

  return {
    exp,
    metricLabel: label,
    unit,
    baselineAvg: baselineAvg == null ? null : Math.round(baselineAvg * 10) / 10,
    duringAvg: duringAvg == null ? null : Math.round(duringAvg * 10) / 10,
    delta,
    nBaseline: baseVals.length,
    nDuring: duringVals.length,
    enough,
    active,
    daysLeft,
    verdict,
    summary,
  };
}
