/**
 * Injured-athlete persona — 365-day stress test of the workout-swap path.
 *
 * Sam, 31yo lifter:
 *  - Days 1-90:   peak phase. 3 packs, 90% adherence, high energy.
 *  - Day  91:     shoulder injury.
 *  - Days 91-150: every scheduled strength/hiit/vo2max → SWAP to extended-walk.
 *                 Zone 2 stays. Sleep 3, energy 3, mood 2-3.
 *  - Days 151-200: gradual return. 70% of strength swapped to walks, 30% kept.
 *  - Days 201-365: full intensity again, 88% adherence.
 *
 * Probes the new swap behavior end-to-end: swapBehavior() call site,
 * easierDayFromSwap detection, applySwaps mutation, adapt() composition,
 * mastery exclusion, JSON round-trip survival.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import {
  compileTimeline,
  applySwaps,
  adapt,
  getSignals,
  masteredKeys,
  shapeTimeline,
} from "@/lib/engine";
import { getDefaultState, swapBehavior } from "@/lib/storage";
import { easierDayFromSwap } from "@/lib/workouts";
import type { AppState, DailyLog } from "@/lib/types";

// Pin the clock so dk()'s `new Date()` is deterministic and agrees with
// the engine's own "today". This runs at MODULE scope (not in a hook)
// because the 365-day journey fixture is built at collection time (the
// `const samState = buildSam()` in the describe body), which executes
// before any beforeEach/beforeAll. Pinning here means the journey's dates
// AND the in-test dk() queries share one clock; otherwise they disagree
// and mastery (date/streak-sensitive) intermittently fails depending on
// the real run time — a time-of-day flake, not a logic bug (same class as
// the vacation-traveler fix). Noon mid-month avoids DST / midnight edges.
const FIXED_NOW = new Date(2026, 5, 15, 12, 0, 0);
vi.useFakeTimers();
vi.setSystemTime(FIXED_NOW);
afterAll(() => {
  vi.useRealTimers();
});

// ── helpers ──────────────────────────────────────────────────────

/** YYYY-MM-DD for a date offset (negative = past). */
function dk(offsetDaysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDaysBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function isoDayOf(dateStr: string): number {
  const j = new Date(dateStr + "T00:00:00").getDay();
  return j === 0 ? 6 : j - 1;
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
    pillarScores: { sleep: 0, exercise: 0, diet: 0, supplements: 0 },
    behaviorCompletions: {},
  } as unknown as DailyLog;
}

// Behaviors that get swapped to extended-walk during the injury window.
const SWAP_TARGETS = new Set(["strength", "tabata-hiit", "vo2max-intervals"]);
const REPLACEMENT_KEY = "extended-walk";

/**
 * Simulate a single day. If `injurySwap` is true, every scheduled
 * workout in SWAP_TARGETS is swapped to extended-walk via swapBehavior()
 * (so the swap is the REAL path the production code takes).
 *
 * Returns the updated state — swapBehavior writes the log into
 * state.dailyLogs and re-computes streak.
 */
function simulateDay(
  state: AppState,
  daysBack: number,
  opts: {
    adherence: number;
    sleepQ: number | null;
    energy: number | null;
    mood?: number | null;
    seed?: number;
    injurySwap?: boolean;
    partialReturn?: boolean; // 70% swap, 30% keep
  }
): AppState {
  const date = dk(daysBack);
  const dayIndex = isoDayOf(date);
  const items = compileTimeline(state, dayIndex);

  // Deterministic pseudo-RNG keyed on date + seed.
  let h = opts.seed ?? 1;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rng = () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };

  // Start by writing/updating the log with check-in data.
  const existingIdx = state.dailyLogs.findIndex((l) => l.date === date);
  const base = existingIdx >= 0 ? state.dailyLogs[existingIdx] : emptyLog(date);

  // Determine which workouts in today's timeline are SWAP_TARGETS.
  const swappableToday = items.filter(
    (it) => SWAP_TARGETS.has(it.canonicalKey) && !it.muted
  );

  // Apply swaps first (mutates state via swapBehavior). For partial-return
  // days, only swap ~70% of the eligible workouts.
  let nextState = state;
  let didSwap = false;
  if (opts.injurySwap) {
    for (const sw of swappableToday) {
      if (opts.partialReturn && rng() < 0.3) continue; // keep 30%
      nextState = swapBehavior(nextState, date, sw.canonicalKey, REPLACEMENT_KEY);
      didSwap = true;
    }
  }

  // Re-fetch the log after potential swap mutations.
  const log = nextState.dailyLogs.find((l) => l.date === date) ?? base;

  // Complete remaining (non-swapped) behaviors per adherence probability.
  // applySwaps gives us the post-swap view of the day.
  const postSwap = applySwaps(compileTimeline(nextState, dayIndex), log);
  const bc: Record<string, boolean> = { ...(log.behaviorCompletions ?? {}) };
  let completed = 0;
  let total = 0;
  for (const it of postSwap) {
    if (it.muted) continue; // swapped originals are muted
    total++;
    if (bc[it.canonicalKey]) {
      completed++;
      continue;
    }
    const bonus = it.leverage === 3 ? 0.08 : it.leverage === 1 ? -0.05 : 0;
    if (rng() < opts.adherence + bonus) {
      bc[it.canonicalKey] = true;
      completed++;
    }
  }

  const updated: DailyLog = {
    ...log,
    behaviorCompletions: bc,
    score: total > 0 ? Math.round((completed / total) * 100) : 0,
    energyLevel: opts.energy,
    moodLevel: opts.mood ?? null,
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: opts.sleepQ,
      sleepDurationMinutes: null,
    },
  };

  const idx = nextState.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? nextState.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...nextState.dailyLogs, updated];

  return { ...nextState, dailyLogs };
}

