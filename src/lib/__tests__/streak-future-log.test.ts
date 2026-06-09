/**
 * Regression: a future-dated daily log must not poison streak / signal math.
 *
 * A bad clock, a manual import, or a cross-timezone edit can produce a log
 * dated *after* the engine's notion of "today". Two invariants protect us:
 *   1. calculateStreak collapses to 0 when the head log is in the future
 *      (we never award a streak for days that haven't happened yet).
 *   2. getSignals().gapDays runs to its cap (and adapt() → "rebuild")
 *      rather than going negative or NaN when the newest log is future-dated.
 *
 * Dates are driven relative to the engine's own day key (UTC) via the same
 * tz helpers the engine uses, so this is deterministic regardless of the
 * machine clock.
 */
import { describe, it, expect } from "vitest";
import { calculateStreak } from "@/lib/scoring";
import { getSignals, adapt } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import { dateKeyInTz, addDaysToKey } from "@/lib/tz";
import type { AppState, DailyLog } from "@/lib/types";

/** A minimal "active" log on a given date with a real score + activity. */
function mkLog(date: string): DailyLog {
  return {
    date,
    completions: ["x"],
    exerciseEntries: [],
    supplementEntries: [],
    sleepCompletions: [],
    sleepLog: { actualBedtime: null, actualWakeTime: null, sleepQuality: 4 },
    nutritionScorecard: { note: "" } as any,
    energyLevel: 4,
    moodLevel: null,
    dayNote: "",
    score: 80,
  } as any;
}

describe("future-dated log regression", () => {
  it("calculateStreak collapses to 0 with a future head", () => {
    const tKey = dateKeyInTz("UTC");
    const days = [
      addDaysToKey(tKey, -5),
      addDaysToKey(tKey, -4),
      addDaysToKey(tKey, -3),
      addDaysToKey(tKey, -2),
      addDaysToKey(tKey, -1),
      tKey, // active today too
    ];
    const logsHealthy = days.map(mkLog);
    const settings = { ...getDefaultState().settings, timezone: "UTC" } as any;

    // Healthy six-day run earns a real streak.
    const healthy = calculateStreak(logsHealthy, new Set<string>(), settings);
    expect(healthy).toBeGreaterThanOrEqual(6);

    // One future-dated log (today+1) must poison the streak to 0.
    const logsPoisoned = [...logsHealthy, mkLog(addDaysToKey(tKey, +1))];
    const poisoned = calculateStreak(logsPoisoned, new Set<string>(), settings);
    expect(poisoned).toBe(0);
  });

  it("getSignals gapDays runs to cap and adapt -> rebuild with a future log", () => {
    const tKey = dateKeyInTz("UTC");
    const days = [
      addDaysToKey(tKey, -5),
      addDaysToKey(tKey, -4),
      addDaysToKey(tKey, -3),
      addDaysToKey(tKey, -2),
      addDaysToKey(tKey, -1),
      tKey,
      addDaysToKey(tKey, +1), // the poison
    ];
    const state: AppState = {
      ...getDefaultState(),
      settings: { ...getDefaultState().settings, timezone: "UTC" } as any,
      dailyLogs: days.map(mkLog),
    } as any;

    const sig = getSignals(state);
    expect(sig.gapDays).toBe(366);

    const a = adapt(state);
    expect(a.mode).toBe("rebuild");
  });
});
