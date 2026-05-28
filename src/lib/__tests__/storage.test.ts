/**
 * storage.ts direct tests — the CRUD spine.
 *
 * The audit found storage.ts was almost entirely untested directly,
 * which is risky because it's the single source of truth for every
 * write path (toggle, override, install, custom packs, biomarkers,
 * supplements, settings) AND the migration boundary between schema
 * versions. Bugs here corrupt every downstream signal.
 *
 * This file exercises every export with at-rest fixtures so failures
 * point at specific operations, not vague engine breakage.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultState,
  importState,
  exportState,
  clearAllData,
  upsertCustomPack,
  duplicatePack,
  uninstallPack,
  installPack,
  setBehaviorOverride,
  toggleBehavior,
  toggleSupplement,
  bulkCheckSupplements,
  addSupplement,
  updateSupplement,
  removeSupplement,
  setPackPaused,
  addBiomarker,
  deleteBiomarker,
  swapBehavior,
  clearSwap,
} from "@/lib/storage";
import type {
  AppState,
  ProtocolPack,
  Supplement,
} from "@/lib/types";

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

describe("storage — defaults + import/export round-trip", () => {
  it("getDefaultState returns a v3 shape", () => {
    const s = getDefaultState();
    expect(s.version).toBe(3);
    expect(s.settings).toBeDefined();
    expect(Array.isArray(s.installedPacks)).toBe(true);
    expect(Array.isArray(s.dailyLogs)).toBe(true);
  });

  it("exportState → importState is lossless for non-volatile fields", () => {
    const s = getDefaultState();
    s.settings.name = "Test User";
    s.installedPacks = ["longevity-foundation"];
    const json = exportState(s);
    const round = importState(json);
    expect(round).not.toBeNull();
    expect(round!.settings.name).toBe("Test User");
    expect(round!.installedPacks).toContain("longevity-foundation");
  });

  it("importState handles malformed JSON without throwing", () => {
    expect(importState("not valid json {")).toBeNull();
    expect(importState("")).toBeNull();
    expect(importState("null")).toBeNull();
    expect(importState("[1, 2, 3]")).toBeNull();
  });

  it("importState rejects wrong-version payloads gracefully", () => {
    const v99 = JSON.stringify({ version: 99, settings: {} });
    // Either returns null OR returns a normalized v3 shape — anything
    // other than crashing is acceptable. (Migration is best-effort.)
    const result = importState(v99);
    if (result !== null) {
      expect(result.version).toBe(3);
    }
  });
});

describe("storage — installPack / uninstallPack", () => {
  it("installPack appends an id; idempotent on second call", () => {
    let s = getDefaultState();
    s = { ...s, installedPacks: [] };
    s = installPack(s, "better-sleep");
    s = installPack(s, "better-sleep");
    expect(s.installedPacks.filter((p) => p === "better-sleep").length).toBe(1);
  });

  it("uninstallPack removes the id", () => {
    let s = getDefaultState();
    s = { ...s, installedPacks: ["better-sleep", "longevity-foundation"] };
    s = uninstallPack(s, "better-sleep");
    expect(s.installedPacks).not.toContain("better-sleep");
    expect(s.installedPacks).toContain("longevity-foundation");
  });
});

describe("storage — setPackPaused", () => {
  it("toggling pause adds/removes from pausedPacks (reversible)", () => {
    let s = getDefaultState();
    s = { ...s, installedPacks: ["better-sleep"], pausedPacks: [] };
    s = setPackPaused(s, "better-sleep", true);
    expect(s.pausedPacks).toContain("better-sleep");
    s = setPackPaused(s, "better-sleep", false);
    expect(s.pausedPacks).not.toContain("better-sleep");
  });
});

describe("storage — custom packs CRUD", () => {
  const sample: ProtocolPack = {
    id: "custom-1",
    name: "My Pack",
    tagline: "t",
    goal: "custom",
    accent: "x",
    icon: "sparkle",
    source: "custom",
    durationLabel: "Custom",
    behaviors: [
      {
        canonicalKey: "custom:custom-1:thing-abc",
        title: "Thing",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        rationale: "r",
        icon: "sparkle",
        leverage: 2,
        kind: "action",
      },
    ],
  };

  it("upsertCustomPack adds new, edits existing", () => {
    let s = getDefaultState();
    s = upsertCustomPack(s, sample);
    expect(s.customPacks.length).toBe(1);
    const edited = { ...sample, name: "Renamed" };
    s = upsertCustomPack(s, edited);
    expect(s.customPacks.length).toBe(1);
    expect(s.customPacks[0].name).toBe("Renamed");
  });

  it("duplicatePack creates a fork: namespaced copy with derivedFrom", () => {
    let s = getDefaultState();
    s = upsertCustomPack(s, sample);
    s = duplicatePack(s, sample);
    expect(s.customPacks.length).toBe(2);
    const fork = s.customPacks[1];
    expect(fork.id).not.toBe(sample.id);
    // Fork behaviors namespaced + derivedFrom set
    for (const b of fork.behaviors) {
      expect(b.canonicalKey.startsWith("fork:")).toBe(true);
      expect(b.derivedFrom).toBeTruthy();
    }
  });
});

describe("storage — behavior toggle + score", () => {
  it("toggleBehavior creates a log if one doesn't exist", () => {
    let s = getDefaultState();
    s = { ...s, installedPacks: ["longevity-foundation"] };
    const t = new Date().toISOString().slice(0, 10);
    s = toggleBehavior(s, t, "hydrate-am");
    const log = s.dailyLogs.find((l) => l.date === t);
    expect(log).toBeDefined();
    expect(log?.behaviorCompletions?.["hydrate-am"]).toBe(true);
  });

  it("toggleBehavior is reversible (second call un-marks)", () => {
    let s = getDefaultState();
    s = { ...s, installedPacks: ["longevity-foundation"] };
    const t = new Date().toISOString().slice(0, 10);
    s = toggleBehavior(s, t, "hydrate-am");
    s = toggleBehavior(s, t, "hydrate-am");
    const log = s.dailyLogs.find((l) => l.date === t);
    expect(log?.behaviorCompletions?.["hydrate-am"]).toBe(false);
  });
});

describe("storage — supplements", () => {
  const supp: Supplement = {
    id: "test-supp",
    name: "Test Supp",
    dose: "200 mg",
    block: "morning",
    source: "custom",
  };

  it("addSupplement appends; idempotent on duplicate id", () => {
    let s = getDefaultState();
    s = addSupplement(s, supp);
    s = addSupplement(s, supp);
    expect(s.supplements?.filter((x) => x.id === "test-supp").length).toBe(1);
  });

  it("updateSupplement patches existing supplement fields", () => {
    let s = getDefaultState();
    s = addSupplement(s, supp);
    s = updateSupplement(s, "test-supp", { dose: "400 mg", notes: "doubled" });
    const found = s.supplements?.find((x) => x.id === "test-supp");
    expect(found?.dose).toBe("400 mg");
    expect(found?.notes).toBe("doubled");
  });

  it("removeSupplement removes from stack but PRESERVES completion history", () => {
    // Removing a supplement should not wipe its past data — adherence
    // stats and Insights need that history to stay honest. Re-adding
    // the same id later surfaces the past data again (intentional).
    let s = getDefaultState();
    s = addSupplement(s, supp);
    const today = new Date().toISOString().slice(0, 10);
    s = toggleSupplement(s, today, "test-supp");
    const before = s.dailyLogs.find((l) => l.date === today);
    expect(before?.supplementCompletions?.["test-supp"]).toBe(true);
    s = removeSupplement(s, "test-supp");
    expect(s.supplements?.some((x) => x.id === "test-supp")).toBe(false);
    const after = s.dailyLogs.find((l) => l.date === today);
    expect(after?.supplementCompletions?.["test-supp"]).toBe(true);
  });

  it("toggleSupplement is reversible + decrements inventory once", () => {
    let s = getDefaultState();
    s = addSupplement(s, {
      ...supp,
      inventory: { count: 30, refillAt: 7 },
    });
    const today = new Date().toISOString().slice(0, 10);
    s = toggleSupplement(s, today, "test-supp");
    expect(
      s.supplements?.find((x) => x.id === "test-supp")?.inventory?.count
    ).toBe(29);
    // Un-check restores +1 (accidental tap doesn't desync count).
    s = toggleSupplement(s, today, "test-supp");
    expect(
      s.supplements?.find((x) => x.id === "test-supp")?.inventory?.count
    ).toBe(30);
  });

  it("bulkCheckSupplements ticks multiple + decrements each", () => {
    let s = getDefaultState();
    s = addSupplement(s, {
      ...supp,
      id: "a",
      inventory: { count: 10 },
    });
    s = addSupplement(s, {
      ...supp,
      id: "b",
      inventory: { count: 10 },
    });
    const today = new Date().toISOString().slice(0, 10);
    s = bulkCheckSupplements(s, today, ["a", "b"]);
    const log = s.dailyLogs.find((l) => l.date === today);
    expect(log?.supplementCompletions?.["a"]).toBe(true);
    expect(log?.supplementCompletions?.["b"]).toBe(true);
    expect(s.supplements?.find((x) => x.id === "a")?.inventory?.count).toBe(9);
    expect(s.supplements?.find((x) => x.id === "b")?.inventory?.count).toBe(9);
  });

  it("bulkCheckSupplements with empty ids is a no-op", () => {
    let s = getDefaultState();
    s = addSupplement(s, supp);
    const before = JSON.stringify(s);
    s = bulkCheckSupplements(s, "2026-05-05", []);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("storage — biomarker future-date clamp", () => {
  it("future-dated entry clamped to today", () => {
    let s = getDefaultState();
    s = addBiomarker(s, {
      metric: "rhr",
      value: 55,
      // Far-future date — gets clamped.
      date: "2099-01-01",
    });
    const entry = s.biomarkers[0];
    expect(entry.date).not.toBe("2099-01-01");
    expect(entry.date <= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it("past-dated entry preserved as-is", () => {
    let s = getDefaultState();
    s = addBiomarker(s, {
      metric: "rhr",
      value: 55,
      date: "2024-01-15",
    });
    expect(s.biomarkers[0].date).toBe("2024-01-15");
  });

  it("deleteBiomarker removes by id", () => {
    let s = getDefaultState();
    s = addBiomarker(s, {
      metric: "rhr",
      value: 55,
      date: new Date().toISOString().slice(0, 10),
    });
    const id = s.biomarkers[0].id;
    s = deleteBiomarker(s, id);
    expect(s.biomarkers.length).toBe(0);
  });
});

describe("storage — normalize: behaviorOverrides cleanup", () => {
  it("prunes overrides for uninstalled packs", () => {
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: {
        "hydrate-am": { block: "afternoon" },
        // This key doesn't belong to any installed pack — should be pruned.
        "not-a-real-key": { block: "morning" },
      },
    });
    const s = importState(json) as AppState;
    expect(s.behaviorOverrides["hydrate-am"]).toBeDefined();
    expect(s.behaviorOverrides["not-a-real-key"]).toBeUndefined();
  });

  it("daysActive [false×7] override migrates to disabled:true", () => {
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: {
        "hydrate-am": {
          daysActive: [false, false, false, false, false, false, false],
        },
      },
    });
    const s = importState(json) as AppState;
    const ov = s.behaviorOverrides["hydrate-am"];
    expect(ov.disabled).toBe(true);
    expect(ov.daysActive).toBeUndefined();
  });
});

describe("storage — normalize: customPack namespace enforcement", () => {
  it("forces bare keys inside customPack into custom: namespace", () => {
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["custom-evil"],
      customPacks: [
        {
          id: "custom-evil",
          name: "Sneaky pack",
          tagline: "t",
          goal: "x",
          accent: "x",
          icon: "sparkle",
          source: "custom",
          durationLabel: "Custom",
          behaviors: [
            {
              // Bare curated-style key — would pollute the ontology.
              canonicalKey: "morning-sunlight",
              title: "Sneaky sunlight",
              block: "morning",
              anchor: "wake",
              offsetMin: 30,
              rationale: "r",
              icon: "sun",
              leverage: 2,
              kind: "action",
            },
          ],
        },
      ],
    });
    const s = importState(json) as AppState;
    const key = s.customPacks[0].behaviors[0].canonicalKey;
    // Bare curated key should have been rewritten into the custom: or
    // fork: namespace (depending on whether it matched a real curated
    // key). Either way it must not be the bare original.
    expect(key.startsWith("custom:") || key.startsWith("fork:")).toBe(true);
  });
});

describe("storage — clearAllData", () => {
  it("removes the protocolize-v3 key + legacy keys", () => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("protocolize-v3", JSON.stringify({ test: true }));
    localStorage.setItem("protocolize-v2", "legacy");
    clearAllData();
    expect(localStorage.getItem("protocolize-v3")).toBeNull();
    expect(localStorage.getItem("protocolize-v2")).toBeNull();
  });
});

describe("storage — supplements stay user-owned (not pack-derived)", () => {
  // Supplements are no longer auto-installed by protocol packs. The
  // user picks them from the Supplements tab (Browse / Add custom).
  // These tests pin the new contract.
  it("does NOT auto-add pack supplements just because the pack is installed", () => {
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["better-sleep"],
      supplements: undefined,
    });
    const s = importState(json) as AppState;
    expect(s.supplements?.some((x) => x.id === "magnesium-pm") ?? false).toBe(
      false
    );
  });

  it("doesn't double-create supplements when re-loaded", () => {
    const customSupp: Supplement = {
      id: "supp:custom-x",
      name: "My supp",
      block: "morning",
      source: "custom",
    };
    const json1 = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["better-sleep"],
      supplements: [customSupp],
    });
    const s1 = importState(json1) as AppState;
    const count1 = s1.supplements?.length ?? 0;
    const s2 = importState(JSON.stringify(s1)) as AppState;
    const count2 = s2.supplements?.length ?? 0;
    expect(count2).toBe(count1);
  });

  it("preserves curated supplements even when the source pack is uninstalled", () => {
    // User explicitly added Magnesium from Browse → it stays even if
    // they later uninstall the sleep pack that first surfaced it.
    const browsedSupp: Supplement = {
      id: "magnesium-pm",
      name: "Magnesium glycinate",
      block: "evening",
      source: "curated",
      installedFromPack: "better-sleep",
    };
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: [],
      supplements: [browsedSupp],
    });
    const s = importState(json) as AppState;
    expect(s.supplements?.some((x) => x.id === "magnesium-pm")).toBe(true);
  });

  it("custom supplements survive uninstall", () => {
    const customSupp: Supplement = {
      id: "supp:custom-x",
      name: "My weird supp",
      block: "morning",
      source: "custom",
    };
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["better-sleep"],
      supplements: [customSupp],
    });
    const s1 = importState(json) as AppState;
    const s2 = importState(
      JSON.stringify({ ...s1, installedPacks: [] })
    ) as AppState;
    expect(s2.supplements?.some((x) => x.id === "supp:custom-x")).toBe(true);
  });
});

describe("storage — daily-log supplement completion migration", () => {
  it("copies behaviorCompletions for supplement keys into supplementCompletions", () => {
    const today = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      installedPacks: ["better-sleep"],
      dailyLogs: [
        {
          date: today,
          sleepCompletions: [],
          exerciseEntries: [],
          nutritionScorecard: { customItems: [], note: "" },
          supplementEntries: [],
          completions: [],
          sleepLog: {},
          energyLevel: null,
          moodLevel: null,
          dayNote: "",
          score: 50,
          pillarScores: {},
          behaviorCompletions: {
            "magnesium-pm": true, // a supplement
            "wind-down": true, // a behavior, NOT a supplement
          },
        },
      ],
      // supplementsMigratedAt undefined — migration should run.
    });
    const s = importState(json) as AppState;
    const log = s.dailyLogs[0];
    expect(log.supplementCompletions?.["magnesium-pm"]).toBe(true);
    // Non-supplement key should NOT be in supplementCompletions.
    expect(log.supplementCompletions?.["wind-down"]).toBeUndefined();
  });

  it("doesn't re-run migration once supplementsMigratedAt is set", () => {
    const today = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify({
      ...getDefaultState(),
      version: 3,
      supplementsMigratedAt: 1,
      installedPacks: ["better-sleep"],
      dailyLogs: [
        {
          date: today,
          sleepCompletions: [],
          exerciseEntries: [],
          nutritionScorecard: { customItems: [], note: "" },
          supplementEntries: [],
          completions: [],
          sleepLog: {},
          energyLevel: null,
          moodLevel: null,
          dayNote: "",
          score: 50,
          pillarScores: {},
          behaviorCompletions: { "magnesium-pm": true },
          // Explicitly empty — migration would re-populate, but
          // shouldn't because the flag is set.
          supplementCompletions: {},
        },
      ],
    });
    const s = importState(json) as AppState;
    expect(
      s.dailyLogs[0].supplementCompletions?.["magnesium-pm"]
    ).toBeUndefined();
  });
});

describe("storage — setBehaviorOverride", () => {
  it("writes the override keyed by canonical key", () => {
    let s = getDefaultState();
    s = setBehaviorOverride(s, "hydrate-am", { block: "afternoon" });
    expect(s.behaviorOverrides["hydrate-am"]).toEqual({ block: "afternoon" });
  });

  it("replaces an existing override rather than merging", () => {
    let s = getDefaultState();
    s = setBehaviorOverride(s, "hydrate-am", {
      block: "afternoon",
      dose: "1 cup",
    });
    s = setBehaviorOverride(s, "hydrate-am", { block: "evening" });
    const ov = s.behaviorOverrides["hydrate-am"];
    expect(ov.block).toBe("evening");
    // Replace, not merge — original `dose` not preserved
    expect(ov.dose).toBeUndefined();
  });
});

describe("storage — workout swap (per-day)", () => {
  // Use a stable "today" string for these tests so the assertion
  // shape is deterministic.
  const today = new Date().toISOString().slice(0, 10);

  it("swapBehavior records the swap and auto-completes the replacement", () => {
    let s = getDefaultState();
    s = swapBehavior(s, today, "strength", "zone2");
    const log = s.dailyLogs.find((l) => l.date === today)!;
    expect(log.swaps?.strength).toBe("zone2");
    // Replacement is auto-marked done (the user is reporting they
    // already did it).
    expect(log.behaviorCompletions?.zone2).toBe(true);
    // The original is NOT completed — they swapped it out, didn't do it.
    expect(log.behaviorCompletions?.strength).toBeUndefined();
  });

  it("swap is a no-op when fromKey === toKey (defensive)", () => {
    let s = getDefaultState();
    s = swapBehavior(s, today, "strength", "strength");
    const log = s.dailyLogs.find((l) => l.date === today);
    expect(log?.swaps).toBeUndefined();
  });

  it("swap replaces any prior swap for the same fromKey", () => {
    // Use real catalog keys — swapBehavior now validates both
    // endpoints resolve to a known behavior, so we can't lean on
    // phantom names like "yoga" the way the original test did.
    let s = getDefaultState();
    s = swapBehavior(s, today, "strength", "zone2");
    s = swapBehavior(s, today, "strength", "extended-walk");
    const log = s.dailyLogs.find((l) => l.date === today)!;
    expect(log.swaps?.strength).toBe("extended-walk");
    expect(log.behaviorCompletions?.["extended-walk"]).toBe(true);
  });

  it("phantom toKey is rejected — swapBehavior is a no-op", () => {
    let s = getDefaultState();
    const before = JSON.stringify(s);
    s = swapBehavior(s, today, "strength", "nonexistent-key");
    expect(JSON.stringify(s)).toBe(before);
  });

  it("clearSwap preserves a legitimate pre-existing completion", () => {
    // User completes extended-walk normally at 7am, then later
    // swaps strength → extended-walk. clearSwap should remove the
    // swap mapping but NOT erase the legit 7am completion bit.
    let s = getDefaultState();
    s = toggleBehavior(s, today, "extended-walk"); // legit done
    expect(s.dailyLogs[0].behaviorCompletions?.["extended-walk"]).toBe(true);
    s = swapBehavior(s, today, "strength", "extended-walk");
    s = clearSwap(s, today, "strength");
    const log = s.dailyLogs.find((l) => l.date === today)!;
    expect(log.swaps).toBeUndefined();
    // The legitimate completion is preserved.
    expect(log.behaviorCompletions?.["extended-walk"]).toBe(true);
  });

  it("clearSwap restores the original and removes the replacement completion", () => {
    let s = getDefaultState();
    s = swapBehavior(s, today, "strength", "zone2");
    expect(s.dailyLogs[0].swaps?.strength).toBe("zone2");
    expect(s.dailyLogs[0].behaviorCompletions?.zone2).toBe(true);
    s = clearSwap(s, today, "strength");
    const log = s.dailyLogs.find((l) => l.date === today)!;
    expect(log.swaps).toBeUndefined();
    expect(log.behaviorCompletions?.zone2).toBeUndefined();
    expect(log.behaviorCompletions?.strength).toBeUndefined();
  });

  it("clearSwap is a no-op when no swap exists for the key", () => {
    let s = getDefaultState();
    const before = s.dailyLogs.length;
    s = clearSwap(s, today, "strength");
    expect(s.dailyLogs.length).toBe(before);
  });
});

describe("engine — workout-aware adaptation", () => {
  // Pin the workout-swap → "lighter day" mode-shift contract: when
  // the user trades a high-intensity workout for a low-intensity one,
  // adapt() should reflect that in the day's posture so downstream
  // demotions (cold plunge, late caffeine) actually fire.
  it("easierDayFromSwap is true when high→low intensity", async () => {
    const { easierDayFromSwap } = await import("@/lib/workouts");
    const today = new Date().toISOString().slice(0, 10);
    // Cast through unknown — the helper only needs `swaps` and
    // `date`, full DailyLog shape isn't relevant here.
    const log = {
      date: today,
      swaps: { strength: "extended-walk" }, // high → low
    } as unknown as Parameters<typeof easierDayFromSwap>[0];
    expect(easierDayFromSwap(log)).toBe(true);
  });

  it("easierDayFromSwap is false when intensities are equal or rising", async () => {
    const { easierDayFromSwap } = await import("@/lib/workouts");
    const today = new Date().toISOString().slice(0, 10);
    // walk → strength: intensity goes UP, not an "easier day"
    expect(
      easierDayFromSwap({
        date: today,
        swaps: { "extended-walk": "strength" },
      } as unknown as Parameters<typeof easierDayFromSwap>[0])
    ).toBe(false);
    // No swaps at all
    expect(
      easierDayFromSwap({
        date: today,
      } as unknown as Parameters<typeof easierDayFromSwap>[0])
    ).toBe(false);
  });

  it("baselineAdapt picks lighter mode on intensity-down swap", async () => {
    const { adapt } = await import("@/lib/engine");
    const todayDate = new Date().toISOString().slice(0, 10);
    let s = getDefaultState();
    s = swapBehavior(s, todayDate, "strength", "extended-walk");
    const result = adapt(s);
    expect(result.mode).toBe("lighter");
    expect(result.reasons.some((r) => /easier workout/i.test(r))).toBe(
      true
    );
  });
});
