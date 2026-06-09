import { SCORE_WEIGHTS } from "./constants";
import { addDaysToKey, dateKeyInTz, getTz } from "./tz";
import type { AppState, DailyLog, ProtocolItem, UserSettings } from "./types";

/**
 * Calculate the daily score (0-100) for a given day's log.
 *
 * The score now aggregates per-pillar scores:
 * - Sleep: % of checklist items completed
 * - Exercise: % of exercises completed
 * - Nutrition: scorecard answers
 * - Supplements: % taken
 * Plus bonuses for sleep data logging and notes.
 */
export function calculateDailyScore(
  log: DailyLog,
  _enabledItems: ProtocolItem[],
  _settings: UserSettings
): number {
  // Per-pillar scores (already calculated in storage.ts recalculate)
  const pillarScores = log.pillarScores || {
    sleep: 0,
    exercise: 0,
    nutrition: 0,
    supplements: 0,
  };

  // Count active pillars (ones with items to track)
  const activePillars: number[] = [];
  if (log.sleepCompletions.length > 0) activePillars.push(pillarScores.sleep);
  if (log.exerciseEntries.length > 0) activePillars.push(pillarScores.exercise);
  // Nutrition always counts (scorecard)
  activePillars.push(pillarScores.nutrition);
  if (log.supplementEntries.length > 0) activePillars.push(pillarScores.supplements);

  if (activePillars.length === 0) return 0;

  // Base: average of active pillar scores (0-100) → scaled to 80 points
  const avgPillar =
    activePillars.reduce((sum, s) => sum + s, 0) / activePillars.length;
  const baseScore = (avgPillar / 100) * SCORE_WEIGHTS.completionBase;

  // Sleep log bonus (+5)
  const hasSleepData =
    log.sleepLog.actualBedtime !== null ||
    log.sleepLog.actualWakeTime !== null ||
    log.sleepLog.sleepQuality !== null;
  const sleepBonus = hasSleepData ? SCORE_WEIGHTS.sleepLogBonus : 0;

  // Mood/energy bonus (+5 each, combined into 10 replacing morning/evening)
  const hasWellness = log.energyLevel !== null || log.moodLevel !== null;
  const wellnessBonus = hasWellness ? 10 : 0;

  // Note bonus (+5)
  const hasNote =
    log.dayNote.trim().length > 0 ||
    log.nutritionScorecard.note.trim().length > 0 ||
    log.exerciseEntries.some((e) => e.note.trim().length > 0);
  const noteBonus = hasNote ? SCORE_WEIGHTS.noteBonus : 0;

  const total = baseScore + sleepBonus + wellnessBonus + noteBonus;
  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Calculate the current streak: consecutive days (ending today or yesterday)
 * where any tracking activity occurred.
 *
 * @param vacationDates — set of YYYY-MM-DD strings the user was in
 * vacation mode. Treated as "transparent" days: the streak walks through
 * them as if they weren't there. A 5-day streak that takes a 3-day
 * vacation and resumes is still a 5-day streak (the vacation isn't
 * counted up OR counted as broken).
 */
export function calculateStreak(
  logs: DailyLog[],
  vacationDates?: Set<string>,
  /**
   * Caller can pass settings so the "today / yesterday" anchor uses
   * the user's tz (matches the rest of the engine, which is tz-aware
   * via dateKeyInTz). When omitted, falls back to device-local
   * midnight — the previous behavior, kept as default for callers
   * (tests, legacy paths) that don't have settings handy.
   */
  settings?: UserSettings
): number {
  if (logs.length === 0) return 0;

  let sorted = [...logs]
    .filter((log) => hasAnyActivity(log))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return 0;

  // Anchor today/yesterday in the user's tz when settings provided —
  // a traveler crossing midnight in another tz shouldn't see their
  // streak flicker because the device clock rolled over earlier
  // than the engine's stored YYYY-MM-DD keys. Falls back to device-
  // local for backward compatibility.
  let todayStr: string;
  let yesterdayStr: string;
  if (settings) {
    todayStr = dateKeyInTz(getTz(settings));
    yesterdayStr = addDaysToKey(todayStr, -1);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    todayStr = formatDateKey(today);
    yesterdayStr = formatDateKey(yesterday);
  }

  // Ignore future-dated logs (clock-skew / westward-tz artifact). Without
  // this, a stray "tomorrow"-key log sorts to the head, fails the
  // today/yesterday/two-ago head check, and zeroes a streak the user has
  // faithfully earned (sweep 2026-06-09 HIGH #8). normalize() also clamps
  // these at load; this guards any other source (raw cloud row, merge, test).
  sorted = sorted.filter((l) => l.date <= todayStr);
  if (sorted.length === 0) return 0;

  // Allow vacation days to count as "current" for the head check —
  // a user who's been on vacation today shouldn't have their streak
  // displayed as 0.
  const isVacation = (s: string) => vacationDates?.has(s) === true;
  // When settings is supplied (tz-aware caller), grant a 2-day head
  // grace instead of 1. A forward tz crossing (PST → Tokyo, +16h)
  // makes "yesterday in destination tz" = 2 calendar days after the
  // last log written in source tz. Without this grace, the streak
  // collapses to 0 the moment a traveler lands — visible UX bug
  // surfaced by the shift-and-travel persona. The expanded grace
  // only kicks in for tz-aware callers (settings provided); legacy
  // callers without settings keep the strict 1-day check.
  const twoAgoStr = settings ? addDaysToKey(todayStr, -2) : null;
  const headOk =
    sorted[0].date === todayStr ||
    sorted[0].date === yesterdayStr ||
    (twoAgoStr !== null && sorted[0].date === twoAgoStr) ||
    isVacation(todayStr) ||
    isVacation(yesterdayStr);
  if (!headOk) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(sorted[0].date + "T00:00:00");
  let usedGrace = false; // forgive one missed day so a single slip

  for (let i = 1; i < sorted.length; i++) {
    // Skip backward through vacation days — they're transparent.
    let expectedPrev = new Date(currentDate);
    expectedPrev.setDate(expectedPrev.getDate() - 1);
    while (isVacation(formatDateKey(expectedPrev))) {
      expectedPrev.setDate(expectedPrev.getDate() - 1);
    }
    const expectedStr = formatDateKey(expectedPrev);

    if (sorted[i].date === expectedStr) {
      streak++;
      currentDate = expectedPrev;
      continue;
    }

    // One-day grace: a single missing day between active days is forgiven.
    const graceDay = new Date(expectedPrev);
    graceDay.setDate(graceDay.getDate() - 1);
    if (!usedGrace && sorted[i].date === formatDateKey(graceDay)) {
      usedGrace = true;
      streak++;
      currentDate = graceDay;
      continue;
    }
    break;
  }

  return streak;
}

/** Active days within the trailing 7-day window (for weekly goals).
 *  Pass `settings` to anchor the window in the user's saved tz (matches the
 *  rest of Today/streak); without it, falls back to device-local. */
export function weeklyActiveDays(
  logs: DailyLog[],
  settings?: UserSettings
): number {
  const keys = new Set(
    logs.filter((l) => hasAnyActivity(l)).map((l) => l.date)
  );
  let n = 0;
  if (settings) {
    const today = dateKeyInTz(getTz(settings));
    for (let i = 0; i < 7; i++) {
      if (keys.has(addDaysToKey(today, -i))) n++;
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (keys.has(formatDateKey(d))) n++;
    }
  }
  return n;
}

/**
 * Streak-freeze bank. A small, self-replenishing monthly allowance of
 * "freeze" tokens the user can spend to protect their streak on a genuinely
 * off day — softer than a planned rest day, no all-or-nothing pressure. A
 * spent day is unioned into getVacationDates, so calculateStreak walks
 * through it transparently (bridges the gap; never counts up OR breaks).
 *
 * Model: a rolling 30-day allowance (not a hoardable bank), so it can never
 * get permanently stuck at zero — used tokens "expire" out of the window.
 * Base 2/month, +1 once the user has real history (≥60 active days ever).
 */
export const FREEZE_WINDOW_DAYS = 30;
export const FREEZE_BASE_ALLOWANCE = 2;

export interface FreezeStatus {
  allowance: number;
  usedRecent: number;
  available: number;
  windowDays: number;
}

export function freezeStatus(state: AppState): FreezeStatus {
  const settings = state.settings;
  const today = dateKeyInTz(getTz(settings));
  const floor = addDaysToKey(today, -(FREEZE_WINDOW_DAYS - 1));
  // Dedupe defensively — a date should only ever cost one token even if it
  // somehow appears twice (e.g. a cross-device merge before the union fix).
  const used = new Set(
    (settings.usedFreezeDates ?? []).filter((d) => d >= floor && d <= today)
  ).size;
  const activeTotal = (state.dailyLogs ?? []).filter(hasAnyActivity).length;
  const allowance = FREEZE_BASE_ALLOWANCE + (activeTotal >= 60 ? 1 : 0);
  return {
    allowance,
    usedRecent: used,
    available: Math.max(0, allowance - used),
    windowDays: FREEZE_WINDOW_DAYS,
  };
}

/** Check if a daily log has any meaningful activity */
export function hasAnyActivity(log: DailyLog): boolean {
  const hasSleep = log.sleepCompletions.some((c) => c.completed);
  const hasExercise = log.exerciseEntries.some((e) => e.completed);
  const hasNutrition = Object.values(log.nutritionScorecard).some(
    (v) => v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)
  );
  const hasSupplements = log.supplementEntries.some((s) => s.taken || s.skipped);
  // Live supplement model (supplementCompletions/supplementSkips). The legacy
  // `supplementEntries` check above never sees it, so a supplement-only user
  // who takes their stack every day was counted as having done NOTHING —
  // streak, weekly goal, freeze bank and the cold-start countdown all frozen
  // at zero despite perfect adherence (sweep 2026-06-09 HIGH #9).
  const hasSuppLive =
    Object.values(log.supplementCompletions ?? {}).some(Boolean) ||
    (log.supplementSkips?.length ?? 0) > 0;
  const hasLegacy = log.completions.some((c) => c.completedAt !== null);
  // The Protocol-OS timeline is the actual product surface — a day with
  // any behavior completed (or a check-in) is unambiguously "active".
  // Without this the streak never accrues for real users.
  const hasBehavior = Object.values(log.behaviorCompletions ?? {}).some(
    Boolean
  );
  const hasCheckin =
    log.sleepLog?.sleepQuality != null || log.energyLevel != null;

  return (
    hasSleep ||
    hasExercise ||
    hasNutrition ||
    hasSupplements ||
    hasSuppLive ||
    hasLegacy ||
    hasBehavior ||
    hasCheckin
  );
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
