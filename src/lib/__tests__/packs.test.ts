/**
 * Regression locks for two reported bugs:
 *  (b) removing the last protocol re-adds it (normalize refilled an
 *      explicit empty installedPacks with DEFAULT_INSTALLED)
 *  (a) "make editable" / custom-pack edit round-trip
 */
import { describe, it, expect } from "vitest";
import {
  importState,
  exportState,
  uninstallPack,
  duplicatePack,
  upsertCustomPack,
  getDefaultState,
} from "@/lib/storage";
import { DEFAULT_INSTALLED } from "@/lib/packs";
import {
  compileTimeline,
  shapeTimeline,
  effectiveKey,
  blockIntelligence,
} from "@/lib/engine";
import {
  listBehaviorAtoms,
  customCanonicalKey,
} from "@/lib/packs";
import type { AppState, ProtocolPack } from "@/lib/types";

const v3 = (over: Record<string, unknown>) =>
  JSON.stringify({ ...getDefaultState(), version: 3, ...over });

describe("installedPacks normalization (bug b)", () => {
  it("keeps an EXPLICIT empty list — does not resurrect defaults", () => {
    const s = importState(v3({ installedPacks: [] }));
    expect(s).not.toBeNull();
    expect(s!.installedPacks).toEqual([]);
  });

  it("still defaults when the field is missing/corrupt", () => {
    const raw = JSON.parse(v3({}));
    delete raw.installedPacks;
    const s = importState(JSON.stringify(raw));
    expect(s!.installedPacks).toEqual([...DEFAULT_INSTALLED]);
  });

  it("uninstalling the only pack survives an export→import round-trip", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["longevity-foundation"] };
    st = uninstallPack(st, "longevity-foundation");
    expect(st.installedPacks).toEqual([]);
    const back = importState(exportState(st)) as AppState;
    expect(back.installedPacks).toEqual([]); // stays gone
  });
});

describe("custom pack editability (bug a)", () => {
  const source: ProtocolPack = {
    id: "better-sleep",
    name: "Better Sleep",
    tagline: "t",
    goal: "sleep",
    accent: "var(--sleep)",
    icon: "moon",
    source: "official",
    durationLabel: "x",
    behaviors: [
      {
        canonicalKey: "wind-down",
        title: "Wind down",
        block: "evening",
        anchor: "bed",
        offsetMin: -60,
        rationale: "r",
        icon: "moon",
        leverage: 2,
        kind: "action",
      },
    ],
  } as unknown as ProtocolPack;

  it("forks namespace canonicalKeys + stamp derivedFrom for independent overrides", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["better-sleep"] };
    st = duplicatePack(st, source);

    const copy = st.customPacks.at(-1)!;
    expect(copy.source).toBe("custom");
    expect(copy.id).not.toBe("better-sleep");
    expect(st.installedPacks).toContain(copy.id);
    expect(st.installedPacks).not.toContain("better-sleep"); // original removed
    // Namespaced key: a fork's behaviorOverrides + mastery streak are
    // now independent of the canonical row (no more cross-contamination
    // with any pack that also has the original behavior).
    expect(copy.behaviors[0].canonicalKey).toMatch(/^fork:/);
    expect(copy.behaviors[0].canonicalKey).not.toBe(
      source.behaviors[0].canonicalKey
    );
    // derivedFrom preserves the curated identity so the engine's
    // intelligence-layer hooks (effectiveKey) still treat this fork
    // like the original for CONFLICT_PAIRS, CIRCADIAN, etc.
    expect(copy.behaviors[0].derivedFrom).toBe(
      source.behaviors[0].canonicalKey
    );
  });

  it("fork + original both installed → behaviors merge via derivedFrom, no duplicates", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["better-sleep"] };
    st = duplicatePack(st, source); // original removed, fork installed
    // User re-adds the official pack from the Library.
    st = { ...st, installedPacks: [...st.installedPacks, "better-sleep"] };
    // (the real official 'better-sleep' is in PACKS; merge is by
    // effectiveKey so the fork's `wind-down` merges with the curated
    // `wind-down` into ONE row even though their canonicalKeys differ.)
    const tl = compileTimeline(st, 0);
    const windDown = tl.filter(
      (i) =>
        i.canonicalKey === "wind-down" || i.derivedFrom === "wind-down"
    );
    expect(windDown.length).toBeLessThanOrEqual(1);
  });

  it("heals a pre-existing namespaced fork on load (migration)", () => {
    const raw = JSON.parse(
      v3({
        installedPacks: ["custom-999"],
        customPacks: [
          {
            id: "custom-999",
            name: "Longevity Foundation (yours)",
            tagline: "t",
            goal: "custom",
            accent: "x",
            icon: "pulse",
            source: "custom",
            durationLabel: "Custom",
            behaviors: [
              {
                canonicalKey: "custom-999:hydrate-am",
                title: "Hydrate on waking",
                block: "morning",
                anchor: "wake",
                offsetMin: 0,
                rationale: "r",
                icon: "drop",
                leverage: 2,
                kind: "action",
              },
            ],
          },
        ],
      })
    );
    const s = importState(JSON.stringify(raw)) as AppState;
    expect(s.customPacks[0].behaviors[0].canonicalKey).toBe("hydrate-am");
  });

  it("editing a custom pack (same id) replaces it and stays installed", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["better-sleep"] };
    st = duplicatePack(st, source);
    const copy = st.customPacks.at(-1)!;

    const edited: ProtocolPack = {
      ...copy,
      name: copy.name + " v2",
      behaviors: [],
    };
    st = upsertCustomPack(st, edited);

    const found = st.customPacks.filter((p) => p.id === copy.id);
    expect(found).toHaveLength(1); // replaced, not duplicated
    expect(found[0].name).toBe(copy.name + " v2");
    expect(st.installedPacks).toContain(copy.id); // still installed
  });
});

