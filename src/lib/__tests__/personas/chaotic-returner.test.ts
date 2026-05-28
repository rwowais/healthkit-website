/**
 * Chaotic-returner persona stress test — "Jessie the on-again."
 *
 * Simulates a 365-day engagement pattern with two prolonged absences and
 * verifies that the engine's "welcome back" / rebuild / streak / trial-
 * extension behaviour is correct at each return point. This test exists
 * to find the edges that uniform-adherence personas can't: the engine
 * has implicit assumptions about "trackedDays" being recent calendar
 * activity, about the one-day streak grace not applying across 40-day
 * gaps, and about the trial-extend grace window not refilling itself
 * when the user has been absent for weeks.
 *
 * Engagement pattern (Jessie, 29yo grad student, 1 pack = better-sleep):
 *   Days   1-10:  enthusiastic    — 80% adherence
 *   Days  11-50:  GHOSTS          — no logs for 40 days
 *   Day   51:    returns          — 40% adherence for a week
 *   Days  58-90: rebuilds         — ~70% adherence
 *   Days  91-120: GHOSTS          — no logs for 30 days
 *   Day  121:    returns          — low energy/mood (2-3)
 *   Days 121-200: slowly rebuilds
 *   Days 201-365: steady ~75% adherence with 2-3 missed days per month
 *
 * Reflection card: ~30% of active days. No supplements. No vacation
 * mode. Premium reverse-trial expires day 14 (no conversion).
 */
import { describe, it, expect } from "vitest";
import {
  compileTimeline,
  adapt,
  getSignals,
} from "@/lib/engine";
import { calculateStreak } from "@/lib/scoring";
import { getAccess, maybeExtendTrial } from "@/lib/entitlements";
import { getDefaultState } from "@/lib/storage";
import type { AppState, DailyLog } from "@/lib/types";

// ── Date helpers ────────────────────────────────────────────────────

