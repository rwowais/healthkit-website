/**
 * smartReminders.ts — learn a behavior's typical completion time from
 * history so reminders can fire when the user actually acts, not at a fixed
 * clock time. Honest about its limits: returns null until there's enough
 * signal (≥SMART_MIN_SAMPLES recent recorded completions), so reminders fall
 * back to the scheduled time until the rhythm is real.
 */
import type { AppState } from "./types";
import { getTz, dateKeyInTz, addDaysToKey } from "./tz";
import { clampToWindow, inQuietHours, type WindowItem } from "./time";

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

/**
 * Resolve the final reminder minute for a behavior, or null to skip it.
 *
 * Composes the two guardrails the reminder pipeline must honor (used by both
 * the in-tab and background-subscribe paths so they can't diverge):
 *  1. CLAMP the learned (Smart timing) time into the behavior's hard window —
 *     a few late logs must never move a strict-circadian reminder (morning
 *     light, caffeine cutoff) outside its allowed range. No-op when windowless.
 *  2. QUIET HOURS with fallback — if the chosen time lands in do-not-disturb
 *     but the SCHEDULED time doesn't, fall back to the scheduled time rather
 *     than silently dropping the reminder (enabling Smart timing must never
 *     make a reminder disappear). Only when BOTH fall in quiet hours do we skip.
 */
export function resolveReminderMinutes(
  learned: number | null,
  sched: number,
  item: WindowItem,
  settings: { wakeTime: string; bedtime: string },
  quietHours?: { start: string; end: string }
): number | null {
  let t = clampToWindow(learned ?? sched, item, settings);
  if (inQuietHours(t, quietHours) && !inQuietHours(sched, quietHours)) {
    t = sched;
  }
  if (inQuietHours(t, quietHours)) return null;
  return t;
}
