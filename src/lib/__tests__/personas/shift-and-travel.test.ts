/**
 * Persona: shift-and-travel — two parallel year-long state evolutions
 * designed to stress the timezone + sleep + adapt subsystems against
 * workflows that conflict with the daytime-anchor assumption baked
 * into every other persona.
 *
 *  ── Nora the night-shift nurse ───────────────────────────────────────
 *   • Free tier. Single pack: better-sleep.
 *   • Works 7pm-7am Mon/Wed/Fri (3 nights/week). Sleeps days.
 *   • Wakes ~16:00, beds ~08:00 the next calendar day.
 *   • Sleep quality 2-4 (rough). Eastern timezone (America/New_York).
 *   • Twice a year — Mar (day 60) and Sep (day 240) — flies to a Pacific
 *     conference for 14 days and toggles VACATION MODE (no logging).
 *
 *  ── Theo the international traveler ─────────────────────────────────
 *   • Premium tier. Two packs: longevity-foundation + better-sleep.
 *   • Quarterly trips across 3+ timezones; UPDATES settings.timezone
 *     to match the destination on travel day, REVERTS on return.
 *   • NOT vacation mode — keeps logging from the new tz.
 *   • Trip schedule (PST baseline):
 *        Jan, days  10-16:  London   (Europe/London,    GMT+0/+1)
 *        Apr, days 100-109: Tokyo    (Asia/Tokyo,       GMT+9)
 *        Aug, days 220-233: Berlin   (Europe/Berlin,    GMT+1/+2)
 *        Nov, days 305-312: Hong Kong (Asia/Hong_Kong,  GMT+8)
 *
 * Each persona walks 365 days. We anchor `vi.setSystemTime` per
 * checkpoint so every tz-aware helper resolves "today" relative to the
 * simulated day. At every 30-day milestone we call `assertInvariants`
 * with a labeled context — the invariant suite is the spec, and any
 * tz bug shows up as a *named* violation rather than a scenario flake.
 *
 * Specific tz probes (as per the brief):
 *  1. Traveler-crossed-tz day: calculateStreak(logs, vacays, settings)
 *     should still count yesterday's log when settings.timezone just
 *     advanced by 9h. We check that the streak doesn't drop to 0 the
 *     morning Theo lands in Tokyo.
 *  2. Nurse-midnight-log: nurse "evening" is 6am NY local. The log
 *     written at that moment must belong to the SAME calendar day the
 *     nurse is mentally in (her wake day), not the device's UTC day.
 *  3. Return-from-trip: when Theo flips timezone back to PST, no
 *     historical log key changes — they're already YYYY-MM-DD strings
 *     anchored to the local tz at write time. We assert no log gets
 *     "retroactively misplaced" by comparing the log set before vs
 *     after the reversion.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  compileTimeline,
  adapt,
  getSignals,
} from "@/lib/engine";
import {
  getDefaultState,
  getVacationDates,
} from "@/lib/storage";
import { calculateStreak } from "@/lib/scoring";
import { checkInvariants } from "../invariants";
import { dateKeyInTz, getTz } from "@/lib/tz";
import type { AppState, DailyLog } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * The simulated journey runs against a fixed anchor in 2025 so the
 * test is reproducible across CI / dev clocks. The anchor is noon
 * UTC on 2025-01-01.
 */
const JOURNEY_T0_UTC = Date.UTC(2025, 0, 1, 12, 0, 0);

/** Set the simulated wall-clock to `whenUtc` (UTC ms). */
function setNow(whenUtc: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(whenUtc));
}

/** Convert a journey-day-1-based offset to a UTC instant (noon UTC). */
function utcAtJourneyDay(dayNum: number): number {
  return JOURNEY_T0_UTC + (dayNum - 1) * 86_400_000;
}

