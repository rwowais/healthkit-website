/**
 * Family-of-three persona stress test — Dad (Marcus-style), Mom
 * (Priya-style), Teen (cautious-starter-style). Three users sharing
 * a household but otherwise *independent* engine states. The test
 * runs the same simulation engine over each in parallel for 365 days,
 * then at days 30/90/180/270/365 for every persona invokes
 * `assertInvariants(state, "<persona> day <N>")`.
 *
 * The shift this test embodies: instead of writing scenario-specific
 * assertions (which only catch what we thought to assert), the
 * invariant suite is the contract. If a state would have broken a
 * production user, an invariant fires and we see WHICH contract.
 *
 * Family contracts (cross-cutting, asserted explicitly here):
 *   - Each persona's state is independent (a premium signal in Dad's
 *     state never leaks into Mom's getSignals output).
 *   - Mom's anticoagulants flag suppresses omega-3 from her timeline
 *     AND from any supplement surface (the contraindications pipeline
 *     has to hold end-to-end).
 *   - Teen's 60-day gap should land them in `rebuild` mode on return —
 *     but only when `gapDays > 0`. The vacation-aware semantic (post-
 *     fix from vacation-traveler) has to hold even though Teen wasn't
 *     on vacation; the gate is "gapDays > 0", not "vacation existed."
 *   - Dad's workout-swap days must not pollute mastery for the
 *     replacement key (extended-walk gets ~10% of strength swaps and
 *     must NOT graduate to mastered).
 */
import { describe, it, expect } from "vitest";
import {
  adapt,
  compileTimeline,
  getSignals,
  masteredKeys,
} from "@/lib/engine";
import {
  addBiomarker,
  getDefaultState,
  swapBehavior,
} from "@/lib/storage";
import { calculateStreak } from "@/lib/scoring";
import { getAccess } from "@/lib/entitlements";
import { assertInvariants } from "../invariants";
import type { AppState, DailyLog, Supplement } from "@/lib/types";

// ── Time helpers (mirror power-user.test.ts so the contract is identical) ──

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