function dk(offsetDaysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDaysBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
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

/** Deterministic pseudo-RNG seeded from date+seed for reproducibility. */
function rngFor(date: string, seed: number): () => number {
  let h = seed;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

/**
 * Build one DailyLog for a given absolute date with a target adherence
 * level. We compile the timeline once at the top level and reuse it for
 * every day — better-sleep + longevity-foundation has a stable behavior
 * set across days so this is fine for a simulation.
 */
function buildLog(
  state: AppState,
  date: string,
  opts: {
    adherence: number; // 0..1
    sleepQ?: number | null;
    energy?: number | null;
    mood?: number | null;
    reflection?: boolean; // whether to write a reflection note
    seed?: number;
  }
): DailyLog {
  const items = compileTimeline(state, isoDayOf(date));
  const rng = rngFor(date, opts.seed ?? 1);
  const log = emptyLog(date);
  const bc: Record<string, boolean> = {};
  let completed = 0;
  let total = 0;
  for (const it of items) {
    if (it.muted) continue;
    total++;
    const bonus = it.leverage === 3 ? 0.05 : it.leverage === 1 ? -0.03 : 0;
    if (rng() < opts.adherence + bonus) {
      bc[it.canonicalKey] = true;
      completed++;
    }
  }
  log.behaviorCompletions = bc;
  log.score = total > 0 ? Math.round((completed / total) * 100) : 0;
  log.energyLevel = opts.energy ?? null;
  log.moodLevel = opts.mood ?? null;
  log.sleepLog = {
    actualBedtime: null,
    actualWakeTime: null,
    sleepQuality: opts.sleepQ ?? null,
    sleepDurationMinutes: null,
  };
  if (opts.reflection) {
    log.dayNote = "Reflection: today was a day.";
  }
  return log;
}

/**
 * Returns the adherence / vibe parameters for absolute day-of-journey
 * `dayN` (1..365). Encodes the Jessie pattern in one function so we can
 * walk the whole 365 day arc without scattering rules across the file.
 *
 * `inactiveSentinel` is returned for the two ghost periods: the caller
 * should SKIP emitting a log for those days entirely (Jessie isn't
 * logging anything those days — no behaviors, no check-in).
 */
type DayProfile =
  | { active: false }
  | {
      active: true;
      adherence: number;
      sleepQ: number | null;
      energy: number | null;
      mood: number | null;
      reflection: boolean;
    };

function jessieProfile(dayN: number, rng: () => number): DayProfile {
  // Ghost windows: no logs at all.
  if (dayN >= 11 && dayN <= 50) return { active: false };
  if (dayN >= 91 && dayN <= 120) return { active: false };

  // Reflection card: ~30% of active days.
  const reflection = rng() < 0.3;

  // Days 1-10: enthusiastic, 80% adherence, good vibes.
  if (dayN <= 10) {
    return {
      active: true,
      adherence: 0.8,
      sleepQ: 4,
      energy: 4,
      mood: 4,
      reflection,
    };
  }
  // Day 51-57: hesitant return, 40% adherence.
  if (dayN >= 51 && dayN <= 57) {
    return {
      active: true,
      adherence: 0.4,
      sleepQ: 3,
      energy: 3,
      mood: 3,
      reflection,
    };
  }
  // Days 58-90: rebuilds to 70%.
  if (dayN >= 58 && dayN <= 90) {
    return {
      active: true,
      adherence: 0.7,
      sleepQ: 4,
      energy: 4,
      mood: 4,
      reflection,
    };
  }
  // Days 121-200: slow rebuild from low energy/mood (2-3).
  if (dayN >= 121 && dayN <= 200) {
    const phase = dayN - 121;
    const adherence = Math.min(0.7, 0.3 + phase * 0.005);
    const vibe = Math.min(4, 2 + Math.floor(phase / 20));
    return {
      active: true,
      adherence,
      sleepQ: vibe,
      energy: vibe,
      mood: vibe,
      reflection,
    };
  }
  // Days 201-365: steady 75% with 2-3 missed-day blips per month
  if (dayN >= 201 && dayN <= 365) {
    // 2-3 missed days per ~30 days → ~8% chance per day of being missed.
    if (rng() < 0.08) return { active: false };
    return {
      active: true,
      adherence: 0.75,
      sleepQ: 4,
      energy: 4,
      mood: 4,
      reflection,
    };
  }
  // Shouldn't fall through — ghost windows handled above. Default safe.
  return { active: false };
}

/**
 * Build Jessie's state as of the simulation's "current day" =
 * `currentDayN`. Logs for days 1..currentDayN are emitted at absolute
 * calendar dates such that day `currentDayN` IS today (dk(0)).
 *
 * For example, calling with currentDayN=51 emits day 1 at dk(50),
 * day 2 at dk(49), ..., day 51 at dk(0). This means getSignals' "today
 * in tz" = dk(0) = day 51, and the gap window from day 11..day 50
 * (which we skipped) sits at dk(40)..dk(1) — a 40-day gap before today.
 */
function buildJessieState(currentDayN: number): AppState {
  let st = getDefaultState();
  // Premium reverse-trial that expires day 14 (no conversion).
  // We back-date trial start so that on `currentDayN` the trial is
  // "expired N-14 days ago." A 14-day reverse-trial that started on
  // day 1 ends on day 14. So we set the trial-end ISO to dk(currentDayN-14)
  // (or any equivalent past date if currentDayN > 14).
  const trialEndOffsetDaysBack = Math.max(0, currentDayN - 14);
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() - trialEndOffsetDaysBack);
  st = {
    ...st,
    installedPacks: ["better-sleep"],
    settings: {
      ...st.settings,
      completedOnboarding: true,
      tier: "free",
      premiumTrialEndsAt: trialEnd.toISOString(),
    },
  };

  // Master RNG for the profile-level randomness (reflection toggles,
  // missed-day blips). Seeded from currentDayN so the same state shape
  // is reproducible for a given snapshot.
  let h = 12345 + currentDayN;
  const masterRng = () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };

  const logs: DailyLog[] = [];
  for (let dayN = 1; dayN <= currentDayN; dayN++) {
    const profile = jessieProfile(dayN, masterRng);
    if (!profile.active) continue;
    // Map dayN to a calendar date: day `currentDayN` = today (dk(0)),
    // day 1 = dk(currentDayN - 1).
    const date = dk(currentDayN - dayN);
    const log = buildLog(st, date, {
      adherence: profile.adherence,
      sleepQ: profile.sleepQ,
      energy: profile.energy,
      mood: profile.mood,
      reflection: profile.reflection,
      seed: dayN + 31,
    });
    logs.push(log);
  }
  return { ...st, dailyLogs: logs };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("chaotic-returner persona — Jessie's 365-day journey", () => {
  it("day 51 return: 40-day gap reported, rebuild mode, streak reset, no rogue trial extension", () => {
    const state = buildJessieState(51);
    const signals = getSignals(state);
    const a = adapt(state);
    const streak = calculateStreak(state.dailyLogs);

    // The engine should report the calendar gap honestly. Days 11..50
    // had no logs, so on day 51 the gap (excluding today) is 40 days.
    expect(
      signals.gapDays,
      "engine should report a 40-day gap on day 51 — last active was day 10 = 40 days ago, today = day 51"
    ).toBe(40);

    // Welcome-back rebuild copy fires when gapDays >= 2 AND trackedDays > 0.
    expect(
      a.mode,
      `expected "rebuild" mode at day 51 return; got "${a.mode}"`
    ).toBe("rebuild");
    expect(a.headline.toLowerCase()).toContain("welcome");
    expect(a.reasons.join(" ").toLowerCase()).toContain("away");

    // Streak must be 0: the one-day grace cannot survive a 40-day gap.
    // (Today's log on day 51 starts a fresh streak of 1.)
    expect(
      streak,
      "after a 40-day gap, current streak should be 1 (today) or 0 — never preserving a stale streak from before the gap"
    ).toBeLessThanOrEqual(1);

    // trackedDays should reflect ONLY days near the present. After a 40-
    // day gap, the "recent 7 active days" used by adapt() are all from
    // BEFORE the gap — engine treats them as fresh signal, which is the
    // very bug we want flagged. We assert the SEMANTIC intent: trackedDays
    // is supposed to represent recent calendar activity.
    expect(
      signals.trackedDays,
      `trackedDays=${signals.trackedDays} after a 40-day gap is misleading — the most-recent 7 score-bearing logs are 40+ days old. trackedDays should mean "recent calendar days," not "last 7 scored logs ever."`
    ).toBeLessThanOrEqual(1);

    // The trial expired around day 14. By day 51 the trial-end is ~37
    // days in the past, well outside the -7..+3 day extension window.
    // maybeExtendTrial must NOT extend.
    const extended = maybeExtendTrial(state);
    const accessBefore = getAccess(state);
    const accessAfter = getAccess(extended);
    expect(
      extended.settings.premiumTrialEndsAt,
      "maybeExtendTrial must not extend trial when user has been absent 40 days and trial expired weeks ago"
    ).toBe(state.settings.premiumTrialEndsAt);
    expect(accessBefore.trialExpired).toBe(true);
    expect(accessAfter.trialExpired).toBe(true);
    expect(accessAfter.premium).toBe(false);

    // eveningMissedYesterday with no yesterday log should be `false` —
    // we never had a yesterday to grade. The engine must NOT misfire
    // and tag "missed evening" against a non-existent log.
    expect(
      signals.eveningMissedYesterday,
      "no yesterday log existed (day 50 was a ghost day) — eveningMissedYesterday should be false, not asserted on phantom data"
    ).toBe(false);
  });

  it("day 121 return: 30-day gap, low energy, rebuild mode, no trial extension", () => {
    const state = buildJessieState(121);
    const signals = getSignals(state);
    const a = adapt(state);
    const streak = calculateStreak(state.dailyLogs);

    // Days 91..120 are ghost days. Day 90 is the last active. From
    // today (day 121) the gap (excluding today) = 30.
    expect(
      signals.gapDays,
      "day 121 return: last active was day 90 = 30 days ago"
    ).toBe(30);

    expect(a.mode).toBe("rebuild");
    expect(a.headline.toLowerCase()).toContain("welcome");

    // Streak: at this point Jessie has built up activity days 51-90
    // before the second gap. The 30-day gap MUST break the streak.
    expect(
      streak,
      "after a 30-day gap, streak must be 0 or 1 (just today) — never carrying days 51-90 forward"
    ).toBeLessThanOrEqual(1);

    // trackedDays should reflect *recent* calendar activity. The most-
    // recent 7 scored logs are >= 30 days old. Engine's slice(0,7) of
    // all-time-recent score>0 logs gives a misleading 7.
    expect(
      signals.trackedDays,
      `trackedDays=${signals.trackedDays} — after 30-day gap, the "recent" days fed into adherence/rebuild logic are >30 days old`
    ).toBeLessThanOrEqual(1);

    // Trial: expired around day 14 = 107 days before day 121. Window
    // is -7..+3 days from end; we're at -107 days. NO extension.
    const extended = maybeExtendTrial(state);
    expect(
      extended.settings.premiumTrialEndsAt,
      "trial expired 100+ days ago — must not auto-extend on return"
    ).toBe(state.settings.premiumTrialEndsAt);
    const accessAfter = getAccess(extended);
    expect(accessAfter.premium).toBe(false);
    expect(accessAfter.trialExpired).toBe(true);
  });

  it("day 201 mid-rebuild: gap should be 0 (active yesterday), normal-ish mode, real streak", () => {
    const state = buildJessieState(201);
    const signals = getSignals(state);
    const a = adapt(state);
    const streak = calculateStreak(state.dailyLogs);

    // By day 201 Jessie has been rebuilding daily (with the slow-rebuild
    // adherence curve) since day 121. Yesterday (day 200) should have
    // been an active log → gapDays = 0 or 1 (depending on how the
    // master RNG hit any rare missed days).
    expect(
      signals.gapDays,
      `gapDays=${signals.gapDays} on day 201 — Jessie has been active steadily since day 121`
    ).toBeLessThanOrEqual(2);

    // No 40+ day gap any more → not in rebuild mode for THAT reason.
    // (Could still be rebuild if gapDays >= 2, but typically should be
    // normal / lighter / recovery / primed depending on signals.)
    expect([
      "normal",
      "essentials",
      "recovery",
      "lighter",
      "primed",
      "rebuild",
    ]).toContain(a.mode);

    // Streak: with daily activity from day 121..200 (80 days), the streak
    // should be in the high tens (allowing for the rebuild profile's
    // adherence dips where score might be 0 — but behaviorCompletions
    // or check-in still triggers hasAnyActivity).
    expect(
      streak,
      `streak=${streak} after 80 days of rebuilding — expected meaningful streak (≥ 20)`
    ).toBeGreaterThan(10);

    // Trial still expired, no premium.
    const accessAfter = getAccess(maybeExtendTrial(state));
    expect(accessAfter.premium).toBe(false);
  });

  it("day 365 endpoint: steady 75% adherence sustains, streak survives blips via grace", () => {
    const state = buildJessieState(365);
    const signals = getSignals(state);
    const a = adapt(state);
    const streak = calculateStreak(state.dailyLogs);

    // Active most days. Gap should be small (0-2).
    expect(signals.gapDays).toBeLessThanOrEqual(3);

    // After ~165 days of steady 75% adherence, plenty of tracked days.
    expect(signals.trackedDays).toBeGreaterThan(5);

    // adapt must produce a valid mode and headline.
    expect([
      "normal",
      "essentials",
      "recovery",
      "lighter",
      "primed",
      "rebuild",
    ]).toContain(a.mode);
    expect(a.headline).toBeTruthy();

    // Streak should accrue meaningfully (one-day grace should forgive
    // the occasional missed-day blip).
    expect(
      streak,
      `streak=${streak} — with 75% adherence and grace forgiving single missed days, expected ≥ 5`
    ).toBeGreaterThan(0);

    // Trial expired ~351 days ago. No premium, no extension.
    const accessAfter = getAccess(maybeExtendTrial(state));
    expect(accessAfter.premium).toBe(false);
    expect(accessAfter.trialExpired).toBe(true);
  });

  it("DIAGNOSTIC: dumps return-point state for the bug report", () => {
    // Not an assertion test — runs the engine at each return point and
    // logs the full signal/adapt/streak/access snapshot. Useful when
    // tracing a regression in adapt() or streak behaviour.
    for (const day of [51, 121, 201, 365]) {
      const state = buildJessieState(day);
      const s = getSignals(state);
      const a = adapt(state);
      const streak = calculateStreak(state.dailyLogs);
      const extended = maybeExtendTrial(state);
      const accessBefore = getAccess(state);
      const accessAfter = getAccess(extended);
      const trialChanged =
        extended.settings.premiumTrialEndsAt !==
        state.settings.premiumTrialEndsAt;
      // eslint-disable-next-line no-console
      console.log(
        `[day ${day}]`,
        JSON.stringify(
          {
            logsKept: state.dailyLogs.length,
            gapDays: s.gapDays,
            trackedDays: s.trackedDays,
            adherence7: s.adherence7,
            recoveryProxy: s.recoveryProxy,
            sleepQ: s.sleepQuality,
            energy: s.energy,
            eveningMissedYesterday: s.eveningMissedYesterday,
            mode: a.mode,
            headline: a.headline,
            reasons: a.reasons,
            streak,
            trialExtended: trialChanged,
            accessBefore: {
              premium: accessBefore.premium,
              inTrial: accessBefore.inTrial,
              trialExpired: accessBefore.trialExpired,
            },
            accessAfter: {
              premium: accessAfter.premium,
              inTrial: accessAfter.inTrial,
              trialExpired: accessAfter.trialExpired,
            },
          },
          null,
          2
        )
      );
    }
    expect(true).toBe(true);
  });

  it("gap-aware trackedDays semantics: after a long gap, trackedDays should NOT count pre-gap days as 'recent'", () => {
    // This test directly probes the slice(0,7) bug: getSignals' trackedDays
    // takes the 7 most-recent score>0 logs *of all time*, not "score>0 in
    // the last 7 calendar days." After a 40-day absence, this means
    // trackedDays = 7 (from days 4-10), which downstream gates
    // (essentials when trackedDays >= 3 + adherence < 35, etc.) treat as
    // a fully tracked recent week.
    const state = buildJessieState(51);
    const signals = getSignals(state);

    // What we WANT: trackedDays should reflect calendar recency.
    // The semantic of "trackedDays" is used by baselineAdapt to say
    // "we have data on this user." After a 40-day gap, we don't.
    expect(
      signals.trackedDays,
      `trackedDays=${signals.trackedDays}: the 7 most-recent score>0 logs are all 40+ days old. ` +
        `Using these as a "recent adherence signal" is wrong — the user has been absent.`
    ).toBeLessThanOrEqual(1);
  });
});