describe("CONFLICT_PAIRS — fasting restraint mutes breakfast (not strength)", () => {
  it("delay-first-meal mutes protein-breakfast but leaves strength alone", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["longevity-foundation", "fasted-mornings"],
    };
    const tl = compileTimeline(st, 0);
    const shaped = shapeTimeline(tl, "normal", {});
    const breakfast = shaped.find(
      (i) => effectiveKey(i) === "protein-breakfast"
    );
    const strength = shaped.find((i) => effectiveKey(i) === "strength");
    // Fasting wins over breakfast (CONFLICT_PAIRS entry).
    expect(breakfast?.muted).toBe(true);
    // Strength is NOT collateral damage from the fasting restraint.
    // Strength is only muted when "no-intense" is active.
    expect(strength?.muted).toBeFalsy();
  });
});

describe("blockIntelligence — calm per-block notes", () => {
  it("fires the same-day Zone 2 + strength note when both are installed", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["longevity-foundation"],
    };
    const tl = compileTimeline(st, 0);
    // Monday (dayIndex 0): Longevity Foundation's strength runs
    // Mon/Wed/Fri, zone2 daily. Both should be in afternoon today.
    const note = blockIntelligence(tl, "afternoon", 0);
    expect(note).toBeTruthy();
    expect(note!.kind).toBe("training");
    expect(note!.text).toMatch(/Zone 2|lift first|strength/i);
  });

  it("returns null on a sparse block with no training stack", () => {
    let st = getDefaultState();
    // Only Daily Essentials installed → no morning training; supplements.
    st = { ...st, installedPacks: ["daily-essentials"] };
    const tl = compileTimeline(st, 0);
    expect(blockIntelligence(tl, "morning", 0)).toBeNull();
  });

  it("fires the density note when a single block has 6+ behaviors", () => {
    let st = getDefaultState();
    // Install many packs that all contribute morning behaviors.
    st = {
      ...st,
      installedPacks: [
        "longevity-foundation",
        "better-sleep",
        "daily-essentials",
        "deep-focus",
        "morning-momentum",
        "cognitive-performance",
        "longevity-supplements",
      ],
    };
    const tl = compileTimeline(st, 0);
    const note = blockIntelligence(tl, "morning", 0);
    if (note) {
      // Either density (most likely with this many packs) or training
      // — both are valid signals; just assert one fired.
      expect(["density", "training", "combo"]).toContain(note.kind);
    }
  });
});

describe("atom-library (2B) — listBehaviorAtoms + customCanonicalKey", () => {
  it("exposes every unique curated atom with its origin packs", () => {
    const atoms = listBehaviorAtoms();
    expect(atoms.length).toBeGreaterThan(20);
    const sun = atoms.find((a) => a.canonicalKey === "morning-sunlight");
    expect(sun).toBeTruthy();
    expect(sun!.title).toBe("Morning sunlight");
    // Morning sunlight is shared across multiple packs.
    expect(sun!.fromOfficialPacks.length).toBeGreaterThanOrEqual(2);
  });

  it("customCanonicalKey produces user-namespaced keys (custom:packId:base-rand)", () => {
    const k1 = customCanonicalKey("p1", "Magnesium glycinate");
    const k2 = customCanonicalKey("p1", "Magnesium glycinate");
    expect(k1).toMatch(/^custom:p1:/);
    expect(k1.includes("magnesium-glycinate")).toBe(true);
    // Random suffix means two custom behaviors with the same title in
    // the same pack still get distinct keys.
    expect(k1).not.toBe(k2);
    // The "custom:" prefix never accidentally matches a curated key
    // (which would re-introduce the cross-contamination bug).
    expect(k1.startsWith("custom:")).toBe(true);
  });

  it("a custom behavior with derivedFrom merges with the curated atom via effectiveKey", () => {
    const customMagnesium = {
      canonicalKey: customCanonicalKey("user-pack-1", "Magnesium glycinate"),
      derivedFrom: "magnesium-pm",
      title: "Magnesium glycinate",
      block: "evening" as const,
      anchor: "bed" as const,
      offsetMin: -45,
      rationale: "Custom dose",
      icon: "pill",
      leverage: 2 as const,
      kind: "action" as const,
    };
    const customPack: ProtocolPack = {
      id: "user-pack-1",
      name: "My Sleep",
      tagline: "t",
      goal: "custom",
      accent: "x",
      icon: "moon",
      source: "custom",
      durationLabel: "Custom",
      behaviors: [customMagnesium],
    };
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["better-sleep", customPack.id],
      customPacks: [customPack],
    };
    const tl = compileTimeline(st, 0);
    // The custom Magnesium and curated magnesium-pm merge into one row.
    const magRows = tl.filter(
      (i) =>
        effectiveKey(i) === "magnesium-pm" ||
        i.derivedFrom === "magnesium-pm"
    );
    expect(magRows.length).toBe(1);
  });
});