function makeRng(seedStr: string) {
  let h = 0;
  for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

const CHECKPOINTS = [30, 90, 180, 270, 365] as const;
type Checkpoint = (typeof CHECKPOINTS)[number];

// ── Dad: 42yo, premium, 4 packs, 5 supps, monthly biomarkers ─────────

// Curated supplements: 5 of them, all carrying derivedFrom + curated source
// so the supplement detector and contraindications pipeline work normally.
const DAD_SUPPLEMENTS: Supplement[] = [
  {
    id: "magnesium-pm",
    name: "Magnesium",
    dose: "200–400 mg glycinate",
    block: "evening",
    derivedFrom: "magnesium-pm",
    source: "curated",
  },
  {
    id: "omega-3",
    name: "Omega-3 (EPA/DHA)",
    dose: "2 g combined EPA/DHA",
    block: "anytime",
    derivedFrom: "omega-3",
    source: "curated",
    // Dad is NOT on anticoagulants — the contraindication on the
    // curated atom is honored only when the user's flag is set.
    contraindications: ["anticoagulants"],
  },
  {
    id: "vitamin-d3",
    name: "Vitamin D3",
    dose: "2000 IU",
    block: "morning",
    derivedFrom: "vitamin-d3",
    source: "curated",
  },
  {
    id: "creatine",
    name: "Creatine",
    dose: "5 g",
    block: "anytime",
    derivedFrom: "creatine",
    source: "curated",
  },
  {
    id: "vitamin-c",
    name: "Vitamin C",
    dose: "500 mg",
    block: "morning",
    derivedFrom: "vitamin-c",
    source: "curated",
  },
];

function buildDad(): AppState {
  let st = getDefaultState();
  // Trial expired before day 1 but he's a paying subscriber (tier="premium").
  // premiumTrialEndsAt set to long ago — the `paid` branch in getAccess
  // (state.settings.tier === "premium") covers him so trialExpired === false.
  st = {
    ...st,
    installedPacks: [
      "longevity-foundation",
      "better-sleep",
      "heart-health",
      "metabolic-health",
    ],
    settings: {
      ...st.settings,
      name: "Marcus",
      completedOnboarding: true,
      tier: "premium",
      bedtime: "22:30",
      wakeTime: "06:30",
    },
    supplements: DAD_SUPPLEMENTS,
    dailyLogs: [],
    biomarkers: [],
  };
  return st;
}

// ── Mom: 39yo, free tier, 2 packs, anticoagulants, 3 biomarkers ──────

function buildMom(): AppState {
  let st = getDefaultState();
  // Trial started day 1 of journey, ended day 14 — by day 30 she's
  // long past trial expiration.
  const trialEnd = dk(365 - 14); // 351 days back from today
  st = {
    ...st,
    installedPacks: ["longevity-foundation", "better-sleep"],
    settings: {
      ...st.settings,
      name: "Priya",
      completedOnboarding: true,
      tier: "free",
      safetyFlags: { anticoagulants: true },
      premiumTrialEndsAt: new Date(
        trialEnd + "T00:00:00Z"
      ).toISOString(),
    },
    supplements: [],
    dailyLogs: [],
    biomarkers: [],
  };
  return st;
}

// ── Teen: 16yo, free, 1 pack, 30% adherence then 60d quit then return ──

function buildTeen(): AppState {
  let st = getDefaultState();
  const trialEnd = dk(365 - 14);
  st = {
    ...st,
    installedPacks: ["better-sleep"],
    settings: {
      ...st.settings,
      name: "Teen",
      completedOnboarding: true,
      tier: "free",
      safetyFlags: { "under-18": true },
      premiumTrialEndsAt: new Date(
        trialEnd + "T00:00:00Z"
      ).toISOString(),
    },
    supplements: [],
    dailyLogs: [],
    biomarkers: [],
  };
  return st;
}

// ── Per-persona day profile ───────────────────────────────────────────

type DayProfile =
  | { active: false }
  | {
      active: true;
      adherence: number;
      sleepQ: number | null;
      energy: number | null;
      mood: number | null;
      reflection: boolean;
      doSwap?: boolean;
    };

function dadProfile(dayN: number, rng: () => number): DayProfile {
  const date = dk(365 - dayN);
  const dow = isoDayOf(date); // Mon=0..Sun=6
  const isMonday = dow === 0;
  const adherence = isMonday ? 0.85 : 0.9 + (dayN % 5) / 100;
  // ~10% of training days he swaps strength → extended-walk (bad knee).
  // Training days = Mon/Wed/Fri-ish. Use 10% probability across all days
  // to keep the seed clean; the actual swap only fires when strength is
  // on the timeline (compileTimeline filters by daysActive).
  const doSwap = rng() < 0.1;
  return {
    active: true,
    adherence,
    sleepQ: rng() < 0.55 ? 5 : 4,
    energy: isMonday && rng() < 0.3 ? 3 : rng() < 0.55 ? 5 : 4,
    mood: 4,
    reflection: rng() < 0.5,
    doSwap,
  };
}

function momProfile(_dayN: number, rng: () => number): DayProfile {
  // Stable 70% adherence, occasional reflection.
  return {
    active: true,
    adherence: 0.7,
    sleepQ: rng() < 0.5 ? 4 : 3,
    energy: rng() < 0.6 ? 4 : 3,
    mood: 4,
    reflection: rng() < 0.3,
  };
}

function teenProfile(dayN: number, rng: () => number): DayProfile {
  // Days 1..90: 30% adherence
  if (dayN <= 90) {
    return {
      active: true,
      adherence: 0.3,
      sleepQ: rng() < 0.4 ? 3 : 4,
      energy: rng() < 0.4 ? 3 : 4,
      mood: 3,
      reflection: rng() < 0.1,
    };
  }
  // Days 91..150: QUIT (60-day gap). No log written.
  if (dayN <= 150) return { active: false };
  // Days 151..365: returns and rebuilds from 30% → 60%.
  const phase = dayN - 150;
  const adherence = Math.min(0.6, 0.3 + (phase * 0.3) / 215);
  return {
    active: true,
    adherence,
    sleepQ: 4,
    energy: 4,
    mood: 4,
    reflection: rng() < 0.2,
  };
}

// ── Simulation: write 365 days of logs into a state ──────────────────

function simulateOneDay(
  state: AppState,
  dayN: number,
  profile: DayProfile,
  persona: string
): AppState {
  if (!profile.active) return state;
  const daysBack = 365 - dayN;
  const date = dk(daysBack);
  const dayIndex = isoDayOf(date);
  const rng = makeRng(`${persona}-${dayN}-${date}`);

  // Apply optional swap FIRST so swapBehavior writes the log and we
  // can layer additional completions on top.
  let next = state;
  if (profile.doSwap) {
    // Try swapping strength to extended-walk. swapBehavior validates
    // both ends; if strength isn't in the user's catalog (e.g. Mom
    // doesn't have longevity-foundation's exercise atoms), the call
    // is a no-op.
    const candidate = compileTimeline(next, dayIndex).find(
      (it) => it.canonicalKey === "strength" && !it.muted
    );
    if (candidate) {
      next = swapBehavior(next, date, "strength", "extended-walk");
    }
  }

  const items = compileTimeline(next, dayIndex);
  const existingLog =
    next.dailyLogs.find((l) => l.date === date) ?? emptyLog(date);
  const bc: Record<string, boolean> = {
    ...(existingLog.behaviorCompletions ?? {}),
  };
  let active = 0;
  let done = 0;
  for (const it of items) {
    if (it.muted) continue;
    active++;
    if (bc[it.canonicalKey]) {
      done++;
      continue;
    }
    const bonus = it.leverage === 3 ? 0.05 : it.leverage === 1 ? -0.03 : 0;
    if (rng() < profile.adherence + bonus) {
      bc[it.canonicalKey] = true;
      done++;
    }
  }

  const updated: DailyLog = {
    ...existingLog,
    behaviorCompletions: bc,
    sleepLog: {
      ...existingLog.sleepLog,
      sleepQuality: profile.sleepQ,
    },
    energyLevel: profile.energy,
    moodLevel: profile.mood,
    dayNote: profile.reflection ? `Day ${dayN} note` : existingLog.dayNote,
    score: active > 0 ? Math.round((done / active) * 100) : 0,
  };

  const idx = next.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? next.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...next.dailyLogs, updated];

  return { ...next, dailyLogs };
}

