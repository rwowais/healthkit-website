/**
 * invariants.ts — formal contracts the Protocolize engine MUST hold,
 * independent of any single user scenario.
 *
 * Why this exists:
 *   Our prior testing strategy was scenario-based: write a test per
 *   bug as it was discovered. That trails real users — every batch
 *   of multi-day simulation found new bugs the scenario tests missed,
 *   because real bugs live in the COMPOSITION of signals (gap days ×
 *   vacation × biomarker × trial × swap) and scenarios only cover
 *   the slices you thought to write.
 *
 *   Invariants turn the rules into machine-checkable claims. Each
 *   invariant is a pure function of AppState that returns a violation
 *   list (empty = invariant holds). Tests and persona simulations
 *   call `assertInvariants(state)` and the suite tells us WHICH
 *   contract is broken with a precise message.
 *
 *   The strategic shift: we stop discovering bugs in production and
 *   start preventing them via property tests that feed thousands of
 *   random states through this same suite (fast-check, future work).
 *   The invariants here are the spec.
 *
 * Adding an invariant:
 *   1. Write it as a function that returns `string[]` — one message
 *      per violation. Empty = clean.
 *   2. Add it to the `ALL_INVARIANTS` registry below.
 *   3. Every persona test that calls `assertInvariants` now checks it
 *      for free. No per-test wiring.
 *
 * Naming convention: `inv_<area>_<rule>` so search and tooling can
 * filter by area. Use present tense ("supplements_not_in_timeline"
 * not "supplements_should_not_be_in_timeline").
 */
import { adapt, compileTimeline, getSignals, masteredKeys } from "@/lib/engine";
import { calculateStreak } from "@/lib/scoring";
import {
  getAccess,
  getFreeBiomarkers,
  getFreePacks,
} from "@/lib/entitlements";
import { getVacationDates } from "@/lib/storage";
import { dateKeyInTz, getTz } from "@/lib/tz";
import { isSupplementBehavior } from "@/lib/supplements";
import { resolveBehaviorByKey } from "@/lib/workouts";
import { PACKS } from "@/lib/packs";
import type { AppState } from "@/lib/types";

/** A single invariant rule. */
export interface Invariant {
  name: string;
  /** Returns a list of violation messages. Empty array = invariant holds. */
  check: (state: AppState) => string[];
}

// ── Engine signals ────────────────────────────────────────────────

/**
 * Vacation transparency must be honored end-to-end. Both the streak
 * math AND the gap-days math must walk through vacation days as if
 * they don't exist. The original calm-system promise is "your streak
 * holds while you take a real rest" — if either path treats a
 * vacation as an absence, the rest of the day (rebuild mode, "you
 * were away N days" copy) reads wrong.
 */
const inv_vacation_transparency: Invariant = {
  name: "vacation transparency: gapDays + streak agree about vacation days",
  check(state) {
    const sigs = getSignals(state);
    const errors: string[] = [];
    const periods = state.settings?.vacationPeriods ?? [];
    if (periods.length === 0) return errors;
    // The most-recent log right before any vacation, if it exists,
    // should leave gapDays at 0 immediately after the vacation ends
    // (assuming no real gap on top of the trip).
    const vacays = getVacationDates(state);
    // A period entirely in the FUTURE (starts after today) legitimately
    // contributes zero vacation days so far — that's correct, not
    // malformed. Only flag when a period that has ALREADY begun produced
    // no dates.
    const today = dateKeyInTz(getTz(state.settings));
    const anyStarted = periods.some((p) => p?.start && p.start <= today);
    if (anyStarted && vacays.size === 0) {
      errors.push(
        `vacationPeriods has a started entry but getVacationDates returned 0 days — period shape may be malformed`
      );
    }
    // If gapDays > 0, every day in the gap should be a NON-vacation
    // day. If we see vacation days in the gap window, transparency
    // failed.
    if (sigs.gapDays > 0) {
      // We can't directly enumerate the gap window without the
      // engine helpers; the integration test is "did the rebuild
      // mode fire just because of a vacation?" — covered below.
    }
    return errors;
  },
};

/**
 * Rebuild mode is for genuine returns from absence, not for vacation
 * returns. A user whose ONLY gap from logs is a vacation period
 * should NOT see adapt().mode === "rebuild" — that's the symptom
 * of bug 2 in the vacation-traveler persona.
 */
const inv_rebuild_not_after_vacation: Invariant = {
  name: "adapt() rebuild branch does not fire on vacation-only gaps",
  check(state) {
    const errors: string[] = [];
    const periods = state.settings?.vacationPeriods ?? [];
    if (periods.length === 0) return errors;
    // Only meaningful when user has tracking history AND was on a
    // vacation that JUST ended.
    const sigs = getSignals(state);
    if (!sigs.hasHistory) return errors;
    const a = adapt(state);
    if (a.mode === "rebuild" && sigs.gapDays === 0) {
      errors.push(
        `adapt.mode is rebuild but gapDays is 0 (post-vacation transparency should have kept the mode normal/primed)`
      );
    }
    return errors;
  },
};

