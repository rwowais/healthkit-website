/**
 * Persona: "Theo the traveler" — 365-day vacation-mode stress test.
 *
 * Theo travels heavily. Across the year he takes 4 vacations totalling 65
 * days (7 + 20 + 8 + 30). The product promise: vacationMode pauses the
 * timeline, freezes streak math, and treats vacation days as
 * transparent in gap math. We exercise every path of that contract:
 *   - calculateStreak walks through vacation days as if they weren't there.
 *   - getSignals.gapDays is 0 immediately after returning from vacation.
 *   - adapt() does NOT enter "rebuild" mode after a vacation return.
 *   - compileTimeline returns [] while vacationMode === true.
 *   - getVacationDates emits every day in each period (start..end inclusive).
 *   - Edge cases: 1-day vacation, overlapping periods.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compileTimeline,
  adapt,
  getSignals,
} from "@/lib/engine";
import {
  getDefaultState,
  setVacationMode,
  getVacationDates,
} from "@/lib/storage";
import { calculateStreak } from "@/lib/scoring";
import type { AppState, DailyLog } from "@/lib/types";

// Pin "now" to a stable noon-UTC instant so dk() (which derives its
// dates from `new Date()`) and the tz-aware engine ("today" via
// dateKeyInTz) always agree on the calendar day. Without pinning, these
// tests flip at the UTC/local midnight boundary — green in the morning,
// red in the evening once local time crosses into the next UTC day.
// Noon UTC keeps UTC and every non-extreme tz on the same date.
const FIXED_NOW = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));

// ── helpers ──────────────────────────────────────────────────────

/** YYYY-MM-DD for N days back from today (in UTC, mirroring storage). */
function dk(offsetDaysBack: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDaysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function emptyLog(date: string): DailyLog {
  return {
    date,
    sleepCompletions: [],
    exerciseEntries: [],
    nutritionScorecard: {
      hitProteinTarget: null,
      ateFruitsVeggies: null,
      stayedHydrated: null,
      avoidedProcessedSugar: null,
      finishedEatingOnTime: null,
      minimizedAlcohol: null,
      customItems: [],
      note: "",
    },
    supplementEntries: [],
    completions: [],
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: null,
      sleepDurationMinutes: null,
    },
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: {},
  } as unknown as DailyLog;
}

/** isoDayOf — Mon=0..Sun=6 for a YYYY-MM-DD key */
function isoDayOf(dateStr: string): number {
  const j = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return j === 0 ? 6 : j - 1;
}

/**
 * Simulate a day with the given adherence. Returns a daily log with
 * behaviorCompletions populated against today's timeline. Vacation days
 * never get a log written (caller decides).
 */
function simDay(
  state: AppState,
  dayBack: number,
  adherence: number,
  seed: number
): DailyLog {
  const date = dk(dayBack);
  const dayIndex = isoDayOf(date);
  const items = compileTimeline(state, dayIndex);
  let h = seed;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rng = () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
  const log = emptyLog(date);
  const bc: Record<string, boolean> = {};
  let total = 0;
  let done = 0;
  for (const it of items) {
    if (it.muted) continue;
    total++;
    if (rng() < adherence) {
      bc[it.canonicalKey] = true;
      done++;
    }
  }
  log.behaviorCompletions = bc;
  log.score = total > 0 ? Math.round((done / total) * 100) : 0;
  // Add a sleep-quality check-in on most days so hasAnyActivity is robust.
  log.sleepLog.sleepQuality = 4;
  return log;
}

/**
 * Build state with vacation periods set as recorded ranges. Snapshots
 * the same {start, end} pair that setVacationMode would have written
 * over the year — but anchored to historical dates (toggleOn/off in the
 * past would have stamped today's date at the moment of toggle, not at
 * a future date). Here we deterministically write the historical
 * periods so the simulation is reproducible.
 */
function buildHistoricalState(
  periods: Array<{ start: string; end: string | null }>,
  vacationMode: boolean
): AppState {
  const base = getDefaultState();
  return {
    ...base,
    installedPacks: ["longevity-foundation", "better-sleep"],
    settings: {
      ...base.settings,
      completedOnboarding: true,
      vacationMode,
      vacationPeriods: periods,
    },
  };
}

// ── Persona configuration ────────────────────────────────────────

// Day-back offsets (today = day 365 of the journey; day 1 is 364 days back).
// We map "journey day i" → dk(365 - i).
function journeyOffsetBack(i: number): number {
  return 365 - i;
}