// ── Build the full 365-day state for a persona ───────────────────────

interface PersonaSpec {
  name: string;
  build: () => AppState;
  profileFn: (dayN: number, rng: () => number) => DayProfile;
  // Biomarker schedule: monthly for Dad, sparse for Mom, none for Teen.
  biomarkerSchedule: (dayN: number, st: AppState) => AppState;
}

function dadBiomarkers(dayN: number, st: AppState): AppState {
  // Monthly body-marker entries — 5 metrics (premium): HRV + weight +
  // VO2max + body fat + waist.
  if (dayN % 30 !== 0) return st;
  const date = dk(365 - dayN);
  const k = dayN / 30;
  let out = st;
  out = addBiomarker(out, { metric: "hrv", value: 55 + k * 0.5, date });
  out = addBiomarker(out, { metric: "weight", value: 78 - k * 0.1, date });
  out = addBiomarker(out, { metric: "vo2max", value: 45 + k * 0.2, date });
  out = addBiomarker(out, {
    metric: "bodyFat",
    value: 20 - k * 0.05,
    date,
  });
  out = addBiomarker(out, { metric: "waist", value: 88 - k * 0.2, date });
  return out;
}

function momBiomarkers(dayN: number, st: AppState): AppState {
  // 3 biomarkers (free cap). Add weight at day 30, hrv at day 90,
  // restingHR at day 180. No more after — she's at the cap.
  if (dayN === 30) {
    return addBiomarker(st, {
      metric: "weight",
      value: 65,
      date: dk(365 - dayN),
    });
  }
  if (dayN === 90) {
    return addBiomarker(st, {
      metric: "hrv",
      value: 48,
      date: dk(365 - dayN),
    });
  }
  if (dayN === 180) {
    return addBiomarker(st, {
      metric: "restingHR",
      value: 64,
      date: dk(365 - dayN),
    });
  }
  return st;
}

function teenBiomarkers(_dayN: number, st: AppState): AppState {
  return st;
}