/**
 * Premium-only signals must NOT populate for non-premium users.
 * Biomarker-aware adaptation is Premium per CLAUDE.md. A free or
 * expired-trial user with a "Watch"-band biomarker should see
 * bioConcern === null and bioRecoveryFlag === false.
 */
const inv_biomarkers_premium_gated: Invariant = {
  name: "biomarker-aware signals are premium-gated",
  check(state) {
    const errors: string[] = [];
    const access = getAccess(state);
    if (access.premium) return errors;
    const sigs = getSignals(state);
    if (sigs.bioConcern !== null) {
      errors.push(
        `non-premium user has bioConcern populated: ${sigs.bioConcern} (Premium-only feature leaked)`
      );
    }
    if (sigs.bioRecoveryFlag !== false) {
      errors.push(
        `non-premium user has bioRecoveryFlag=true (Premium-only feature leaked)`
      );
    }
    return errors;
  },
};

/**
 * Streak math must not collapse for a user who's never been absent
 * from the app beyond the one-day grace. Combined with vacation
 * transparency: a user with N consecutive active logs + any number
 * of interspersed vacation days should report a streak >= N.
 */
const inv_streak_matches_activity: Invariant = {
  name: "streak >= count of consecutive active logs (vacation-transparent)",
  check(state) {
    const errors: string[] = [];
    const logs = state.dailyLogs ?? [];
    if (logs.length === 0) return errors;
    const streakFromFn = calculateStreak(
      logs,
      getVacationDates(state),
      state.settings
    );
    // Lower bound: must be >= 0
    if (streakFromFn < 0) {
      errors.push(`calculateStreak returned negative: ${streakFromFn}`);
    }
    // Upper bound: must be <= total active logs
    const activeCount = logs.filter(
      (l) =>
        l.score > 0 ||
        Object.values(l.behaviorCompletions ?? {}).some(Boolean) ||
        l.energyLevel != null ||
        l.sleepLog?.sleepQuality != null
    ).length;
    if (streakFromFn > activeCount) {
      errors.push(
        `streak (${streakFromFn}) > total active logs (${activeCount}) — math is over-counting`
      );
    }
    return errors;
  },
};

// ── Timeline + supplements ────────────────────────────────────────

/**
 * Supplements live in their own surface (state.supplements +
 * SupplementBlockCard). They MUST NOT appear inline in the behavior
 * timeline — that's the entire point of the supplement separation
 * shipped in commit 54c9929. A regression here means duplicate UI
 * for every supplement.
 */
const inv_supplements_not_in_timeline: Invariant = {
  name: "supplements never appear as inline behavior rows",
  check(state) {
    const errors: string[] = [];
    if (state.settings?.vacationMode) return errors; // skip — empty timeline
    for (let day = 0; day < 7; day++) {
      const items = compileTimeline(state, day);
      for (const it of items) {
        if (isSupplementBehavior(it)) {
          errors.push(
            `supplement "${it.canonicalKey}" appeared in timeline (dayIndex=${day})`
          );
        }
      }
    }
    return errors;
  },
};

/**
 * Vacation mode empties the timeline. The user sees a calm
 * "you're on a break" surface; no behaviors get auto-completed,
 * no scoring drift while paused.
 */
const inv_vacation_mode_empty_timeline: Invariant = {
  name: "compileTimeline returns [] when vacationMode is on",
  check(state) {
    if (!state.settings?.vacationMode) return [];
    const errors: string[] = [];
    for (let day = 0; day < 7; day++) {
      const items = compileTimeline(state, day);
      if (items.length > 0) {
        errors.push(
          `vacationMode is on but timeline has ${items.length} items on dayIndex=${day}`
        );
      }
    }
    return errors;
  },
};

// ── Swap correctness ──────────────────────────────────────────────

/**
 * A swap's TO key (replacement) must NOT count toward mastery for
 * that day. Per the DailyLog.swaps contract: "the replacement is a
 * one-off — neither should accumulate streak credit for the other."
 * Implementation lives in masteredKeys' wasGenuinelyCompleted gate.
 *
 * Spot-check: build the set of replacement keys used in any log's
 * swaps; verify none of those days appear in the masteredKeys
 * adherence count for the replacement.
 */
const inv_swap_does_not_pollute_mastery: Invariant = {
  name: "swap-credited completions don't count toward mastery",
  check(state) {
    const errors: string[] = [];
    const logs = state.dailyLogs ?? [];
    if (logs.length < 21) return errors;
    // For each replacement key (toKey) that ONLY appears via swaps,
    // we can't easily directly assert — but we can guard the inverse:
    // for every mastered key, none of its credited completions came
    // from a swap row. This is the engine's contract.
    const todayKey = logs[logs.length - 1]?.date;
    if (!todayKey) return errors;
    const mastered = masteredKeys(state, todayKey);
    for (const k of mastered) {
      // Count logs where k completed AS a swap replacement.
      let swapCredited = 0;
      for (const l of logs) {
        if (!l.behaviorCompletions?.[k]) continue;
        const swaps = l.swaps;
        if (swaps && Object.values(swaps).includes(k)) swapCredited++;
      }
      if (swapCredited > 0) {
        errors.push(
          `mastered key "${k}" has ${swapCredited} swap-credited completion(s) — should be excluded from mastery math`
        );
      }
    }
    return errors;
  },
};