/**
 * Build the persona by walking 365 days back-to-front (day 1 is the
 * earliest). On each day we may call swapBehavior() and update the log.
 *
 * Note on time direction: dk(N) means "N days ago". To get the
 * chronologically-correct sequence (day 1 ≈ Sam's first day), we simulate
 * by feeding decreasing daysBack: day 1 = dk(364), day 365 = dk(0).
 */
function buildSam(): AppState {
  let state = getDefaultState();
  state = {
    ...state,
    installedPacks: ["longevity-foundation", "better-sleep", "heart-health"],
    settings: { ...state.settings, completedOnboarding: true },
  };

  for (let day = 1; day <= 365; day++) {
    const daysBack = 365 - day; // day 1 → 364 days back, day 365 → 0
    let opts: Parameters<typeof simulateDay>[2];

    if (day <= 90) {
      // Peak phase
      opts = {
        adherence: 0.9,
        sleepQ: day % 3 === 0 ? 4 : 5,
        energy: day % 4 === 0 ? 4 : 5,
        mood: 4,
        seed: day,
      };
    } else if (day <= 150) {
      // Injury — swap high-intensity workouts to walks every day.
      opts = {
        adherence: 0.7,
        sleepQ: 3,
        energy: 3,
        mood: day % 2 === 0 ? 2 : 3,
        seed: day,
        injurySwap: true,
      };
    } else if (day <= 200) {
      // Gradual return — 70% swap, 30% keep.
      opts = {
        adherence: 0.75,
        sleepQ: 4,
        energy: 4,
        mood: 3,
        seed: day,
        injurySwap: true,
        partialReturn: true,
      };
    } else {
      // Full return
      opts = {
        adherence: 0.88,
        sleepQ: day % 3 === 0 ? 4 : 5,
        energy: day % 5 === 0 ? 4 : 5,
        mood: 4,
        seed: day,
      };
    }
    state = simulateDay(state, daysBack, opts);
  }
  return state;
}

// ── tests ────────────────────────────────────────────────────────

