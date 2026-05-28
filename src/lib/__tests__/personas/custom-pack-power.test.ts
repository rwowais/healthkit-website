/**
 * Persona: custom-pack power users — stress-test the custom-pack /
 * fork / atom-library / trust-tier subsystem across 365 days.
 *
 * Two states in one file:
 *
 * 1. DIY Researcher — premium user who creates three custom packs over
 *    the year from scratch. Pack 1 is pure free-text (custom-tier).
 *    Pack 2 forks atoms from official packs. Pack 3 picks from the
 *    atom library (custom:* keys WITH derivedFrom — "derived").
 *
 * 2. Heavy forker — premium user who forks the better-sleep official
 *    pack into an editable copy, modifies a couple of behaviors, and
 *    installs the fork instead of the original.
 *
 * Checkpoints at days 30, 90, 180, 270, 365 call assertInvariants and
 * the trust-tier specific assertions below:
 *
 *   - Custom-tier behaviors (custom:* / fork:* without derivedFrom)
 *     never appear in masteredKeys.
 *   - Derived custom behaviors (custom:* WITH derivedFrom) MAY appear
 *     in masteredKeys (curated lineage is inherited).
 *   - Forked-pack atoms merge cleanly with the original via canonical
 *     key (effectiveKey). No duplicate timeline rows.
 *   - Custom packs survive export → import round-trip.
 *   - The supplement catalog NEVER contains DIY's custom behaviors.
 */
import { describe, it, expect } from "vitest";
import {
  compileTimeline,
  masteredKeys,
  trustTier as classifyTier,
} from "@/lib/engine";
import {
  getDefaultState,
  upsertCustomPack,
  duplicatePack,
  importState,
  exportState,
} from "@/lib/storage";
import { curatedSupplementCatalog } from "@/lib/supplements";
import { PACKS } from "@/lib/packs";
import { assertInvariants } from "../invariants";
import type {
  AppState,
  BehaviorDef,
  DailyLog,
  ProtocolPack,
} from "@/lib/types";

// ── Date / log helpers (mirror power-user.test.ts) ───────────────────

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