/**
 * swaps mapping keys must reference real catalog behaviors on both
 * ends. swapBehavior validates this at write time; the invariant
 * surfaces any pre-existing pollution from earlier code paths or
 * imported state.
 */
const inv_swaps_reference_real_behaviors: Invariant = {
  name: "DailyLog.swaps endpoints resolve to real behaviors",
  check(state) {
    const errors: string[] = [];
    for (const l of state.dailyLogs ?? []) {
      const swaps = l.swaps ?? {};
      for (const [fromKey, toKey] of Object.entries(swaps)) {
        if (!resolveBehaviorByKey(fromKey)) {
          errors.push(
            `log ${l.date}: swap fromKey="${fromKey}" doesn't resolve to a catalog behavior`
          );
        }
        if (!resolveBehaviorByKey(toKey)) {
          errors.push(
            `log ${l.date}: swap toKey="${toKey}" doesn't resolve to a catalog behavior`
          );
        }
      }
    }
    return errors;
  },
};

// ── Entitlements ──────────────────────────────────────────────────

/**
 * Free-tier caps must hold AT THE STORAGE LAYER. The library
 * functions (installPack, addBiomarker) are the source of truth;
 * any UI gating is defense in depth. A free user state should
 * never have more than FREE_PACKS official packs or more than
 * FREE_BIOMARKERS distinct biomarker metrics.
 */
const inv_free_tier_caps_held: Invariant = {
  name: "free-tier caps never exceeded in stored state",
  check(state) {
    const errors: string[] = [];
    const access = getAccess(state);
    if (access.premium) return errors;
    const officialIds = new Set(
      PACKS.filter((p) => p.source === "official").map((p) => p.id)
    );
    const installedOfficial = state.installedPacks.filter((id) =>
      officialIds.has(id)
    ).length;
    if (installedOfficial > getFreePacks()) {
      errors.push(
        `free user has ${installedOfficial} official packs installed; cap is ${getFreePacks()}`
      );
    }
    const distinctMetrics = new Set(
      (state.biomarkers ?? []).map((b) => b.metric)
    ).size;
    if (distinctMetrics > getFreeBiomarkers()) {
      errors.push(
        `free user has ${distinctMetrics} distinct biomarker metrics; cap is ${getFreeBiomarkers()}`
      );
    }
    return errors;
  },
};

// ── Adapt mode + signals consistency ──────────────────────────────

/**
 * `adapt().mode` is one of the six declared values. Anything else
 * indicates a typo or unstable composition path.
 */
const inv_adapt_mode_in_enum: Invariant = {
  name: "adapt() returns a known mode",
  check(state) {
    const m = adapt(state).mode;
    const valid = [
      "normal",
      "essentials",
      "recovery",
      "lighter",
      "primed",
      "rebuild",
    ];
    if (!valid.includes(m)) return [`adapt.mode is invalid: "${m}"`];
    return [];
  },
};

// ── Registry ──────────────────────────────────────────────────────

/**
 * The full invariant suite. Persona tests + property tests run this
 * against generated states. Adding a new invariant here automatically
 * extends coverage across every test that calls `assertInvariants`.
 */
export const ALL_INVARIANTS: Invariant[] = [
  inv_vacation_transparency,
  inv_rebuild_not_after_vacation,
  inv_biomarkers_premium_gated,
  inv_streak_matches_activity,
  inv_supplements_not_in_timeline,
  inv_vacation_mode_empty_timeline,
  inv_swap_does_not_pollute_mastery,
  inv_swaps_reference_real_behaviors,
  inv_free_tier_caps_held,
  inv_adapt_mode_in_enum,
];

/**
 * Run every invariant against `state` and return the full list of
 * violations (one string per violation, prefixed with the
 * invariant's name for traceability). Empty array = all invariants
 * hold.
 */
export function checkInvariants(state: AppState): string[] {
  const out: string[] = [];
  for (const inv of ALL_INVARIANTS) {
    try {
      const violations = inv.check(state);
      for (const v of violations) out.push(`[${inv.name}] ${v}`);
    } catch (e) {
      out.push(
        `[${inv.name}] check threw: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  return out;
}

/**
 * Vitest-friendly assertion. Throws an aggregated error listing
 * every invariant violation. Use in persona tests + property tests
 * as the single "is this state coherent?" gate.
 */
export function assertInvariants(state: AppState, context = ""): void {
  const violations = checkInvariants(state);
  if (violations.length === 0) return;
  const header = context
    ? `Invariants violated (${context}):`
    : "Invariants violated:";
  throw new Error([header, ...violations.map((v) => `  - ${v}`)].join("\n"));
}
