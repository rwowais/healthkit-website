/**
 * smartReminders.ts — learn a behavior's typical completion time from
 * history so reminders can fire when the user actually acts, not at a fixed
 * clock time. Honest about its limits: returns null until there's enough
 * signal (≥SMART_MIN_SAMPLES recent recorded completions), so reminders fall
 * back to the scheduled time until the rhythm is real.
 */
import type { AppState } from "./types";
import { getTz, dateKeyInTz, addDaysToKey } from "./tz";

export const SMART_MIN_SAMPLES = 5;
const SMART_WINDOW_DAYS = 30;

/**
 * Median recorded completion time (minutes since midnight) for a behavior
 * over the recent window, or null when Smart timing is off / there isn't
 * enough data. Excludes today (in progress) so a single early/late tap today
 * doesn't skew the learned time.
 */
export function learnedReminderMinutes(
  state: AppState,
  key: string
): number | null {
  if (!state.settings.smartReminders) return null;
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const floor = addDaysToKey(today, -SMART_WINDOW_DAYS);
  const mins: number[] = [];
  for (const l of state.dailyLogs ?? []) {
    if (l.date < floor || l.date >= today) continue;
    const m = l.behaviorCompletionMinutes?.[key];
    if (typeof m === "number" && l.behaviorCompletions?.[key]) mins.push(m);
  }
  if (mins.length < SMART_MIN_SAMPLES) return null;
  mins.sort((a, b) => a - b);
  const mid = Math.floor(mins.length / 2);
  return mins.length % 2
    ? mins[mid]
    : Math.round((mins[mid - 1] + mins[mid]) / 2);
}
