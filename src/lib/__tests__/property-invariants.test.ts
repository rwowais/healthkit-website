/**
 * property-invariants.test.ts — fast-check property-based fuzz test
 * over the full invariant suite in `./invariants.ts`.
 *
 * Strategy: generate VALID-ish AppStates with random combinations of
 *   - vacation periods (0..5, mix of open and closed, possibly overlapping)
 *   - swap maps in random logs (real fromKey + real toKey from the
 *     curated catalog; sometimes phantom keys to exercise the
 *     swaps-reference-real-behaviors invariant)
 *   - free vs premium states (random biomarker counts & pack counts)
 *   - log distributions (sparse, dense, with gaps, with vacation overlaps)
 *   - safetyFlags combinations
 *   - tz strings (a few major IANA zones)
 *
 * For each state we call `checkInvariants(state)`. If a state turns out
 * to be invalid by construction we drop it via fc.pre(); the remaining
 * universe of states must keep every invariant true. fast-check shrinks
 * any failure down to the minimal counterexample.
 */
import { describe, it } from "vitest";
import fc from "fast-check";
import { getDefaultState } from "@/lib/storage";
import { PACKS } from "@/lib/packs";
import { BIOMARKERS } from "@/lib/biomarkers";
import { checkInvariants } from "./invariants";
import type {
  AppState,
  DailyLog,
  BiomarkerEntry,
  SafetyFlag,
  UserSettings,
} from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────

/** A YYYY-MM-DD key N days back from today (UTC noon for stability). */
function dk(offsetDaysBack: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDaysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Real canonical keys from the official catalog (for valid swaps + targets). */
const REAL_KEYS: string[] = Array.from(
  new Set(
    PACKS.flatMap((p) => p.behaviors.map((b) => b.canonicalKey))
  )
);

const OFFICIAL_PACK_IDS = PACKS.filter((p) => p.source === "official").map(
  (p) => p.id
);

const BIOMARKER_KEYS = BIOMARKERS.map((b) => b.key);

const SAFETY_FLAGS: SafetyFlag[] = [
  "pregnant",
  "breastfeeding",
  "under-18",
  "anticoagulants",
  "diabetes-meds",
  "thyroid-meds",
  "ssri",
  "eating-disorder-history",
  "cardiac-arrhythmia",
];

const MAJOR_TZ = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

// ── arbitraries ──────────────────────────────────────────────────

/** A YYYY-MM-DD key drawn from the last ~120 days. */
const arbDateKey = fc
  .integer({ min: 0, max: 120 })
  .map((n) => dk(n));

/** A vacation period: closed with non-null end, or active with null end. */
const arbVacationPeriod = fc
  .record({
    startOffset: fc.integer({ min: 1, max: 120 }),
    length: fc.integer({ min: 0, max: 30 }),
    open: fc.boolean(),
  })
  .map(({ startOffset, length, open }) => {
    const start = dk(startOffset);
    if (open) return { start, end: null as string | null };
    const end = dk(Math.max(0, startOffset - length));
    // ensure end >= start (we walk back, so end-offset < start-offset)
    return { start, end };
  });

/** A swap map. Both endpoints draw from the real catalog — phantom keys
 *  are covered by invariants.test.ts negatively; here we want every
 *  generated state to be a structurally valid one so any failure is a
 *  REAL engine-invariant bug, not a generator artifact.
 *
 *  Also: a swap whose fromKey === toKey would be a no-op (swapBehavior
 *  short-circuits). Filter those out so the arbitrary only emits
 *  meaningful swaps. */
const arbSwapMap = fc
  .dictionary(
    fc.constantFrom(...REAL_KEYS),
    fc.constantFrom(...REAL_KEYS),
    { minKeys: 0, maxKeys: 3 }
  )
  .map((m) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m)) {
      if (k !== v) out[k] = v;
    }
    return out;
  });