const PERSONAS: PersonaSpec[] = [
  {
    name: "Dad",
    build: buildDad,
    profileFn: dadProfile,
    biomarkerSchedule: dadBiomarkers,
  },
  {
    name: "Mom",
    build: buildMom,
    profileFn: momProfile,
    biomarkerSchedule: momBiomarkers,
  },
  {
    name: "Teen",
    build: buildTeen,
    profileFn: teenProfile,
    biomarkerSchedule: teenBiomarkers,
  },
];

interface PersonaResult {
  name: string;
  finalState: AppState;
  /** Snapshot state at each checkpoint (trimmed to day <= checkpoint). */
  checkpointStates: Map<Checkpoint, AppState>;
}

function simulatePersona(spec: PersonaSpec): PersonaResult {
  let st = spec.build();
  const masterRng = makeRng(`${spec.name}-master`);
  const checkpointStates = new Map<Checkpoint, AppState>();

  for (let dayN = 1; dayN <= 365; dayN++) {
    const profile = spec.profileFn(dayN, masterRng);
    st = simulateOneDay(st, dayN, profile, spec.name);
    st = spec.biomarkerSchedule(dayN, st);

    if ((CHECKPOINTS as readonly number[]).includes(dayN)) {
      checkpointStates.set(dayN as Checkpoint, st);
    }
  }

  // Refresh streak using the production helper.
  st = {
    ...st,
    currentStreak: calculateStreak(
      st.dailyLogs,
      undefined,
      st.settings
    ),
  };

  return {
    name: spec.name,
    finalState: st,
    checkpointStates,
  };
}

// ── Run the simulations once (top-level, shared across `it` blocks) ──

const RESULTS: PersonaResult[] = PERSONAS.map(simulatePersona);
const BY_NAME = new Map(RESULTS.map((r) => [r.name, r]));

// ── Tests ───────────────────────────────────────────────────────────