// Vacations in journey-day coordinates.
const VACATIONS = [
  { start: 31, end: 37 }, // 7 days
  { start: 61, end: 80 }, // 20 days
  { start: 181, end: 188 }, // 8 days
  { start: 301, end: 330 }, // 30 days
];
const TOTAL_VACATION_DAYS = VACATIONS.reduce(
  (s, v) => s + (v.end - v.start + 1),
  0
);

function isVacationJourneyDay(i: number): { vac: typeof VACATIONS[number]; isStart: boolean; isEnd: boolean } | null {
  for (const v of VACATIONS) {
    if (i >= v.start && i <= v.end) {
      return { vac: v, isStart: i === v.start, isEnd: i === v.end };
    }
  }
  return null;
}

// Build the complete vacationPeriods array as it would have been
// recorded by setVacationMode toggle calls during the year.
function buildVacationPeriods(): Array<{ start: string; end: string | null }> {
  return VACATIONS.map((v) => ({
    start: dk(journeyOffsetBack(v.start)),
    end: dk(journeyOffsetBack(v.end)),
  }));
}

// Build the dailyLogs for active days (no logs during vacations).
function buildLogs(state: AppState): DailyLog[] {
  const logs: DailyLog[] = [];
  for (let i = 1; i <= 365; i++) {
    if (isVacationJourneyDay(i)) continue;
    // Adherence schedule per the spec
    let adherence = 0.75;
    if (i >= 1 && i <= 30) adherence = 0.75;
    else if (i >= 38 && i <= 60) adherence = 0.75;
    else if (i >= 81 && i <= 180) adherence = 0.75;
    else if (i >= 189 && i <= 300) adherence = 0.75;
    else if (i >= 331 && i <= 365) adherence = 0.75;
    const log = simDay(state, journeyOffsetBack(i), adherence, i);
    logs.push(log);
  }
  return logs;
}

// ── tests ─────────────────────────────────────────────────────────