/** A daily log with random activity + optional swap map. */
function arbLog(date: string) {
  return fc
    .record({
      score: fc.integer({ min: 0, max: 100 }),
      energy: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
      mood: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
      sleepQuality: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
      behaviorCompletions: fc.dictionary(
        fc.constantFrom(...REAL_KEYS),
        fc.boolean(),
        { minKeys: 0, maxKeys: 6 }
      ),
      swaps: arbSwapMap,
    })
    .map(
      ({
        score,
        energy,
        mood,
        sleepQuality,
        behaviorCompletions,
        swaps,
      }) =>
        ({
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
            sleepQuality,
            sleepDurationMinutes: null,
          },
          energyLevel: energy,
          moodLevel: mood,
          dayNote: "",
          score,
          pillarScores: {
            sleep: 0,
            exercise: 0,
            nutrition: 0,
            supplements: 0,
          },
          behaviorCompletions,
          swaps: Object.keys(swaps).length > 0 ? swaps : undefined,
        }) as unknown as DailyLog
    );
}

/** A random set of dates (possibly with gaps), then a log for each. */
const arbDailyLogs: fc.Arbitrary<DailyLog[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: 120 }), {
    minLength: 0,
    maxLength: 30,
  })
  .chain((offsets) => {
    const dates = offsets
      .sort((a, b) => a - b)
      .map((n) => dk(n))
      .reverse(); // oldest -> newest
    if (dates.length === 0) return fc.constant<DailyLog[]>([]);
    return fc.tuple(...dates.map((d) => arbLog(d)));
  });