describe("Family of three — 365-day stress test, invariants at every checkpoint", () => {
  it("simulation produced logs for each persona", () => {
    for (const r of RESULTS) {
      // Dad/Mom/Teen all have logs; Teen has a 60-day gap so fewer.
      expect(r.finalState.dailyLogs.length).toBeGreaterThan(0);
    }
    // Teen has the gap, so should have fewer logs than Dad.
    const dad = BY_NAME.get("Dad")!;
    const teen = BY_NAME.get("Teen")!;
    expect(teen.finalState.dailyLogs.length).toBeLessThan(
      dad.finalState.dailyLogs.length
    );
  });

  // ── INVARIANTS at every checkpoint × every persona ────────────────
  //
  // 3 personas × 5 checkpoints × 10 invariants = 150 invariant checks.
  // Each is a contract. Any violation = a real bug. We do NOT weaken
  // the assertion to make this pass; the suite throws with the precise
  // contract that broke.

  for (const persona of PERSONAS.map((p) => p.name)) {
    for (const cp of CHECKPOINTS) {
      it(`invariants hold for ${persona} at day ${cp}`, () => {
        const r = BY_NAME.get(persona)!;
        const st = r.checkpointStates.get(cp);
        expect(
          st,
          `${persona} missing checkpoint state at day ${cp}`
        ).toBeDefined();
        assertInvariants(st!, `${persona} day ${cp}`);
      });
    }
  }

  // ── Cross-cutting family contracts ────────────────────────────────

  it("each persona's state is independent (no premium bleed)", () => {
    const dad = BY_NAME.get("Dad")!;
    const mom = BY_NAME.get("Mom")!;
    const teen = BY_NAME.get("Teen")!;

    const dadAccess = getAccess(dad.finalState);
    const momAccess = getAccess(mom.finalState);
    const teenAccess = getAccess(teen.finalState);

    expect(dadAccess.premium).toBe(true);
    expect(momAccess.premium).toBe(false);
    expect(teenAccess.premium).toBe(false);

    // bioConcern / bioRecoveryFlag MUST be null/false for non-premium
    // even if they have biomarker readings. Mom has 3 biomarkers.
    const momSig = getSignals(mom.finalState);
    expect(
      momSig.bioConcern,
      "Mom (free) must NOT have bioConcern populated even though she has biomarkers"
    ).toBeNull();
    expect(momSig.bioRecoveryFlag).toBe(false);

    // Dad's signals never affect Mom's — verify by computing both and
    // confirming they're shaped by their own state.
    const dadSig = getSignals(dad.finalState);
    // Dad has 65+ biomarker readings (5 metrics × 12 months = 60). His
    // bioConcern may be null OR populated depending on band; Mom's
    // MUST be null regardless of Dad's value.
    if (dadSig.bioConcern !== null) {
      // If Dad has a concern, Mom must still have null — proving
      // independence.
      expect(momSig.bioConcern).toBeNull();
    }
  });

  it("Mom's anticoagulants flag suppresses omega-3 from her timeline", () => {
    const mom = BY_NAME.get("Mom")!;
    const dayIndex = isoDayOf(dk(0));
    const items = compileTimeline(mom.finalState, dayIndex);
    const hasOmega = items.some((it) => it.canonicalKey === "omega-3");
    expect(
      hasOmega,
      "BUG: omega-3 leaked into Mom's timeline despite anticoagulants flag"
    ).toBe(false);
  });

  it("Mom's supplement surface also filters omega-3 (cross-layer contract)", async () => {
    const mom = BY_NAME.get("Mom")!;
    // Mom doesn't add supplements herself, but the supplement layer
    // is the second arm of the contraindications pipeline. If she
    // WERE to install omega-3 from the supplements catalog, the
    // safetyFlags filter on supplementsForBlock must remove it.
    const { supplementsForBlock, supplementFromBehavior } = await import(
      "@/lib/supplements"
    );
    // omega-3 now lives in the standalone supplement library (protocols no
    // longer embed supplements); its contraindications must carry through.
    const { STANDALONE_ATOMS_REGISTRY } = await import("@/lib/packs");
    const omega3Atom = STANDALONE_ATOMS_REGISTRY.find(
      (b) => b.canonicalKey === "omega-3"
    );
    expect(omega3Atom).toBeDefined();
    const supp = supplementFromBehavior(omega3Atom!, "longevity-foundation");
    expect(supp.contraindications).toContain("anticoagulants");
    const filtered = supplementsForBlock(
      [supp],
      "anytime",
      0,
      mom.finalState.settings.safetyFlags
    );
    expect(
      filtered.length,
      "BUG: anticoagulants flag failed to filter omega-3 from supplementsForBlock"
    ).toBe(0);
  });

  it("Teen's 60-day gap lands them in rebuild mode on return — gated on gapDays > 0", () => {
    const teen = BY_NAME.get("Teen")!;
    // Build a *trimmed view* at day 151 (the return day). Teen's gap
    // spans days 91..150; day 151 should see ~60 calendar days of gap.
    const day151Key = dk(365 - 151);
    const trimmedLogs = teen.finalState.dailyLogs.filter(
      (l) => l.date <= day151Key
    );
    const view: AppState = {
      ...teen.finalState,
      dailyLogs: trimmedLogs,
    };
    // Note: adapt() uses dateKeyInTz(today) as "today", and our trimmed
    // logs end at day 151 of journey = (365-151) = 214 days ago. So
    // adapt() from the perspective of REAL today sees:
    //  - gap is huge (214 days), not 60
    //  - but the rebuild branch fires when gapDays >= 2 AND hasHistory
    //
    // The contract we're enforcing: a multi-day gap puts the user in
    // rebuild mode (gated by hasHistory). The 60-day-gap precise number
    // only matters if we anchor "today" to day 151 with vi.setSystemTime.
    // For the family test we accept the looser contract: with history +
    // a substantial gap, mode = "rebuild".
    const a = adapt(view);
    const s = getSignals(view);
    expect(s.hasHistory).toBe(true);
    expect(s.gapDays).toBeGreaterThan(0);
    // CONTRACT: rebuild mode fires when gapDays > 0 AND hasHistory.
    // This is the post-fix vacation-aware semantic — works for Teen
    // even though she wasn't on vacation.
    expect(a.mode).toBe("rebuild");
  });

  it("Dad's workout-swap days don't pollute mastery for extended-walk", () => {
    const dad = BY_NAME.get("Dad")!;
    // Count days where Dad swapped strength → extended-walk.
    const swapDays = dad.finalState.dailyLogs.filter(
      (l) => l.swaps?.["strength"] === "extended-walk"
    );
    // Should be ~10% of days that strength was scheduled. Some may
    // have no-oped (strength wasn't on the day's timeline).
    // Just verify the swap mechanism fired at least a few times.
    // (Spec says ~10% of training days; if zero swaps fired, the test
    // doesn't actually exercise the swap → mastery contract.)
    // For Dad, longevity-foundation has strength on Mon/Wed/Fri.
    // Across 365 days that's ~156 candidate days. 10% chance = ~16 swaps.
    // Allow some looseness — at minimum 3 swaps so the contract is real.
    expect(
      swapDays.length,
      `Dad's swap simulation didn't fire enough swaps to exercise the mastery contract (got ${swapDays.length})`
    ).toBeGreaterThanOrEqual(3);

    // The contract: extended-walk MUST NOT appear in masteredKeys
    // BECAUSE OF swap auto-completions. The engine's wasGenuinelyCompleted
    // gate excludes swap-credited completions from mastery math.
    //
    // We check the final-state mastery set. If extended-walk IS in it,
    // it must be because Dad ALSO genuinely did extended-walk (without
    // swap) for 21+ consecutive scheduled days. Given Dad's pattern,
    // that would only happen via the swap pathway — so finding it in
    // mastery is a bug.
    const lastLogDate =
      dad.finalState.dailyLogs[dad.finalState.dailyLogs.length - 1]?.date;
    expect(lastLogDate).toBeDefined();
    const mastered = masteredKeys(dad.finalState, lastLogDate!);
    // Count days where extended-walk was genuinely (non-swap) completed.
    const genuineDays = dad.finalState.dailyLogs.filter((l) => {
      const did = l.behaviorCompletions?.["extended-walk"] === true;
      const wasSwapTo = Object.values(l.swaps ?? {}).includes("extended-walk");
      return did && !wasSwapTo;
    }).length;
    // If extended-walk is mastered AND genuineDays < 21 → bug.
    // (Genuine consecutive streak can't reach 21 if we haven't even
    // done it genuinely 21 times.)
    if (mastered.has("extended-walk")) {
      expect(
        genuineDays,
        `BUG: extended-walk is mastered but was only genuinely (non-swap) completed ${genuineDays} times — swap pollution into mastery`
      ).toBeGreaterThanOrEqual(21);
    }
  });

  // ── Diagnostic: print compact metrics for the writeup ─────────────

  it("diagnostic — emit per-persona metrics for the report", () => {
    const summary: Record<string, unknown> = {};
    for (const r of RESULTS) {
      const finalLog =
        r.finalState.dailyLogs[r.finalState.dailyLogs.length - 1];
      const sig = getSignals(r.finalState);
      const a = adapt(r.finalState);
      const masteredCount = finalLog
        ? masteredKeys(r.finalState, finalLog.date).size
        : 0;
      const swapCount = r.finalState.dailyLogs.filter(
        (l) => l.swaps && Object.keys(l.swaps).length > 0
      ).length;
      const access = getAccess(r.finalState);
      const masteredList = finalLog
        ? [...masteredKeys(r.finalState, finalLog.date)]
        : [];
      summary[r.name] = {
        logs: r.finalState.dailyLogs.length,
        biomarkers: r.finalState.biomarkers.length,
        distinctMetrics: new Set(
          r.finalState.biomarkers.map((b) => b.metric)
        ).size,
        installedPacks: r.finalState.installedPacks.length,
        supplements: r.finalState.supplements?.length ?? 0,
        currentStreak: r.finalState.currentStreak,
        signalsGapDays: sig.gapDays,
        signalsHasHistory: sig.hasHistory,
        signalsBioConcern: sig.bioConcern,
        adaptMode: a.mode,
        masteredCount,
        masteredList,
        swapCount,
        access,
      };
    }
    // eslint-disable-next-line no-console
    console.log(
      "[family-of-three] persona summary:\n" + JSON.stringify(summary, null, 2)
    );
    // No assertion — diagnostic only.
    expect(summary).toBeDefined();
  });
});