describe("injured-athlete persona — 365-day workout-swap stress", () => {
  const samState = buildSam();

  it("baseline assertions: state has 365 logs, swaps are present", () => {
    expect(samState.dailyLogs.length).toBe(365);
    const withSwaps = samState.dailyLogs.filter(
      (l) => l.swaps && Object.keys(l.swaps).length > 0
    );
    expect(withSwaps.length).toBeGreaterThan(50);
  });

  // ── milestone: injury onset (days 91-100) ────────────────────────

  it("injury onset — easierDayFromSwap fires on swap days (91-100)", () => {
    for (let day = 91; day <= 100; day++) {
      const daysBack = 365 - day;
      const log = samState.dailyLogs.find((l) => l.date === dk(daysBack));
      if (!log) continue;
      if (!log.swaps || Object.keys(log.swaps).length === 0) continue;
      // Reconstruct "today" view by trimming state to this day.
      const trimmed = trimStateToDay(samState, daysBack);
      const sig = getSignals(trimmed);
      const easier = easierDayFromSwap(log);
      // If at least one swap is high→low (strength→walk), easier=true.
      const hasHighToLow = Object.entries(log.swaps).some(([from, to]) => {
        return SWAP_TARGETS.has(from) && to === REPLACEMENT_KEY;
      });
      if (hasHighToLow) {
        expect(easier, `day ${day} easierDayFromSwap should be true`).toBe(true);
        expect(
          sig.easierDayFromSwap,
          `day ${day} getSignals.easierDayFromSwap should be true`
        ).toBe(true);
      }
    }
  });

  it("injury onset — adapt() goes to lighter or recovery on swap days", () => {
    for (let day = 91; day <= 100; day++) {
      const daysBack = 365 - day;
      const log = samState.dailyLogs.find((l) => l.date === dk(daysBack));
      if (!log || !log.swaps || Object.keys(log.swaps).length === 0) continue;
      const trimmed = trimStateToDay(samState, daysBack);
      const a = adapt(trimmed);
      // recovery wins when recoveryProxy < 45 (sleep 3 + energy 3 ≈ 60 → no recovery)
      // lighter wins from sleep<=2 OR easierDayFromSwap.
      // Sleep is 3, so the easierDayFromSwap branch is what should fire.
      expect(
        ["lighter", "recovery", "essentials"],
        `day ${day} expected lighter/recovery/essentials, got ${a.mode}`
      ).toContain(a.mode);
    }
  });

  // ── milestone: mid-injury (day 120, 150) ─────────────────────────

  it("mid-injury — applySwaps mutes original + injects replacement (day 120)", () => {
    const daysBack = 365 - 120;
    const date = dk(daysBack);
    const log = samState.dailyLogs.find((l) => l.date === date);
    expect(log).toBeDefined();
    expect(log!.swaps && Object.keys(log!.swaps).length > 0).toBe(true);

    const dayIndex = isoDayOf(date);
    const items = compileTimeline(samState, dayIndex);
    const post = applySwaps(items, log);

    // Every swap key (from) should now appear muted with swappedTo set.
    for (const fromKey of Object.keys(log!.swaps!)) {
      const original = post.find((it) => it.canonicalKey === fromKey);
      if (original) {
        expect(original.muted).toBe(true);
        expect(original.swappedTo).toBe(REPLACEMENT_KEY);
        expect(original.muteReason).toMatch(/swapped/i);
      }
    }

    // The replacement should be in the post-swap timeline.
    const replacement = post.find((it) => it.canonicalKey === REPLACEMENT_KEY);
    expect(replacement).toBeDefined();
    expect(replacement!.swappedFrom).toBeDefined();
  });

  it("mid-injury — replacement auto-completed via swapBehavior (day 120)", () => {
    const daysBack = 365 - 120;
    const log = samState.dailyLogs.find((l) => l.date === dk(daysBack));
    expect(log).toBeDefined();
    // swapBehavior auto-completes the replacement.
    expect(log!.behaviorCompletions?.[REPLACEMENT_KEY]).toBe(true);
    // And the original was cleared.
    for (const fromKey of Object.keys(log!.swaps!)) {
      expect(log!.behaviorCompletions?.[fromKey]).toBeFalsy();
    }
  });

  it("mid-injury — mastery does NOT credit strength during injury (day 150)", () => {
    const daysBack = 365 - 150;
    const dayKey = dk(daysBack);
    const m = masteredKeys(samState, dayKey);
    // Sam had 90 days of 90% strength adherence pre-injury, then 60 days
    // of swaps. The current streak for `strength` should be broken;
    // mastery requires a current 21-day streak.
    expect(
      m.has("strength"),
      "strength should NOT be mastered during injury window"
    ).toBe(false);
    expect(
      m.has("tabata-hiit"),
      "tabata-hiit should NOT be mastered during injury"
    ).toBe(false);
    expect(
      m.has("vo2max-intervals"),
      "vo2max-intervals should NOT be mastered during injury"
    ).toBe(false);
  });

  it("mastery fires for unaffected behaviors, EXCLUDING swap-target workouts", () => {
    // (1) PRESENCE — over the full journey, SOME non-swap behavior masters.
    // Scanned across the whole journey rather than at a single mid-injury
    // day: mastery needs 21 *consecutive* scheduled completions, which the
    // 0.7-adherence injury phase (days 91-150) routinely breaks, so any
    // single mid-injury probe is RNG-luck-dependent on how the seeded
    // completions land against each behavior's schedule — that's exactly
    // why the old day-150 probe was a time-of-day flake.
    let everNonSwapMastered = false;
    for (let day = 30; day <= 365; day++) {
      for (const k of masteredKeys(samState, dk(365 - day))) {
        if (!SWAP_TARGETS.has(k)) everNonSwapMastered = true;
      }
    }
    expect(
      everNonSwapMastered,
      "expected at least one non-swap behavior to master somewhere in the journey"
    ).toBe(true);

    // (2) EXCLUSION — during the deep-injury window (days 120-150, when
    // every scheduled strength/HIIT/VO2max session is swapped to a walk),
    // no swap-target may be mastered: each swap breaks the streak and the
    // swapped-in replacement doesn't inherit the original's credit. This is
    // the real contract this test guards, and it's deterministic (swaps
    // aren't adherence-gated), so it holds at every anchor. Swap-targets
    // CAN legitimately master in the pre-injury peak and the late full-
    // return phase — correct, hence the windowed check rather than global.
    for (let day = 120; day <= 150; day++) {
      const mastered = masteredKeys(samState, dk(365 - day));
      for (const target of SWAP_TARGETS) {
        expect(
          mastered.has(target),
          `swap target "${target}" must not be mastered during injury — day ${day}`
        ).toBe(false);
      }
    }
  });

  // ── milestone: recovery (day 200) ────────────────────────────────

  it("recovery phase — partial return still triggers easier-day on swap days (day 200)", () => {
    // Day 200 falls in 151-200 partial-return window.
    const daysBack = 365 - 200;
    const log = samState.dailyLogs.find((l) => l.date === dk(daysBack));
    expect(log).toBeDefined();
    const trimmed = trimStateToDay(samState, daysBack);
    const sig = getSignals(trimmed);
    if (log!.swaps && Object.keys(log!.swaps).length > 0) {
      expect(sig.easierDayFromSwap).toBe(true);
    }
  });

  // ── milestone: full return (day 300) ─────────────────────────────

  it("full return — no swaps, adapt mode is normal/primed (day 300)", () => {
    const daysBack = 365 - 300;
    const log = samState.dailyLogs.find((l) => l.date === dk(daysBack));
    expect(log).toBeDefined();
    expect(log!.swaps && Object.keys(log!.swaps).length > 0).toBeFalsy();
    const trimmed = trimStateToDay(samState, daysBack);
    const sig = getSignals(trimmed);
    expect(sig.easierDayFromSwap).toBe(false);
    const a = adapt(trimmed);
    expect(["normal", "primed", "lighter"]).toContain(a.mode);
  });

  // ── adapt() composition: low recovery vs swap-easier-day ─────────

  it("adapt composition — low-recovery should NOT be overridden by swap (priority)", () => {
    // Build a synthetic state with BOTH low recovery (sleep 1, energy 1)
    // AND a high→low workout swap. recoveryProxy = (1/5*100*0.6 + 1/5*100*0.4) = 20
    // which is < 45 → recovery mode should win.
    let s = getDefaultState();
    s = {
      ...s,
      installedPacks: ["longevity-foundation"],
      settings: { ...s.settings, completedOnboarding: true },
    };
    const today = dk(0);
    // Seed 14 prior days of activity so trackedDays > 0 (not a fresh start).
    for (let i = 1; i <= 14; i++) {
      const log = emptyLog(dk(i));
      log.behaviorCompletions = { "morning-sunlight": true };
      log.score = 50;
      log.energyLevel = 4;
      log.sleepLog = { ...log.sleepLog, sleepQuality: 4 };
      s.dailyLogs.push(log);
    }
    // Today: poor sleep + poor energy + swap.
    s = swapBehavior(s, today, "strength", REPLACEMENT_KEY);
    const tLog = s.dailyLogs.find((l) => l.date === today)!;
    tLog.sleepLog = { ...tLog.sleepLog, sleepQuality: 1 };
    tLog.energyLevel = 1;
    const sig = getSignals(s);
    expect(sig.easierDayFromSwap).toBe(true);
    expect(sig.recoveryProxy).not.toBeNull();
    expect(sig.recoveryProxy!).toBeLessThan(45);
    const a = adapt(s);
    // recovery branch fires before easierDayFromSwap branch in baselineAdapt.
    expect(a.mode).toBe("recovery");
  });

  // ── JSON round-trip survival ─────────────────────────────────────

  it("JSON round-trip — swaps + completions survive stringify/parse", () => {
    const snapshot = JSON.stringify(samState);
    const restored = JSON.parse(snapshot) as AppState;
    expect(restored.dailyLogs.length).toBe(samState.dailyLogs.length);
    // Pick a known-swap day (day 120).
    const dayKey = dk(365 - 120);
    const orig = samState.dailyLogs.find((l) => l.date === dayKey)!;
    const reloaded = restored.dailyLogs.find((l) => l.date === dayKey)!;
    expect(reloaded.swaps).toEqual(orig.swaps);
    expect(reloaded.behaviorCompletions?.[REPLACEMENT_KEY]).toBe(true);
    // easierDayFromSwap still detects on the restored log.
    expect(easierDayFromSwap(reloaded)).toBe(true);
    // applySwaps still works.
    const items = compileTimeline(restored, isoDayOf(dayKey));
    const post = applySwaps(items, reloaded);
    const rep = post.find((it) => it.canonicalKey === REPLACEMENT_KEY);
    expect(rep).toBeDefined();
  });

  // ── day-365 capture: metrics report ──────────────────────────────

  it("day-365 metrics capture — swap count, lighter-mode runs, mastery, streak", () => {
    // Total swap count (sum across all days).
    let totalSwaps = 0;
    for (const log of samState.dailyLogs) {
      if (log.swaps) totalSwaps += Object.keys(log.swaps).length;
    }

    // Longest run of "lighter" mode days.
    let longestLighter = 0;
    let currentRun = 0;
    const parseKeyUtc = (k: string) => {
      const [y, m, d] = k.split("-").map(Number);
      return Date.UTC(y, m - 1, d, 12, 0, 0);
    };
    for (let i = 0; i < samState.dailyLogs.length; i++) {
      const log = samState.dailyLogs[i];
      const daysBack = Math.round(
        (parseKeyUtc(dk(0)) - parseKeyUtc(log.date)) / 86_400_000
      );
      const trimmed = trimStateToDay(samState, daysBack);
      const a = adapt(trimmed);
      if (a.mode === "lighter") {
        currentRun++;
        longestLighter = Math.max(longestLighter, currentRun);
      } else {
        currentRun = 0;
      }
    }

    // Mastery list at day 365.
    const m = masteredKeys(samState, dk(0));

    // Current streak (state field).
    const streak = samState.currentStreak;

    // Print so the test report carries the numbers.
    // eslint-disable-next-line no-console
    console.log("DAY-365 METRICS", {
      totalSwaps,
      longestLighterRun: longestLighter,
      mastery: Array.from(m),
      currentStreak: streak,
    });

    // Soft assertions: the metrics should be non-degenerate.
    expect(totalSwaps).toBeGreaterThan(50);
    expect(streak).toBeGreaterThanOrEqual(0);
  });
});