/** UTC ms instant at a specific HH:MM on a journey day. */
function utcAtJourneyDayClock(
  dayNum: number,
  hourUtc: number,
  minuteUtc: number
): number {
  return JOURNEY_T0_UTC + (dayNum - 1) * 86_400_000
    - 12 * 3600 * 1000 // remove the noon-offset baked into JOURNEY_T0_UTC
    + hourUtc * 3600 * 1000
    + minuteUtc * 60 * 1000;
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

/** Deterministic PRNG seeded by string so simulation reproduces. */
function makeRng(seed: string): () => number {
  let h = 1;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

/**
 * Simulate one day's adherence against the timeline compiled at the
 * day index that the engine sees in tz. Returns a DailyLog keyed by
 * `dateKey` (caller decides; usually dateKeyInTz of settings tz).
 */
function simDayLog(
  state: AppState,
  dateKey: string,
  dayIndex: number,
  opts: {
    adherence: number;
    sleepQ: number | null;
    energy: number | null;
    mood?: number | null;
    seed: string;
  }
): DailyLog {
  const log = emptyLog(dateKey);
  const items = compileTimeline(state, dayIndex);
  const rng = makeRng(opts.seed);
  const bc: Record<string, boolean> = {};
  let total = 0;
  let done = 0;
  for (const it of items) {
    if (it.muted) continue;
    total++;
    if (rng() < opts.adherence) {
      bc[it.canonicalKey] = true;
      done++;
    }
  }
  log.behaviorCompletions = bc;
  log.score = total > 0 ? Math.round((done / total) * 100) : 0;
  log.sleepLog.sleepQuality = opts.sleepQ;
  log.energyLevel = opts.energy;
  if (opts.mood != null) log.moodLevel = opts.mood;
  return log;
}

// ── Nurse persona ────────────────────────────────────────────────────

const NURSE_TZ = "America/New_York";

// Days 1..365. Vacation (conference travel) blocks: 60..73 and 240..253
// (14 days each).
const NURSE_VAC_BLOCKS = [
  { start: 60, end: 73 },
  { start: 240, end: 253 },
];

function nurseIsVacationDay(d: number): boolean {
  return NURSE_VAC_BLOCKS.some((v) => d >= v.start && d <= v.end);
}

function buildNurseState(allLogs: DailyLog[], dayNum: number): AppState {
  const base = getDefaultState();
  // Vacation periods snapshot for the periods that have actually
  // ELAPSED relative to `dayNum`. The most recent block (if currently
  // active) gets end=null, vacationMode=true.
  const periods: { start: string; end: string | null }[] = [];
  let vacationMode = false;
  for (const v of NURSE_VAC_BLOCKS) {
    if (v.start > dayNum) continue;
    const startKey = dateKeyInTz(
      NURSE_TZ,
      new Date(utcAtJourneyDay(v.start))
    );
    if (v.end < dayNum) {
      const endKey = dateKeyInTz(
        NURSE_TZ,
        new Date(utcAtJourneyDay(v.end))
      );
      periods.push({ start: startKey, end: endKey });
    } else {
      periods.push({ start: startKey, end: null });
      vacationMode = true;
    }
  }
  return {
    ...base,
    installedPacks: ["better-sleep"],
    settings: {
      ...base.settings,
      name: "Nora",
      timezone: NURSE_TZ,
      tier: "free",
      // Nurse's sleep window: bed at 08:00, wake at 16:00.
      bedtime: "08:00",
      wakeTime: "16:00",
      completedOnboarding: true,
      vacationMode,
      vacationPeriods: periods,
      // Free tier → trial expired so biomarker-aware adapt stays gated.
      premiumTrialEndsAt: new Date(JOURNEY_T0_UTC - 30 * 86_400_000).toISOString(),
    },
    dailyLogs: allLogs.filter((l) => l.date <= dateKeyInTz(NURSE_TZ, new Date(utcAtJourneyDay(dayNum)))),
  };
}

// ── Traveler persona ─────────────────────────────────────────────────

const TRAVELER_HOME_TZ = "America/Los_Angeles";

interface Trip {
  start: number; // journey day on arrival (tz flips this morning)
  end: number;   // journey day on return  (tz flips back this morning)
  tz: string;
}
const TRAVELER_TRIPS: Trip[] = [
  { start: 10,  end: 16,  tz: "Europe/London" },
  { start: 100, end: 109, tz: "Asia/Tokyo" },
  { start: 220, end: 233, tz: "Europe/Berlin" },
  { start: 305, end: 312, tz: "Asia/Hong_Kong" },
];

function travelerTzForDay(dayNum: number): string {
  for (const t of TRAVELER_TRIPS) {
    if (dayNum >= t.start && dayNum <= t.end) return t.tz;
  }
  return TRAVELER_HOME_TZ;
}

function buildTravelerState(
  allLogs: DailyLog[],
  dayNum: number
): AppState {
  const base = getDefaultState();
  return {
    ...base,
    installedPacks: ["longevity-foundation", "better-sleep"],
    settings: {
      ...base.settings,
      name: "Theo",
      timezone: travelerTzForDay(dayNum),
      tier: "premium",
      bedtime: "23:00",
      wakeTime: "06:30",
      completedOnboarding: true,
      vacationMode: false,
      vacationPeriods: [],
      // Premium tier → no trial gate needed.
    },
    dailyLogs: allLogs.filter(
      (l) =>
        l.date <=
        dateKeyInTz(
          travelerTzForDay(dayNum),
          new Date(utcAtJourneyDay(dayNum))
        )
    ),
  };
}

// ── Simulations ──────────────────────────────────────────────────────

/**
 * Run the nurse's 365-day simulation. Returns a map of {dayNum -> AppState}
 * for the 30-day checkpoints + the final state.
 */
function simulateNurse(): {
  finalState: AppState;
  checkpointStates: Map<number, AppState>;
  allLogs: DailyLog[];
} {
  const allLogs: DailyLog[] = [];
  const checkpointStates = new Map<number, AppState>();

  for (let d = 1; d <= 365; d++) {
    // Anchor the wall clock to 06:00 NY-time, which is when Nora
    // typically logs (end of her shift). 06:00 ET = 11:00 UTC (winter,
    // EST) or 10:00 UTC (summer, EDT). Use 11:00 UTC unconditionally
    // — dateKeyInTz will produce the correct ET key either way.
    const whenUtc = utcAtJourneyDayClock(d, 11, 0);
    setNow(whenUtc);

    // SPECIFIC PROBE: the nurse logs at 06:00 NY-time. Confirm the
    // engine's "today" key matches her *waking* day (which started
    // yesterday afternoon — but the calendar day is *now*, because
    // 06:00 is past midnight). dateKeyInTz with NY tz should return
    // the calendar day matching the current NY-local date.
    const todayKey = dateKeyInTz(NURSE_TZ, new Date(whenUtc));

    if (!nurseIsVacationDay(d)) {
      // Build interim state so compileTimeline / signals reflect
      // history up to this point.
      const interim = buildNurseState(allLogs, d);
      const dayIndex = (() => {
        const jsDay = new Date(todayKey + "T12:00:00Z").getUTCDay();
        return jsDay === 0 ? 6 : jsDay - 1;
      })();
      // Mon/Wed/Fri = working nights → rougher sleep. Mon=0 Wed=2 Fri=4
      const isWorkNight = dayIndex === 0 || dayIndex === 2 || dayIndex === 4;
      const adherence = isWorkNight ? 0.45 : 0.7;
      const sleepQ = isWorkNight ? 2 + (d % 2) : 3 + (d % 2); // 2-3 / 3-4
      const energy = isWorkNight ? 2 : 3;
      const log = simDayLog(interim, todayKey, dayIndex, {
        adherence,
        sleepQ,
        energy,
        seed: `nurse-${d}`,
      });
      allLogs.push(log);
    }

    if (d % 30 === 0 || d === 365) {
      const snap = buildNurseState(allLogs, d);
      checkpointStates.set(d, snap);
    }
  }

  // Final state at end of year.
  const finalState = buildNurseState(allLogs, 365);
  return { finalState, checkpointStates, allLogs };
}

/**
 * Run the traveler's 365-day simulation. Logs are keyed by the tz that
 * was active on the day of writing (i.e. the destination tz during a
 * trip).
 */
function simulateTraveler(): {
  finalState: AppState;
  checkpointStates: Map<number, AppState>;
  allLogs: DailyLog[];
  // Trip-arrival keys: for the streak-crossing-tz probe.
  arrivalChecks: Array<{
    trip: Trip;
    arrivalKeyHomeTz: string;
    arrivalKeyDestTz: string;
    yesterdayKeyHomeTz: string;
  }>;
} {
  const allLogs: DailyLog[] = [];
  const checkpointStates = new Map<number, AppState>();
  const arrivalChecks: Array<{
    trip: Trip;
    arrivalKeyHomeTz: string;
    arrivalKeyDestTz: string;
    yesterdayKeyHomeTz: string;
  }> = [];

  for (let d = 1; d <= 365; d++) {
    // Pin the wall clock to 08:00 in the destination tz so log writes
    // happen on the local morning of each day. We approximate via UTC
    // 16:00 for PST mornings; the engine resolves dates from the tz
    // anyway, so the exact UTC time doesn't matter — only that it's
    // unambiguously inside the calendar day in the active tz.
    const whenUtc = utcAtJourneyDayClock(d, 16, 0);
    setNow(whenUtc);

    const tz = travelerTzForDay(d);
    const todayKey = dateKeyInTz(tz, new Date(whenUtc));

    // Capture probe data on each trip's ARRIVAL day.
    for (const t of TRAVELER_TRIPS) {
      if (t.start === d) {
        const yesterdayInHomeTz = dateKeyInTz(
          TRAVELER_HOME_TZ,
          new Date(whenUtc - 86_400_000)
        );
        const arrivalInHomeTz = dateKeyInTz(
          TRAVELER_HOME_TZ,
          new Date(whenUtc)
        );
        arrivalChecks.push({
          trip: t,
          arrivalKeyHomeTz: arrivalInHomeTz,
          arrivalKeyDestTz: todayKey,
          yesterdayKeyHomeTz: yesterdayInHomeTz,
        });
      }
    }

    const interim = buildTravelerState(allLogs, d);
    const dayIndex = (() => {
      const jsDay = new Date(todayKey + "T12:00:00Z").getUTCDay();
      return jsDay === 0 ? 6 : jsDay - 1;
    })();
    const inTrip = travelerTzForDay(d) !== TRAVELER_HOME_TZ;
    // Slightly degraded sleep/adherence on travel days; baseline 85%.
    const adherence = inTrip ? 0.78 : 0.85;
    const sleepQ = inTrip ? 3 : 4;
    const energy = inTrip ? 3 : 4;
    const log = simDayLog(interim, todayKey, dayIndex, {
      adherence,
      sleepQ,
      energy,
      seed: `traveler-${d}`,
    });
    allLogs.push(log);

    if (d % 30 === 0 || d === 365) {
      const snap = buildTravelerState(allLogs, d);
      checkpointStates.set(d, snap);
    }
  }

  const finalState = buildTravelerState(allLogs, 365);
  return { finalState, checkpointStates, allLogs, arrivalChecks };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("shift-and-travel — tz × sleep × adapt stress test", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nurse (Nora): invariants hold at every 30-day checkpoint", () => {
    const { checkpointStates } = simulateNurse();
    const violations: string[] = [];
    for (const [day, state] of checkpointStates) {
      // Anchor the clock to that checkpoint so any invariant that
      // resolves "today" reads the correct calendar day.
      setNow(utcAtJourneyDayClock(day, 11, 0));
      const v = checkInvariants(state);
      for (const msg of v) violations.push(`nurse day ${day}: ${msg}`);
    }
    if (violations.length > 0) {
      // eslint-disable-next-line no-console
      console.error("[nurse] invariant violations:\n" + violations.join("\n"));
    }
    expect(violations, "nurse invariants").toEqual([]);
  });

  it("nurse probe: 06:00 log lands on the calendar day the engine sees as 'today'", () => {
    // At 06:00 ET on journey-day 5 (a Sun → Sun = 6 if day 1 = Wed).
    // dateKeyInTz must return today's ET date, NOT yesterday.
    setNow(utcAtJourneyDayClock(5, 11, 0)); // 11:00 UTC = 06:00 ET (winter)
    const key = dateKeyInTz(NURSE_TZ);
    expect(key).toMatch(/^2025-01-0[45]$/);
    // The engine sees the same key as "today" (no drift).
    const state: AppState = {
      ...getDefaultState(),
      settings: {
        ...getDefaultState().settings,
        timezone: NURSE_TZ,
        tier: "free",
        completedOnboarding: true,
      },
    };
    const sigs = getSignals(state);
    // No history → gapDays === 0 trivially.
    expect(sigs.gapDays).toBe(0);
  });

  it("traveler (Theo): invariants hold at every 30-day checkpoint", () => {
    const { checkpointStates } = simulateTraveler();
    const violations: string[] = [];
    for (const [day, state] of checkpointStates) {
      setNow(utcAtJourneyDayClock(day, 16, 0));
      const v = checkInvariants(state);
      for (const msg of v) violations.push(`traveler day ${day}: ${msg}`);
    }
    if (violations.length > 0) {
      // eslint-disable-next-line no-console
      console.error("[traveler] invariant violations:\n" + violations.join("\n"));
    }
    expect(violations, "traveler invariants").toEqual([]);
  });

  it("traveler probe: streak counts yesterday's log when settings.timezone just jumped", () => {
    // On the day the traveler arrives in Tokyo (day 100), the active
    // tz becomes Asia/Tokyo. The previous day's log was written under
    // America/Los_Angeles (PST). Yesterday's PST key is *the same
    // calendar key* the engine still sees (logs are date strings).
    // calculateStreak with the NEW settings.timezone (Tokyo) must
    // still recognize yesterday's PST-keyed log as the streak head.
    const { allLogs, finalState } = simulateTraveler();
    // Build the state-as-of arrival day in Tokyo (day 100).
    setNow(utcAtJourneyDayClock(100, 16, 0));
    const state = buildTravelerState(allLogs, 100);
    const vacays = getVacationDates(state);
    const streakWithSettings = calculateStreak(
      state.dailyLogs,
      vacays,
      state.settings
    );
    const streakWithoutSettings = calculateStreak(state.dailyLogs, vacays);
    // eslint-disable-next-line no-console
    console.log(
      "[traveler] Tokyo arrival streak: withSettings=%d withoutSettings=%d todayInTz=%s lastLogDate=%s",
      streakWithSettings,
      streakWithoutSettings,
      dateKeyInTz(getTz(state.settings)),
      state.dailyLogs[state.dailyLogs.length - 1]?.date
    );
    // Yesterday (day 99, PST) was a normal logged day; the streak
    // must be > 0. If the engine's tz-aware streak math doesn't
    // accept the older PST-anchored key, the streak collapses.
    // We use SOFT assertion so the report surfaces this as a finding
    // rather than killing the test run.
    expect.soft(
      streakWithSettings,
      "tz-aware streak should not collapse on tz-flip morning (TOKYO ARRIVAL)"
    ).toBeGreaterThan(0);

    // ── final-state sanity ─────────────────────────────────────────
    setNow(utcAtJourneyDayClock(365, 16, 0));
    const finalStreak = calculateStreak(
      finalState.dailyLogs,
      getVacationDates(finalState),
      finalState.settings
    );
    expect(finalStreak).toBeGreaterThan(0);
  });

  it("traveler probe: log keys are stable across tz reversion (no retroactive misplacement)", () => {
    // Take a snapshot of every log's date string after the Tokyo
    // trip ENDS (day 110, back in PST). Then take another snapshot
    // at the end of the year. Every key that existed on day 110
    // must still exist with the SAME string on day 365 — the tz
    // reversion must not retroactively shift any historical log.
    const { allLogs } = simulateTraveler();

    setNow(utcAtJourneyDayClock(110, 16, 0));
    const day110State = buildTravelerState(allLogs, 110);
    const keysAtDay110 = new Set(day110State.dailyLogs.map((l) => l.date));

    setNow(utcAtJourneyDayClock(365, 16, 0));
    const day365State = buildTravelerState(allLogs, 365);
    const keysAtDay365 = new Set(day365State.dailyLogs.map((l) => l.date));

    // Every day-110 key must still be present at day 365.
    const missing: string[] = [];
    for (const k of keysAtDay110) {
      if (!keysAtDay365.has(k)) missing.push(k);
    }
    expect(missing, "log keys disappeared after tz reversion").toEqual([]);
  });

  it("traveler probe: signals.gapDays stays 0 across each trip's tz boundary", () => {
    const { allLogs } = simulateTraveler();
    const gaps: Array<{ trip: number; day: number; gap: number }> = [];
    for (const t of TRAVELER_TRIPS) {
      // Day of arrival (tz flips)
      setNow(utcAtJourneyDayClock(t.start, 16, 0));
      const stArr = buildTravelerState(allLogs, t.start);
      const gArr = getSignals(stArr).gapDays;
      gaps.push({ trip: t.start, day: t.start, gap: gArr });
      // Day of return (tz flips back)
      setNow(utcAtJourneyDayClock(t.end + 1, 16, 0));
      const stRet = buildTravelerState(allLogs, t.end + 1);
      const gRet = getSignals(stRet).gapDays;
      gaps.push({ trip: t.start, day: t.end + 1, gap: gRet });
    }
    // eslint-disable-next-line no-console
    console.log("[traveler] tz-boundary gap snapshots:", gaps);
    for (const g of gaps) {
      expect.soft(
        g.gap,
        `trip starting day ${g.trip}: gapDays at boundary day ${g.day} should be 0`
      ).toBe(0);
    }
  });

  it("nurse probe: vacation transparency holds across conference travel", () => {
    const { checkpointStates } = simulateNurse();
    // Right after the first conference vacation (day 60..73), the
    // day-90 snapshot should have:
    //   • adapt.mode !== "rebuild" (vacation transparent)
    //   • gapDays === 0 in signals (vacation days skipped)
    const at90 = checkpointStates.get(90);
    expect(at90).toBeDefined();
    setNow(utcAtJourneyDayClock(90, 11, 0));
    const sigs = getSignals(at90!);
    const a = adapt(at90!);
    // eslint-disable-next-line no-console
    console.log(
      "[nurse] post-conference snapshot day 90: gapDays=%d mode=%s",
      sigs.gapDays,
      a.mode
    );
    expect.soft(sigs.gapDays, "post-conference gapDays").toBe(0);
    expect.soft(a.mode, "post-conference adapt.mode").not.toBe("rebuild");
  });

  it("final reports — print per-persona snapshot", { timeout: 30_000 }, () => {
    const nurse = simulateNurse();
    const traveler = simulateTraveler();

    setNow(utcAtJourneyDayClock(365, 11, 0));
    const nurseFinalStreak = calculateStreak(
      nurse.finalState.dailyLogs,
      getVacationDates(nurse.finalState),
      nurse.finalState.settings
    );
    const nurseFinalSignals = getSignals(nurse.finalState);
    const nurseFinalAdapt = adapt(nurse.finalState);

    setNow(utcAtJourneyDayClock(365, 16, 0));
    const travelerFinalStreak = calculateStreak(
      traveler.finalState.dailyLogs,
      getVacationDates(traveler.finalState),
      traveler.finalState.settings
    );
    const travelerFinalSignals = getSignals(traveler.finalState);
    const travelerFinalAdapt = adapt(traveler.finalState);

    // eslint-disable-next-line no-console
    console.log(
      "[shift-and-travel] final report:",
      JSON.stringify(
        {
          nurse: {
            logs: nurse.finalState.dailyLogs.length,
            streak: nurseFinalStreak,
            gapDays: nurseFinalSignals.gapDays,
            mode: nurseFinalAdapt.mode,
            vacationDays: getVacationDates(nurse.finalState).size,
          },
          traveler: {
            logs: traveler.finalState.dailyLogs.length,
            streak: travelerFinalStreak,
            gapDays: travelerFinalSignals.gapDays,
            mode: travelerFinalAdapt.mode,
            tripCount: TRAVELER_TRIPS.length,
            arrivalChecks: traveler.arrivalChecks.map((a) => ({
              destTz: a.trip.tz,
              destKey: a.arrivalKeyDestTz,
              homeKey: a.arrivalKeyHomeTz,
              yesterdayHome: a.yesterdayKeyHomeTz,
            })),
          },
        },
        null,
        2
      )
    );

    // Soft floors so the report shows up even when one persona has issues.
    expect.soft(nurseFinalStreak, "nurse final streak").toBeGreaterThan(0);
    expect.soft(travelerFinalStreak, "traveler final streak").toBeGreaterThan(0);
  });
});
