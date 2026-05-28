/**
 * supplements.test.ts — separation logic, detection, and helpers.
 *
 * The Sprint 3 audit flagged that the supplement-detection heuristic
 * is load-bearing (one bad call → supplements appear inline on Today,
 * or worse, get auto-extracted incorrectly). These tests pin the
 * detection contract for all four fallback layers.
 */
import { describe, it, expect } from "vitest";
import {
  isSupplementKey,
  isSupplementBehavior,
  SUPPLEMENT_CANONICAL_KEYS,
  supplementsForBlock,
  supplementBlockProgress,
  curatedSupplementCatalog,
  supplementFromBehavior,
} from "@/lib/supplements";
import type { BehaviorDef, Supplement } from "@/lib/types";

describe("isSupplementKey — strict registry lookup", () => {
  it("returns true for known supplement canonical keys", () => {
    expect(isSupplementKey("magnesium-pm")).toBe(true);
    expect(isSupplementKey("vitamin-d3")).toBe(true);
    expect(isSupplementKey("nmn")).toBe(true);
    expect(isSupplementKey("strategic-melatonin")).toBe(true);
  });

  it("returns false for non-supplement behavior keys", () => {
    expect(isSupplementKey("morning-sunlight")).toBe(false);
    expect(isSupplementKey("wind-down")).toBe(false);
    expect(isSupplementKey("strength")).toBe(false);
    expect(isSupplementKey("not-a-real-key")).toBe(false);
  });

  it("SUPPLEMENT_CANONICAL_KEYS contains the expected count (~36)", () => {
    // Pin a bound so accidental removals get noticed. If you
    // deliberately remove items from the registry, bump the lower
    // bound and document why in the commit.
    expect(SUPPLEMENT_CANONICAL_KEYS.size).toBeGreaterThanOrEqual(30);
    expect(SUPPLEMENT_CANONICAL_KEYS.size).toBeLessThan(80);
  });
});

describe("isSupplementBehavior — four-layer detection", () => {
  it("layer 1: canonical key in registry → true", () => {
    expect(
      isSupplementBehavior({
        canonicalKey: "magnesium-pm",
        title: "Magnesium (weird title)",
      })
    ).toBe(true);
  });

  it("layer 2: derivedFrom in registry → true (forks)", () => {
    expect(
      isSupplementBehavior({
        canonicalKey: "fork:custom-99:magnesium-pm",
        derivedFrom: "magnesium-pm",
        title: "My magnesium",
      })
    ).toBe(true);
  });

  it("layer 3: icon === 'pill' → true (catches CMS-renamed atoms)", () => {
    expect(
      isSupplementBehavior({
        canonicalKey: "some-random-key",
        icon: "pill",
        title: "Something I take",
      })
    ).toBe(true);
  });

  it("layer 4: title regex catches melatonin/CoQ10/etc.", () => {
    // CMS-edited title that doesn't match the canonical key registry
    // and uses icon "moon" (not "pill").
    expect(
      isSupplementBehavior({
        canonicalKey: "custom-xyz",
        icon: "moon",
        title: "Low-dose melatonin",
      })
    ).toBe(true);
    expect(
      isSupplementBehavior({
        canonicalKey: "custom-xyz",
        icon: "leaf",
        title: "CoQ10 (ubiquinone)",
      })
    ).toBe(true);
    expect(
      isSupplementBehavior({
        canonicalKey: "x",
        title: "Omega-3 fish oil",
        icon: "fish",
      })
    ).toBe(true);
  });

  it("layer 4 word-boundary: 'vitamin' alone NOT enough", () => {
    // "vitamin" by itself shouldn't sweep up unrelated behaviors.
    // The regex requires "vitamin X" with a letter/digit.
    expect(
      isSupplementBehavior({
        canonicalKey: "x",
        title: "Behavioral vitamin lifestyle",
        icon: "leaf",
      })
    ).toBe(false);
  });

  it("none of the layers match → false", () => {
    expect(
      isSupplementBehavior({
        canonicalKey: "morning-sunlight",
        title: "Morning sunlight",
        icon: "sun",
      })
    ).toBe(false);
    expect(
      isSupplementBehavior({
        canonicalKey: "wind-down",
        title: "Wind-down ritual",
        icon: "moon",
      })
    ).toBe(false);
  });
});