describe("vacation-traveler (Theo) — 365-day stress test", () => {
  beforeEach(() => {
    // Pin the clock BEFORE any test body runs dk(), so date generation
    // and the engine's tz-aware "today" stay in lockstep.
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    // Restore real timers after every test so nothing leaks to other
    // test files.
    vi.useRealTimers();
  });

  it("getVacationDates emits every day in each range (start..end inclusive)", () => {
    const periods = buildVacationPeriods();
    const state = buildHistoricalState(periods, false);
    const dates = getVacationDates(state);
    // Should equal sum of all vacation lengths.
    expect(dates.size).toBe(TOTAL_VACATION_DAYS);
    // Every day in every range should be present.
    for (const v of VACATIONS) {
      for (let d = v.start; d <= v.end; d++) {
        const key = dk(journeyOffsetBack(d));
        expect(dates.has(key), `journey day ${d} (${key}) should be a vacation date`).toBe(true);
      }
    }
  });

  it("1-day vacation registers (start === end)", () => {
    const today = dk(0);
    const periods = [{ start: today, end: today }];
    const state = buildHistoricalState(periods, false);
    const dates = getVacationDates(state);
    expect(dates.size).toBe(1);
    expect(dates.has(today)).toBe(true);
  });

  it("overlapping vacationPeriods — dedupes correctly via Set", () => {
    const periods = [
      { start: dk(20), end: dk(10) }, // 11 days
      { start: dk(15), end: dk(5) }, // 11 days, overlaps last 6 of period 1
    ];
    const state = buildHistoricalState(periods, false);
    const dates = getVacationDates(state);
    // Union should be 16 unique days (20..5 inclusive = 16 days).
    expect(dates.size).toBe(16);
  });

  it("active (end=null) vacation period — emits days through today", () => {
    const periods = [{ start: dk(4), end: null }];
    const state = buildHistoricalState(periods, true);
    const dates = getVacationDates(state);
    // 5 days: today and the 4 days before
    expect(dates.size).toBe(5);
    expect(dates.has(dk(0))).toBe(true);
    expect(dates.has(dk(4))).toBe(true);
  });

  it("compileTimeline returns [] while vacationMode is on", () => {
    const periods = [{ start: dk(2), end: null }];
    const state = buildHistoricalState(periods, true);
    const dayIndex = isoDayOf(dk(0));
    const items = compileTimeline(state, dayIndex);
    expect(items).toEqual([]);
  });

  it("compileTimeline non-empty when vacationMode is off (post-vacation)", () => {
    const periods = [{ start: dk(20), end: dk(10) }];
    const state = buildHistoricalState(periods, false);
    const dayIndex = isoDayOf(dk(0));
    const items = compileTimeline(state, dayIndex);
    expect(items.length).toBeGreaterThan(0);
  });

  it("full 365-day journey — vacation transparency holds", () => {
    const periods = buildVacationPeriods();
    let state = buildHistoricalState(periods, false);
    const logs = buildLogs(state);
    state = { ...state, dailyLogs: logs };

    // Sanity: 65 vacation days exactly
    expect(getVacationDates(state).size).toBe(TOTAL_VACATION_DAYS);
    expect(TOTAL_VACATION_DAYS).toBe(65);

    // ── Return-point assertions ──────────────────────────────────
    // After each vacation, the user resumes on (end + 1). We
    // snapshot the streak/signals/mode using a "view" where the
    // most-recent log is the post-vacation resume day. Because the
    // engine reads logs relative to *real today*, we test each
    // return by trimming logs to that historical window.
    const returnPoints = [
      { name: "after V1", endJourneyDay: 37, resumeJourneyDay: 38 },
      { name: "after V2", endJourneyDay: 80, resumeJourneyDay: 81 },
      { name: "after V3", endJourneyDay: 188, resumeJourneyDay: 189 },
      { name: "after V4", endJourneyDay: 330, resumeJourneyDay: 331 },
    ];
    const snapshots: Record<string, {
      streak: number;
      gapDays: number;
      mode: string;
    }> = {};
    for (const rp of returnPoints) {
      // Compute resumeKey against the FIXED journey anchor — the same
      // clock the logs/periods were built under in beforeEach. Without
      // this reset, dk() would drift each iteration (it'd read the
      // PREVIOUS iteration's resume-day clock), landing cutoffKey years
      // off and emptying trimmedLogs → streak 0.
      vi.setSystemTime(FIXED_NOW);
      const resumeKey = dk(journeyOffsetBack(rp.resumeJourneyDay));
      // Then move the clock to that resume day (noon UTC) so the trimmed
      // view's streak/signals/adapt resolve "today" correctly.
      const [y, m, d] = resumeKey.split("-").map(Number);
      vi.setSystemTime(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));

      const cutoffKey = resumeKey;
      const trimmedLogs = logs.filter((l) => l.date <= cutoffKey);
      const trimmedPeriods = periods.filter(
        (p) => p.start <= cutoffKey && (p.end ?? cutoffKey) <= cutoffKey
      );
      const view: AppState = {
        ...state,
        dailyLogs: trimmedLogs,
        settings: {
          ...state.settings,
          vacationMode: false,
          vacationPeriods: trimmedPeriods,
        },
      };
      const streak = calculateStreak(trimmedLogs, getVacationDates(view));
      const signals = getSignals(view);
      const a = adapt(view);
      snapshots[rp.name] = { streak, gapDays: signals.gapDays, mode: a.mode };
    }
    // The loop moved the clock to each historical resume day; restore
    // the pinned "now" so the end-of-year assertions below resolve
    // against the same day the logs/periods were built for.
    vi.setSystemTime(FIXED_NOW);

    // Print snapshot for the report
    // eslint-disable-next-line no-console
    console.log("[vacation-traveler] return snapshots:", snapshots);

    // ── End-of-year assertions (real today) ──────────────────────
    const finalStreak = calculateStreak(logs, getVacationDates(state));
    const finalSignals = getSignals(state);
    const finalAdapt = adapt(state);
    // eslint-disable-next-line no-console
    console.log(
      "[vacation-traveler] day 365: streak=%d gapDays=%d mode=%s totalLogs=%d totalVacationDays=%d",
      finalStreak,
      finalSignals.gapDays,
      finalAdapt.mode,
      logs.length,
      getVacationDates(state).size
    );

    // ── soft assertions for each return point so all 4 are observed ──
    // (the task: probe + report; bugs surface as soft failures, but
    // the suite still reports an aggregate fail so they get noticed)
    for (const rp of returnPoints) {
      const s = snapshots[rp.name];
      expect.soft(s.streak, `${rp.name}: streak should be > 0`).toBeGreaterThan(0);
      expect.soft(s.gapDays, `${rp.name}: gapDays should be 0 (got ${s.gapDays})`).toBe(0);
      expect.soft(s.mode, `${rp.name}: mode should not be rebuild`).not.toBe("rebuild");
    }

    // ── End of year ──────────────────────────────────────────────
    // Streak ≈ active-days-count (not zero, not broken into chunks).
    expect(finalStreak).toBeGreaterThan(0);
    // The total number of logs should equal 365 - 65 = 300 active days.
    expect(logs.length).toBe(300);
    // Total vacation days should equal 65.
    expect(getVacationDates(state).size).toBe(65);
    // Final adapt mode should not be "rebuild" on day 365 (the user
    // just logged a normal day after returning from V4 35 days ago).
    expect(finalAdapt.mode).not.toBe("rebuild");
  });
});
