import { SCORE_WEIGHTS } from "./constants";
import type { DailyLog, ProtocolItem, UserSettings } from "./types";
import { calculateDisplayTime, deriveTimeOfDay } from "./timing";

/**
 * Calculate the daily score (0-100) for a given day's log.
 *
 * Breakdown:
 * - Base: (completed / total enabled) * 80 points
 * - +5 for logging sleep data (bedtime or wake time or quality)
 * - +5 for completing all morning items
 * - +5 for completing all evening items
 * - +5 for adding at least one note (item note or day note)
 */
export function calculateDailyScore(
  log: DailyLog,
  enabledItems: ProtocolItem[],
  settings: UserSettings
): number {
  if (enabledItems.length === 0) return 0;

  // Base score: completion rate * 80
  const completedCount = log.completions.filter(
    (c) => c.completedAt !== null && !c.skipped
  ).length;
  const baseScore =
    (completedCount / enabledItems.length) * SCORE_WEIGHTS.completionBase;

  // Sleep log bonus
  const hasSleepData =
    log.sleepLog.actualBedtime !== null ||
    log.sleepLog.actualWakeTime !== null ||
    log.sleepLog.sleepQuality !== null;
  const sleepBonus = hasSleepData ? SCORE_WEIGHTS.sleepLogBonus : 0;

  // Morning completion bonus
  const morningItems = enabledItems.filter((item) => {
    const time = calculateDisplayTime(item, settings);
    return deriveTimeOfDay(time) === "morning";
  });
  const morningCompleted =
    morningItems.length > 0 &&
    morningItems.every((item) =>
      log.completions.some(
        (c) => c.itemId === item.id && c.completedAt !== null
      )
    );
  const morningBonus = morningCompleted
    ? SCORE_WEIGHTS.morningCompleteBonus
    : 0;

  // Evening completion bonus
  const eveningItems = enabledItems.filter((item) => {
    const time = calculateDisplayTime(item, settings);
    return deriveTimeOfDay(time) === "evening";
  });
  const eveningCompleted =
    eveningItems.length > 0 &&
    eveningItems.every((item) =>
      log.completions.some(
        (c) => c.itemId === item.id && c.completedAt !== null
      )
    );
  const eveningBonus = eveningCompleted
    ? SCORE_WEIGHTS.eveningCompleteBonus
    : 0;

  // Note bonus: at least one item note or a day note
  const hasNote =
    log.dayNote.trim().length > 0 ||
    log.completions.some((c) => c.note.trim().length > 0);
  const noteBonus = hasNote ? SCORE_WEIGHTS.noteBonus : 0;

  const total = baseScore + sleepBonus + morningBonus + eveningBonus + noteBonus;
  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Calculate the current streak: consecutive days (ending today or yesterday)
 * where score > 0 and at least one item was completed.
 */
export function calculateStreak(logs: DailyLog[]): number {
  if (logs.length === 0) return 0;

  const sorted = [...logs]
    .filter(
      (log) =>
        log.score > 0 &&
        log.completions.some((c) => c.completedAt !== null)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = formatDateKey(today);
  const yesterdayStr = formatDateKey(yesterday);

  // Streak must include today or yesterday
  if (sorted[0].date !== todayStr && sorted[0].date !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(sorted[0].date + "T00:00:00");

  for (let i = 1; i < sorted.length; i++) {
    const expectedPrev = new Date(currentDate);
    expectedPrev.setDate(expectedPrev.getDate() - 1);
    const expectedStr = formatDateKey(expectedPrev);

    if (sorted[i].date === expectedStr) {
      streak++;
      currentDate = expectedPrev;
    } else {
      break;
    }
  }

  return streak;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