// ── helper: trim state to a specific day (treat that day as "today") ──

/**
 * Returns a copy of state with dailyLogs filtered to <= dayKey, so
 * adapt/getSignals see only the history up through that day. The "today"
 * for adapt() is determined by the system clock and the user's tz — we
 * can't override that without mocking, so we keep ALL logs but the
 * functions look at the today key naturally. For mid-history days, we
 * approximate by trimming logs to that day and shifting their dates so
 * the most-recent log is "today". Simpler: re-key the latest log to
 * today's key and walk back from there.
 *
 * NOTE: This is an approximation — the real adapt() uses dateKeyInTz()
 * on the system clock for "today". For history points, we shift every
 * log key forward by (365-day) days so the "current day" of interest
 * becomes today's key. Behaviors / packs are unchanged.
 */
function trimStateToDay(state: AppState, daysBack: number): AppState {
  // Logs up to and including the target day, mapped so the target day's
  // log lands on today's date. DST-safe: use noon-UTC anchoring on the
  // YYYY-MM-DD string parts so DST transitions between target and today
  // don't shift dates by ±1 day.
  const parseKey = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d, 12, 0, 0);
  };
  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  const todayKey = dk(0);
  const targetDayKey = dk(daysBack);
  const targetTs = parseKey(targetDayKey);
  const todayTs = parseKey(todayKey);
  const shiftMs = todayTs - targetTs;

  const shifted: DailyLog[] = [];
  for (const log of state.dailyLogs) {
    const ts = parseKey(log.date);
    if (ts > targetTs) continue; // future relative to the target day
    const newDate = formatTs(ts + shiftMs);
    shifted.push({ ...log, date: newDate });
  }
  return { ...state, dailyLogs: shifted };
}
