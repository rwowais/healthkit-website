/**
 * Regression: supplement-only adherence must count as activity
 * (sweep 2026-06-09 HIGH #9).
 *
 * hasAnyActivity only inspected the LEGACY supplementEntries model, never the
 * live supplementCompletions / supplementSkips that the actual supplement
 * surface writes. A user who takes their stack faithfully every day was
 * therefore counted as having done NOTHING — streak, weekly-goal ring, freeze
 * bank and the cold-start countdown all frozen at 0. The fix teaches
 * hasAnyActivity the live model.
 */
import { describe, it, expect } from "vitest";
import { calculateStreak, hasAnyActivity } from "@/lib/scoring";
import { getSignals, adapt } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import { dateKeyInTz, addDaysToKey } from "@/lib/tz";
import type { AppState, DailyLog } from "@/lib/types";

/** A behavior-less day whose ONLY activity is a taken supplement (live model). */
function mkSuppLog(date: string): DailyLog {
  return {
    date,
    completions: [],
    exerciseEntries: [],
    supplementEntries: [], // legacy model intentionally empty
    sleepCompletions: [],
    sleepLog: { actualBedtime: null, actualWakeTime: null, sleepQuality: null },
    nutritionScorecard: { note: "" } as any,
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
    supplementCompletions: { "magnesium-pm": true },
    supplementSkips: [],
  } as any;
}

describe("supplement-only day counts as activity (HIGH #9)", () => {
  it("hasAnyActivity is true for a taken supplement via the live model", () => {
    expect(hasAnyActivity(mkSuppLog("2026-06-09"))).toBe(true);
  });

  it("a behavior-less supplement-only streak accrues", () => {
    const tKey = dateKeyInTz("UTC");
    const days = [
      addDaysToKey(tKey, -4),
      addDaysToKey(tKey, -3),
      addDaysToKey(tKey, -2),
      addDaysToKey(tKey, -1),
      tKey,
    ];
    const logs = days.map(mkSuppLog);
    const settings = { ...getDefaultState().settings, timezone: "UTC" } as any;
    expect(calculateStreak(logs, new Set<string>(), settings)).toBeGreaterThanOrEqual(5);
  });

  it("a skipped supplement also counts (an intentional, logged choice)", () => {
    const log = { ...mkSuppLog("2026-06-09"), supplementCompletions: {}, supplementSkips: ["vitd"] } as DailyLog;
    expect(hasAnyActivity(log)).toBe(true);
  });

  it("engine signals agree with the streak — no 'streak 3 but rebuild' contradiction", () => {
    // Audit round 2: scoring.hasAnyActivity learned the live supplement model
    // but engine.logHasActivity (the gap-walk filter) did not, so a perfect
    // supplement-only adherent had streak ≥ 3 while adapt() simultaneously
    // claimed they'd been "away 366 days — easing back in".
    const tKey = dateKeyInTz("UTC");
    const days = [
      addDaysToKey(tKey, -3),
      addDaysToKey(tKey, -2),
      addDaysToKey(tKey, -1),
      tKey,
    ];
    const state: AppState = {
      ...getDefaultState(),
      settings: { ...getDefaultState().settings, timezone: "UTC" } as any,
      dailyLogs: days.map(mkSuppLog),
    } as AppState;

    const streak = calculateStreak(state.dailyLogs, new Set<string>(), state.settings);
    expect(streak).toBeGreaterThanOrEqual(4);

    const sig = getSignals(state);
    expect(sig.gapDays).toBe(0);
    expect(adapt(state).mode).not.toBe("rebuild");
  });
});