describe("supplementsForBlock — filtering + sort + safety", () => {
  const sample = (over: Partial<Supplement> = {}): Supplement => ({
    id: over.id ?? "x",
    name: over.name ?? "X",
    block: over.block ?? "morning",
    source: over.source ?? "custom",
    ...over,
  });

  it("returns only supplements in the requested block", () => {
    const list: Supplement[] = [
      sample({ id: "a", name: "AAA", block: "morning" }),
      sample({ id: "b", name: "BBB", block: "evening" }),
      sample({ id: "c", name: "CCC", block: "morning" }),
    ];
    const r = supplementsForBlock(list, "morning", 0);
    expect(r.map((s) => s.id).sort()).toEqual(["a", "c"]);
  });

  it("respects daysActive — Mon-Sun filtering", () => {
    const list: Supplement[] = [
      sample({
        id: "weekday-only",
        block: "morning",
        daysActive: [true, true, true, true, true, false, false], // M-F
      }),
    ];
    // Mon (index 0) → present
    expect(supplementsForBlock(list, "morning", 0).length).toBe(1);
    // Sat (index 5) → filtered
    expect(supplementsForBlock(list, "morning", 5).length).toBe(0);
  });

  it("filters out contraindicated supplements when safety flag is set", () => {
    const list: Supplement[] = [
      sample({
        id: "warfarin-risk",
        block: "morning",
        contraindications: ["anticoagulants"],
      }),
    ];
    expect(supplementsForBlock(list, "morning", 0).length).toBe(1);
    expect(
      supplementsForBlock(list, "morning", 0, { anticoagulants: true }).length
    ).toBe(0);
  });

  it("orders curated before customs, alphabetical within each group", () => {
    const list: Supplement[] = [
      sample({ id: "z-custom", name: "Z custom", source: "custom" }),
      sample({ id: "a-custom", name: "A custom", source: "custom" }),
      sample({ id: "z-curated", name: "Z curated", source: "curated" }),
      sample({ id: "a-curated", name: "A curated", source: "curated" }),
    ];
    const r = supplementsForBlock(list, "morning", 0);
    expect(r.map((s) => s.id)).toEqual([
      "a-curated",
      "z-curated",
      "a-custom",
      "z-custom",
    ]);
  });
});

describe("supplementBlockProgress", () => {
  const list: Supplement[] = [
    {
      id: "a",
      name: "A",
      block: "morning",
      source: "curated",
    },
    {
      id: "b",
      name: "B",
      block: "morning",
      source: "curated",
    },
    {
      id: "c",
      name: "C",
      block: "evening",
      source: "curated",
    },
  ];

  it("returns null for blocks with no supplements", () => {
    expect(supplementBlockProgress(list, "afternoon", 0, {})).toBeNull();
  });

  it("counts done / total for the block", () => {
    const r = supplementBlockProgress(list, "morning", 0, { a: true });
    expect(r).toEqual({ done: 1, total: 2 });
  });

  it("ignores completions for other blocks", () => {
    const r = supplementBlockProgress(list, "morning", 0, {
      a: true,
      c: true,
    });
    expect(r).toEqual({ done: 1, total: 2 });
  });
});

describe("curatedSupplementCatalog", () => {
  it("returns dedup'd list of all curated supplements", () => {
    const catalog = curatedSupplementCatalog();
    expect(catalog.length).toBeGreaterThan(20);
    // No duplicates by id
    const ids = catalog.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every catalog entry has source = curated", () => {
    const catalog = curatedSupplementCatalog();
    for (const s of catalog) {
      expect(s.source).toBe("curated");
    }
  });

  it("includes magnesium-pm with its dose preserved", () => {
    const catalog = curatedSupplementCatalog();
    const mag = catalog.find((s) => s.id === "magnesium-pm");
    expect(mag).toBeDefined();
    expect(mag?.dose).toBeTruthy();
  });
});

describe("supplementFromBehavior — conversion helper", () => {
  it("copies title/dose/block/contraindications onto Supplement", () => {
    const b: BehaviorDef = {
      canonicalKey: "test-key",
      title: "Test supplement",
      block: "evening",
      anchor: "bed",
      offsetMin: -30,
      dose: "100 mg",
      rationale: "It works",
      icon: "pill",
      leverage: 2,
      kind: "action",
      contraindications: ["pregnant"],
      evidenceTier: "established",
    };
    const s = supplementFromBehavior(b);
    expect(s.id).toBe("test-key");
    expect(s.name).toBe("Test supplement");
    expect(s.dose).toBe("100 mg");
    expect(s.block).toBe("evening");
    expect(s.derivedFrom).toBe("test-key");
    expect(s.contraindications).toEqual(["pregnant"]);
    expect(s.evidenceTier).toBe("established");
    expect(s.source).toBe("curated");
  });
});
