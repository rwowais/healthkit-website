/**
 * Regression: a future-dated daily log must NOT poison streak / signal math
 * (sweep 2026-06-09 HIGH #8).
 *
 * A bad clock, a westward timezone change, or a multi-device merge can produce
 * a log dated AFTER the engine's notion of "today". Before the fix this was
 * silently catastrophic: calculateStreak's head check rejected the future head
 * and returned 0 (a faithfully-earned streak vanished), and getSignals' gap
 * loop never reached the future key so gapDays ran to its 366 cap and adapt()
 * demoted the day into "rebuild / away 366 days".
 *
 * The fix neutralizes future logs in three places — normalize() clamps them at
 * load, and the two readers (calculateStreak, getSignals) ignore date > today.
 * These tests drive the readers directly to prove a stray future log is inert:
 *   1. calculateStreak ignores it → the real streak is preserved.
 *   2. getSignals().gapDays stays 0 and adapt() does NOT flip to "rebuild".
 *
 * Dates are relative to the engine's own day key (UTC) via the same tz helpers
 * the engine uses, so this is deterministic regardless of the machine clock.
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

describe("future-dated log is neutralized (HIGH #8)", () => {
  it("calculateStreak ignores a future head → real streak preserved", () => {
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

    const healthy = calculateStreak(logsHealthy, new Set<string>(), settings);
    expect(healthy).toBeGreaterThanOrEqual(6);

    // Adding ONE future-dated log (today+1) must NOT change the streak: the
    // future log is ignored, not treated as the (failing) head.
    const logsPoisoned = [...logsHealthy, mkLog(addDaysToKey(tKey, +1))];
    const poisoned = calculateStreak(logsPoisoned, new Set<string>(), settings);
    expect(poisoned).toBe(healthy);
  });

  it("getSignals gap stays 0 and adapt() does not flip to rebuild", () => {
    const tKey = dateKeyInTz("UTC");
    const days = [
      addDaysToKey(tKey, -5),
      addDaysToKey(tKey, -4),
      addDaysToKey(tKey, -3),
      addDaysToKey(tKey, -2),
      addDaysToKey(tKey, -1),
      tKey,
      addDaysToKey(tKey, +1), // the would-be poison
    ];
    const state: AppState = {
      ...getDefaultState(),
      settings: { ...getDefaultState().settings, timezone: "UTC" } as any,
      dailyLogs: days.map(mkLog),
    } as any;

    const sig = getSignals(state);
    expect(sig.gapDays).toBe(0);

    const a = adapt(state);
    expect(a.mode).not.toBe("rebuild");
  });
});