function makeRng(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

// ── Behavior shape helper ────────────────────────────────────────────

function bdef(over: Partial<BehaviorDef> & { canonicalKey: string }): BehaviorDef {
  return {
    title: "Untitled",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    rationale: "user-authored",
    icon: "sparkle",
    leverage: 2,
    kind: "action",
    ...over,
  } as BehaviorDef;
}

// ── DIY Researcher's three packs ─────────────────────────────────────

const DIY_PACK_1_ID = "custom-diy-morning";
const DIY_PACK_2_ID = "custom-diy-workout";
const DIY_PACK_3_ID = "custom-diy-atoms";

/** Pack 1: pure free-text — no derivedFrom on any behavior → "custom" tier. */
function diyPack1(): ProtocolPack {
  const packId = DIY_PACK_1_ID;
  return {
    id: packId,
    name: "My morning ritual",
    tagline: "Hand-authored morning sequence",
    goal: "custom",
    accent: "var(--vitality)",
    icon: "sun",
    source: "custom",
    durationLabel: "Ongoing",
    behaviors: [
      bdef({
        canonicalKey: `custom:${packId}:tongue-scrape`,
        title: "Tongue scrape",
        block: "morning",
        leverage: 1,
      }),
      bdef({
        canonicalKey: `custom:${packId}:oil-pull`,
        title: "Oil pull 10 minutes",
        block: "morning",
        leverage: 1,
      }),
      bdef({
        canonicalKey: `custom:${packId}:gratitude-journal`,
        title: "Gratitude journal 3 lines",
        block: "morning",
        leverage: 2,
      }),
      bdef({
        canonicalKey: `custom:${packId}:cold-face-splash`,
        title: "Cold water on face",
        block: "morning",
        leverage: 1,
      }),
    ],
  };
}

/** Pack 2: forks of official atoms (fork:* keys WITH derivedFrom → "derived"). */
function diyPack2(): ProtocolPack {
  const packId = DIY_PACK_2_ID;
  return {
    id: packId,
    name: "Workout split",
    tagline: "User-tuned forks of curated training atoms",
    goal: "performance",
    accent: "var(--readiness)",
    icon: "dumbbell",
    source: "custom",
    durationLabel: "Ongoing",
    behaviors: [
      bdef({
        canonicalKey: `fork:${packId}:strength`,
        derivedFrom: "strength",
        title: "Heavy compound day",
        block: "afternoon",
        leverage: 3,
        category: "workout",
        intensity: "high",
        daysActive: [true, false, true, false, true, false, false],
      }),
      bdef({
        canonicalKey: `fork:${packId}:zone2`,
        derivedFrom: "zone2",
        title: "Zone 2 (incline treadmill)",
        block: "afternoon",
        leverage: 3,
        category: "workout",
        intensity: "moderate",
      }),
      bdef({
        canonicalKey: `fork:${packId}:extended-walk`,
        derivedFrom: "extended-walk",
        title: "60-min outdoor walk",
        block: "afternoon",
        leverage: 2,
        category: "workout",
        intensity: "low",
      }),
    ],
  };
}

/**
 * Pack 3: atom-library picks — custom:* canonicalKey + derivedFrom set
 * → trust tier "derived". These behaviors inherit curated lineage and
 * should remain mastery-eligible.
 */
function diyPack3(): ProtocolPack {
  const packId = DIY_PACK_3_ID;
  return {
    id: packId,
    name: "Atom library picks",
    tagline: "Curated atoms personalised",
    goal: "custom",
    accent: "var(--recovery)",
    icon: "leaf",
    source: "custom",
    durationLabel: "Ongoing",
    behaviors: [
      bdef({
        canonicalKey: `custom:${packId}:my-morning-sunlight`,
        derivedFrom: "morning-sunlight",
        title: "10-min morning light walk",
        block: "morning",
        leverage: 3,
      }),
      bdef({
        canonicalKey: `custom:${packId}:my-protein-breakfast`,
        derivedFrom: "protein-breakfast",
        title: "40 g protein breakfast",
        block: "morning",
        leverage: 3,
      }),
      bdef({
        canonicalKey: `custom:${packId}:my-wind-down`,
        derivedFrom: "wind-down",
        title: "30-min wind-down ritual",
        block: "evening",
        leverage: 2,
      }),
      bdef({
        canonicalKey: `custom:${packId}:my-caffeine-cutoff`,
        derivedFrom: "caffeine-cutoff",
        title: "Caffeine cutoff at noon",
        block: "afternoon",
        leverage: 2,
      }),
      bdef({
        canonicalKey: `custom:${packId}:my-dim-lights`,
        derivedFrom: "dim-lights",
        title: "Amber bulbs after sunset",
        block: "evening",
        leverage: 2,
      }),
    ],
  };
}

// ── DIY Researcher: 365-day evolution ────────────────────────────────

const CHECKPOINTS = [30, 90, 180, 270, 365];

/**
 * Construct DIY Researcher state at "today" by walking 1..400 days
 * back, installing packs at specific days. dailyLogs are stored
 * chronologically (oldest first).
 */
function buildDiyResearcher(): {
  state: AppState;
  installDay1: number;
  installDay2: number;
  installDay3: number;
} {
  // Install timing: pack1 at the start, pack2 around day 100 before
  // forward (i.e. on the calendar this maps to dk(300) — early in the
  // year), pack3 later. We define everything in "days back from today"
  // so all checkpoints fall AFTER pack 1 is installed.
  const installDay1 = 400; // installed 400 days ago — visible at every checkpoint
  const installDay2 = 300; // installed 300 days ago — visible from checkpoint 365 down to 90
  const installDay3 = 200; // installed 200 days ago — visible from checkpoint 365 down to 180

  let state = getDefaultState();
  state = {
    ...state,
    installedPacks: ["longevity-foundation"],
    settings: {
      ...state.settings,
      name: "DIY Researcher",
      completedOnboarding: true,
      tier: "premium",
      bedtime: "23:00",
      wakeTime: "07:00",
    },
    dailyLogs: [],
    biomarkers: [],
  };

  // Walk oldest → newest.
  for (let i = 400; i >= 1; i--) {
    if (i === installDay1) state = upsertCustomPack(state, diyPack1());
    if (i === installDay2) state = upsertCustomPack(state, diyPack2());
    if (i === installDay3) state = upsertCustomPack(state, diyPack3());

    const date = dk(i);
    const dayIndex = isoDayOf(date);
    const items = compileTimeline(state, dayIndex);
    const rng = makeRng(`diy-${i}-${date}`);

    const bc: Record<string, boolean> = {};
    let total = 0;
    let completed = 0;
    for (const it of items) {
      if (it.muted) continue;
      total++;
      // High adherence so derived/curated atoms have a chance to
      // graduate to mastery; we WANT the test to surface whether
      // custom-tier ones incorrectly tag along.
      if (rng() < 0.95) {
        bc[it.canonicalKey] = true;
        completed++;
      }
    }

    const log = emptyLog(date);
    log.behaviorCompletions = bc;
    log.sleepLog.sleepQuality = rng() < 0.6 ? 5 : 4;
    log.energyLevel = rng() < 0.6 ? 5 : 4;
    log.moodLevel = rng() < 0.6 ? 5 : 4;
    log.score = total > 0 ? Math.round((completed / total) * 100) : 0;
    state = { ...state, dailyLogs: [...state.dailyLogs, log] };
  }

  return { state, installDay1, installDay2, installDay3 };
}

// ── Heavy forker: forks better-sleep, edits 2 behaviors ─────────────

function buildHeavyForker(): { state: AppState; forkId: string } {
  let state = getDefaultState();
  const sourceBetterSleep = PACKS.find((p) => p.id === "better-sleep")!;
  state = {
    ...state,
    installedPacks: ["better-sleep", "longevity-foundation"],
    settings: {
      ...state.settings,
      name: "Heavy Forker",
      completedOnboarding: true,
      tier: "premium",
      bedtime: "22:30",
      wakeTime: "06:30",
    },
    dailyLogs: [],
    biomarkers: [],
  };

  // Fork better-sleep at the beginning of the year (day 400 back).
  // We do this BEFORE walking logs so every day uses the fork.
  state = duplicatePack(state, sourceBetterSleep);
  const fork = state.customPacks[state.customPacks.length - 1];

  // Modify 2 behaviors' dose / block.
  const updated: ProtocolPack = {
    ...fork,
    behaviors: fork.behaviors.map((b) => {
      if (b.derivedFrom === "wind-down") {
        return { ...b, dose: "45-min wind-down", block: "evening" };
      }
      if (b.derivedFrom === "caffeine-cutoff") {
        return { ...b, dose: "No caffeine after 11am", block: "morning" };
      }
      return b;
    }),
  };
  state = upsertCustomPack(state, updated);

  // Walk 1..400 with the fork installed.
  for (let i = 400; i >= 1; i--) {
    const date = dk(i);
    const dayIndex = isoDayOf(date);
    const items = compileTimeline(state, dayIndex);
    const rng = makeRng(`forker-${i}-${date}`);

    const bc: Record<string, boolean> = {};
    let total = 0;
    let completed = 0;
    for (const it of items) {
      if (it.muted) continue;
      total++;
      if (rng() < 0.92) {
        bc[it.canonicalKey] = true;
        completed++;
      }
    }
    const log = emptyLog(date);
    log.behaviorCompletions = bc;
    log.sleepLog.sleepQuality = rng() < 0.6 ? 5 : 4;
    log.energyLevel = rng() < 0.6 ? 5 : 4;
    log.moodLevel = rng() < 0.6 ? 5 : 4;
    log.score = total > 0 ? Math.round((completed / total) * 100) : 0;
    state = { ...state, dailyLogs: [...state.dailyLogs, log] };
  }

  return { state, forkId: fork.id };
}

// ── Custom-pack-specific invariants ──────────────────────────────────

/**
 * Re-implements the "custom tier never masters; derived tier may"
 * contract as a standalone check so the persona test surfaces it
 * with rich context.
 */
function assertTrustTierMastery(state: AppState, dayKey: string, ctx: string) {
  const mastered = masteredKeys(state, dayKey);
  // Build per-key tier lookup using the SAME public classifier the
  // engine uses, walking customPacks for derivedFrom hints.
  const derivedLookup = new Map<string, string | undefined>();
  for (const p of state.customPacks ?? []) {
    for (const b of p.behaviors ?? []) {
      derivedLookup.set(b.canonicalKey, b.derivedFrom);
    }
  }
  for (const k of mastered) {
    const tier = classifyTier({
      canonicalKey: k,
      derivedFrom: derivedLookup.get(k),
    });
    expect(
      tier,
      `${ctx}: mastered key "${k}" is tier "${tier}" — custom-tier keys must not master`
    ).not.toBe("custom");
  }
}

/** Custom-tier behaviors must never leak into the supplement catalog. */
function assertCustomsNotInSupplementCatalog(
  state: AppState,
  ctx: string
) {
  const catalog = curatedSupplementCatalog();
  const catalogKeys = new Set(catalog.map((s) => s.id));
  const customKeys = new Set<string>();
  for (const p of state.customPacks ?? []) {
    for (const b of p.behaviors ?? []) {
      customKeys.add(b.canonicalKey);
    }
  }
  for (const k of customKeys) {
    expect(
      catalogKeys.has(k),
      `${ctx}: custom key "${k}" leaked into curatedSupplementCatalog()`
    ).toBe(false);
  }
}

/**
 * For the fork case: a forked behavior whose `derivedFrom` matches an
 * already-installed curated atom should not produce a duplicate row
 * on the compiled timeline (effectiveKey merge contract).
 */
function assertNoDuplicateForkRows(
  state: AppState,
  dayIndex: number,
  ctx: string
) {
  const items = compileTimeline(state, dayIndex);
  const groups = new Map<string, number>();
  for (const it of items) {
    // effectiveKey resolves derived/forked atoms to the curated key.
    const key = it.derivedFrom ?? it.canonicalKey;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [key, count] of groups) {
    expect(
      count,
      `${ctx}: ${count} timeline rows share effective key "${key}" — fork/curated merge broke`
    ).toBeLessThanOrEqual(1);
  }
}

// ── DIY Researcher tests ─────────────────────────────────────────────

describe("custom-pack power users — invariant stress", () => {
  describe("DIY Researcher — 3 custom packs over 365 days", () => {
    const { state } = buildDiyResearcher();

    it("invariants + trust-tier mastery hold at every checkpoint", () => {
      for (const day of CHECKPOINTS) {
        const dayKey = dk(day);
        const ctx = `DIY day ${day} (${dayKey})`;
        assertInvariants(state, ctx);
        assertTrustTierMastery(state, dayKey, ctx);
      }
    });

    it("12 custom behaviors never pollute the curated supplement catalog", () => {
      assertCustomsNotInSupplementCatalog(
        state,
        "DIY supplement-catalog isolation"
      );
      // Also: at least 12 custom behaviors across the 3 packs.
      const custom = (state.customPacks ?? []).flatMap((p) => p.behaviors);
      expect(custom.length).toBeGreaterThanOrEqual(12);
    });

    it("derived custom behaviors are mastery-eligible (pack 3)", () => {
      const pack3 = state.customPacks.find((p) => p.id === DIY_PACK_3_ID)!;
      // Each pack-3 behavior is custom:* + derivedFrom → "derived".
      for (const b of pack3.behaviors) {
        expect(
          classifyTier({
            canonicalKey: b.canonicalKey,
            derivedFrom: b.derivedFrom,
          })
        ).toBe("derived");
      }
    });

    it("mastery diagnostics — capture what graduated", () => {
      // Coverage check: at 95% adherence over a full year, SOMETHING
      // should master. If `mastered.size === 0` at day 365 we know the
      // scenario isn't actually exercising the trust-tier gate.
      const day365 = dk(365);
      const mastered = masteredKeys(state, day365);
      // Surface for the report — informational, not a hard contract.
      // eslint-disable-next-line no-console
      console.log(
        `DIY day 365 mastered: ${mastered.size} keys — ${[...mastered]
          .slice(0, 12)
          .join(", ")}`
      );
      // The custom-tier gate at engine.ts:1128-1129 should keep pack-1
      // keys OUT of this set. If any leaked through, the tier check
      // above already failed. Sanity:
      const pack1Keys = new Set(
        state.customPacks
          .find((p) => p.id === DIY_PACK_1_ID)!
          .behaviors.map((b) => b.canonicalKey)
      );
      for (const k of mastered) {
        expect(
          pack1Keys.has(k),
          `pack-1 custom-tier key "${k}" reached mastery`
        ).toBe(false);
      }
    });

    it("custom-tier behaviors (pack 1) are classified as 'custom'", () => {
      const pack1 = state.customPacks.find((p) => p.id === DIY_PACK_1_ID)!;
      for (const b of pack1.behaviors) {
        expect(
          classifyTier({
            canonicalKey: b.canonicalKey,
            derivedFrom: b.derivedFrom,
          })
        ).toBe("custom");
      }
    });

    it("custom packs survive an exportState → importState round-trip", () => {
      const json = exportState(state);
      const back = importState(json);
      expect(back).not.toBeNull();
      // Same pack ids.
      const before = state.customPacks.map((p) => p.id).sort();
      const after = back!.customPacks.map((p) => p.id).sort();
      expect(after).toEqual(before);
      // Same canonicalKeys per pack.
      for (const p of state.customPacks) {
        const matching = back!.customPacks.find((q) => q.id === p.id)!;
        expect(matching).toBeTruthy();
        const beforeKeys = p.behaviors.map((b) => b.canonicalKey).sort();
        const afterKeys = matching.behaviors.map((b) => b.canonicalKey).sort();
        expect(afterKeys).toEqual(beforeKeys);
        // derivedFrom should also survive round-trip.
        for (const b of p.behaviors) {
          const m = matching.behaviors.find(
            (x) => x.canonicalKey === b.canonicalKey
          )!;
          expect(m.derivedFrom).toBe(b.derivedFrom);
        }
      }
      // Invariants pass on the round-tripped state.
      assertInvariants(back!, "DIY round-tripped state");
    });
  });

  // ── Heavy forker ──────────────────────────────────────────────────

  describe("Heavy forker — forks better-sleep, edits 2 behaviors", () => {
    const { state, forkId } = buildHeavyForker();

    it("the fork is installed and the original is not", () => {
      expect(state.installedPacks).toContain(forkId);
      expect(state.installedPacks).not.toContain("better-sleep");
    });

    it("every forked behavior carries fork:* + derivedFrom", () => {
      const fork = state.customPacks.find((p) => p.id === forkId)!;
      for (const b of fork.behaviors) {
        expect(b.canonicalKey).toMatch(/^fork:/);
        expect(b.derivedFrom).toBeTruthy();
      }
    });

    it("invariants hold at every checkpoint", () => {
      for (const day of CHECKPOINTS) {
        assertInvariants(state, `Forker day ${day} (${dk(day)})`);
      }
    });

    it("forked atoms merge cleanly via effectiveKey — no duplicate rows", () => {
      // Re-install the official better-sleep alongside the fork to
      // exercise the merge contract (fork.derivedFrom === curated.canonicalKey).
      const merged = {
        ...state,
        installedPacks: [...state.installedPacks, "better-sleep"],
      };
      for (const day of CHECKPOINTS) {
        const dayIndex = isoDayOf(dk(day));
        assertNoDuplicateForkRows(
          merged,
          dayIndex,
          `Forker day ${day} merge`
        );
      }
    });

    it("forked-pack mastery uses fork:* keys (which are 'derived')", () => {
      // Forks always have derivedFrom — so any mastered fork:* key is
      // tier "derived", not "custom".
      const day365 = dk(365);
      assertTrustTierMastery(state, day365, "Forker day 365");
    });

    it("forked pack survives exportState → importState round-trip", () => {
      const json = exportState(state);
      const back = importState(json);
      expect(back).not.toBeNull();
      const beforeFork = state.customPacks.find((p) => p.id === forkId)!;
      const afterFork = back!.customPacks.find((p) => p.id === forkId)!;
      expect(afterFork).toBeTruthy();
      const beforeKeys = beforeFork.behaviors
        .map((b) => b.canonicalKey)
        .sort();
      const afterKeys = afterFork.behaviors
        .map((b) => b.canonicalKey)
        .sort();
      expect(afterKeys).toEqual(beforeKeys);
      for (const b of beforeFork.behaviors) {
        const m = afterFork.behaviors.find(
          (x) => x.canonicalKey === b.canonicalKey
        )!;
        expect(m.derivedFrom).toBe(b.derivedFrom);
      }
      assertInvariants(back!, "Forker round-tripped state");
    });
  });
});