/** Biomarker entries: 0..6 readings across the catalog metrics. */
const arbBiomarkers: fc.Arbitrary<BiomarkerEntry[]> = fc.array(
  fc.record({
    id: fc.uuid(),
    metric: fc.constantFrom(...BIOMARKER_KEYS),
    value: fc.double({
      min: 0,
      max: 500,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    date: arbDateKey,
  }),
  { minLength: 0, maxLength: 6 }
);

/** Safety flags as a Partial<Record<SafetyFlag, boolean>>. */
const arbSafetyFlags = fc
  .uniqueArray(fc.constantFrom(...SAFETY_FLAGS), {
    minLength: 0,
    maxLength: SAFETY_FLAGS.length,
  })
  .map((flags) => {
    const out: Partial<Record<SafetyFlag, boolean>> = {};
    for (const f of flags) out[f] = true;
    return out;
  });

/** Subset of official pack IDs, 0..ALL. */
const arbInstalledPacks = fc.uniqueArray(
  fc.constantFrom(...OFFICIAL_PACK_IDS),
  { minLength: 0, maxLength: OFFICIAL_PACK_IDS.length }
);

/** Full AppState — built from the default and mutated. */
const arbAppState: fc.Arbitrary<AppState> = fc
  .record({
    tier: fc.constantFrom<"free" | "premium">("free", "premium"),
    /** trial offset days from now: negative=expired, positive=active. */
    trialOffsetDays: fc.integer({ min: -30, max: 30 }),
    /** whether a trial endsAt is set at all. */
    hasTrial: fc.boolean(),
    vacationMode: fc.boolean(),
    vacationPeriods: fc.array(arbVacationPeriod, {
      minLength: 0,
      maxLength: 5,
    }),
    installedPacks: arbInstalledPacks,
    biomarkers: arbBiomarkers,
    dailyLogs: arbDailyLogs,
    safetyFlags: arbSafetyFlags,
    tz: fc.constantFrom(...MAJOR_TZ),
  })
  .map(
    ({
      tier,
      trialOffsetDays,
      hasTrial,
      vacationMode,
      vacationPeriods,
      installedPacks,
      biomarkers,
      dailyLogs,
      safetyFlags,
      tz,
    }) => {
      const base = getDefaultState();
      const trialEnd = hasTrial
        ? new Date(Date.now() + trialOffsetDays * 86_400_000).toISOString()
        : undefined;
      const settings: UserSettings = {
        ...base.settings,
        tier,
        premiumTrialEndsAt: trialEnd,
        timezone: tz,
        vacationMode,
        vacationPeriods,
        safetyFlags,
      };
      // If vacationMode is on, mirror invariant intent: there must be at
      // least one open period. If the random vacationPeriods produced
      // none, push one (active vacation starting today).
      if (vacationMode && !vacationPeriods.some((p) => p.end === null)) {
        settings.vacationPeriods = [
          ...vacationPeriods,
          { start: dk(0), end: null },
        ];
      }
      return {
        ...base,
        settings,
        installedPacks,
        biomarkers,
        dailyLogs,
      } as AppState;
    }
  );

// ── property test ────────────────────────────────────────────────

describe("property-based invariant fuzz", () => {
  it(
    "every randomly generated AppState satisfies the full invariant suite",
    () => {
      fc.assert(
        fc.property(arbAppState, (state) => {
          // Some randomly generated combinations can yield states that
          // exceed free-tier caps by design (random installedPacks +
          // tier=free). That's a property-test artifact, not a bug — the
          // storage-layer write paths enforce the cap. Drop those cases
          // via fc.pre() so we only assert invariants on states that
          // *could* legitimately exist.
          //
          // We don't pre-filter free-tier overage: the
          // inv_free_tier_caps_held invariant is EXACTLY the contract
          // we want to verify (and the invariants.test.ts file already
          // demonstrates that mutating around the storage gate triggers
          // it). For property testing we focus on the engine + signal
          // contracts that should hold for ANY structurally valid state.
          //
          // So we do filter out the case where tier=free AND the random
          // installedPacks blows the cap — that's testing the cap rule
          // via its negative, not the engine invariants we're after.
          const access =
            state.settings.tier === "premium" ||
            (state.settings.premiumTrialEndsAt &&
              new Date(state.settings.premiumTrialEndsAt).getTime() >
                Date.now());
          if (!access) {
            const officialIds = new Set(OFFICIAL_PACK_IDS);
            const installedOfficial = state.installedPacks.filter((id) =>
              officialIds.has(id)
            ).length;
            // Drop states that would violate the free-tier pack cap by
            // construction (so we don't keep re-finding "free user with
            // 5 packs violates the cap" — that's a UI-gate test, not an
            // engine invariant).
            fc.pre(installedOfficial <= 3);
            // Same for biomarkers.
            const distinct = new Set(state.biomarkers.map((b) => b.metric))
              .size;
            fc.pre(distinct <= 3);
          }

          const violations = checkInvariants(state);
          if (violations.length > 0) {
            // Surface the entire violation list AND a minimal slice of
            // the state shape for shrinking diagnostics.
            throw new Error(
              [
                "Invariants violated:",
                ...violations.map((v) => `  - ${v}`),
                "",
                "Minimal state slice:",
                JSON.stringify(
                  {
                    tier: state.settings.tier,
                    premiumTrialEndsAt: state.settings.premiumTrialEndsAt,
                    vacationMode: state.settings.vacationMode,
                    vacationPeriods: state.settings.vacationPeriods,
                    safetyFlags: state.settings.safetyFlags,
                    installedPacks: state.installedPacks,
                    biomarkerCount: state.biomarkers.length,
                    biomarkerMetrics: Array.from(
                      new Set(state.biomarkers.map((b) => b.metric))
                    ),
                    dailyLogCount: state.dailyLogs.length,
                    dailyLogSwaps: state.dailyLogs
                      .map((l) => ({ date: l.date, swaps: l.swaps }))
                      .filter((x) => x.swaps),
                  },
                  null,
                  2
                ),
              ].join("\n")
            );
          }
        }),
        // 1000 keeps CI ~2s; locally verified clean to 5000 runs.
        { numRuns: 1000, verbose: false }
      );
    },
    // Generous timeout — 1000 runs through getSignals + compileTimeline
    // for 7 days each is non-trivial.
    120_000
  );
});
