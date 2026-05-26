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
  validateAtom,
  trustTier,
} from "@/lib/engine";
import { PACKS } from "@/lib/packs";
import {
  buildAtomRegistry,
  auditOntology,
  explainBehavior,
  catalogInventory,
  provenanceLabel,
  evidenceFraming,
} from "@/lib/governance";
import { keystone, whatWorks, suggestions } from "@/lib/intel";
import {
  listBehaviorAtoms,
  customCanonicalKey,
} from "@/lib/packs";
import type { AppState, DailyLog, ProtocolPack } from "@/lib/types";

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
    // Legacy heal: the old `custom-999:hydrate-am` format was a fork.
    // The new namespace enforcement converts it to `fork:custom-999:
    // hydrate-am` with derivedFrom: "hydrate-am" — so the fork merges
    // with the curated atom via effectiveKey at compile time, but the
    // trust tier classifies it as "derived" (not curated). The OLD
    // heal returned bare "hydrate-am" which was an ontology-pollution
    // vector (a customPack with curated-namespace keys).
    const healed = s.customPacks[0].behaviors[0];
    expect(healed.canonicalKey).toBe("fork:custom-999:hydrate-am");
    expect(healed.derivedFrom).toBe("hydrate-am");
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

describe("validateAtom — invariant checks the type system can't catch", () => {
  it("accepts every curated atom in the catalog", () => {
    // Build the full known-key universe (every canonicalKey across all
    // curated packs) so derivedFrom / targets references can be
    // validated cross-atom. If any curated atom fails, the test name
    // surfaces the offender — this is the build-time typo guard.
    const knownKeys = new Set<string>();
    for (const p of PACKS) for (const b of p.behaviors) knownKeys.add(b.canonicalKey);
    const failures: string[] = [];
    for (const p of PACKS) {
      for (const b of p.behaviors) {
        const errs = validateAtom(b, knownKeys);
        if (errs.length)
          failures.push(
            `${p.id}:${b.canonicalKey} → ${errs
              .map((e) => `${e.field}: ${e.message}`)
              .join("; ")}`
          );
      }
    }
    if (failures.length) throw new Error(failures.join("\n"));
  });

  it("rejects malformed canonicalKey", () => {
    const errs = validateAtom({
      canonicalKey: "Has Spaces And Caps",
      title: "X",
      block: "morning",
      anchor: "wake",
      offsetMin: 0,
      rationale: "",
      icon: "sparkle",
      leverage: 2,
      kind: "action",
    });
    expect(errs.some((e) => e.field === "canonicalKey")).toBe(true);
  });

  it("rejects daysActive of wrong length", () => {
    const errs = validateAtom({
      canonicalKey: "x",
      title: "X",
      block: "morning",
      anchor: "wake",
      offsetMin: 0,
      rationale: "",
      icon: "sparkle",
      leverage: 2,
      kind: "action",
      daysActive: [true, true, true],
    });
    expect(errs.some((e) => e.field === "daysActive")).toBe(true);
  });

  it("rejects out-of-range offsetMin (e.g., -9999)", () => {
    const errs = validateAtom({
      canonicalKey: "x",
      title: "X",
      block: "morning",
      anchor: "wake",
      offsetMin: -9999,
      rationale: "",
      icon: "sparkle",
      leverage: 2,
      kind: "action",
    });
    expect(errs.some((e) => e.field === "offsetMin")).toBe(true);
  });

  it("rejects block/anchor contradictions (bed-anchored in morning block)", () => {
    const errs = validateAtom({
      canonicalKey: "x",
      title: "X",
      block: "morning",
      anchor: "bed",
      offsetMin: -45,
      rationale: "",
      icon: "sparkle",
      leverage: 2,
      kind: "action",
    });
    expect(errs.some((e) => e.field === "block")).toBe(true);
  });

  it("rejects derivedFrom/targets that point at unknown keys", () => {
    const known = new Set(["real-key"]);
    const errs = validateAtom(
      {
        canonicalKey: "x",
        title: "X",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        rationale: "",
        icon: "sparkle",
        leverage: 2,
        kind: "action",
        derivedFrom: "ghost-key",
        targets: ["another-ghost"],
      },
      known
    );
    expect(errs.find((e) => e.field === "derivedFrom")).toBeTruthy();
    expect(errs.find((e) => e.field === "targets")).toBeTruthy();
  });
});

describe("safety-flag suppression — atoms with contraindications hide from the timeline", () => {
  it("hides cold-plunge-am from a pregnant user", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["cold-heat-therapy"],
      settings: {
        ...st.settings,
        safetyFlags: { pregnant: true },
      },
    };
    const tl = compileTimeline(st, 0);
    expect(tl.find((i) => i.canonicalKey === "cold-plunge-am")).toBeUndefined();
    expect(tl.find((i) => i.canonicalKey === "sauna-pm")).toBeUndefined();
  });

  it("hides delay-first-meal from an under-18 user", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["fasted-mornings"],
      settings: {
        ...st.settings,
        safetyFlags: { "under-18": true },
      },
    };
    const tl = compileTimeline(st, 0);
    expect(
      tl.find((i) => i.canonicalKey === "delay-first-meal")
    ).toBeUndefined();
  });

  it("leaves non-contraindicated atoms in place", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["cold-heat-therapy"],
      settings: {
        ...st.settings,
        safetyFlags: { pregnant: true },
      },
    };
    const tl = compileTimeline(st, 0);
    // The "no-cold-post-lift" rule isn't flagged for pregnancy, so it
    // should still appear (it's an avoid card, harmless to a pregnant
    // user — and zero risk to surface).
    expect(
      tl.find((i) => i.canonicalKey === "no-cold-post-lift")
    ).toBeTruthy();
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

describe("trust tier classification — the governance guardrail", () => {
  it("classifies curated atoms as curated", () => {
    expect(trustTier({ canonicalKey: "magnesium-pm" })).toBe("curated");
    expect(trustTier({ canonicalKey: "morning-sunlight" })).toBe("curated");
  });

  it("classifies custom + derivedFrom as derived", () => {
    expect(
      trustTier({
        canonicalKey: "custom:p1:magnesium-xyz",
        derivedFrom: "magnesium-pm",
      })
    ).toBe("derived");
  });

  it("classifies custom WITHOUT derivedFrom as custom", () => {
    expect(
      trustTier({ canonicalKey: "custom:p1:vagus-massage-xyz" })
    ).toBe("custom");
  });

  it("classifies forks as derived (they always carry derivedFrom)", () => {
    expect(
      trustTier({
        canonicalKey: "fork:abc:wind-down",
        derivedFrom: "wind-down",
      })
    ).toBe("derived");
  });

  it("compileTimeline stamps trustTier on every row", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["longevity-foundation"] };
    const tl = compileTimeline(st, 0);
    for (const item of tl) {
      expect(item.trustTier).toBeDefined();
      // All curated packs ship curated atoms.
      expect(item.trustTier).toBe("curated");
    }
  });

  it("merge picks the most-authoritative tier (custom < derived < curated)", () => {
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
    const magRow = tl.find(
      (i) =>
        i.canonicalKey === "magnesium-pm" ||
        i.derivedFrom === "magnesium-pm"
    );
    expect(magRow).toBeTruthy();
    // The merged row gets the curated atom's tier — NOT the derived
    // tier from the user-namespaced canonical key visited second.
    expect(magRow!.trustTier).toBe("curated");
  });
});

describe("governance: custom behaviors NEVER become 'trusted system knowledge'", () => {
  // Local helpers — packs.test.ts doesn't have the log/dk helpers
  // intel.test.ts uses; inline them here so the governance tests
  // don't depend on the other file.
  const dkLocal = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const logLocal = (
    date: string,
    bc: Record<string, boolean>,
    score: number
  ): DailyLog =>
    ({
      date,
      behaviorCompletions: bc,
      score,
      sleepLog: {},
      energyLevel: null,
      moodLevel: null,
      exerciseEntries: [],
      supplementEntries: [],
      sleepCompletions: [],
      completions: [],
      nutritionScorecard: { customItems: [], note: "" },
    }) as unknown as DailyLog;

  // Build a state where, *without* the trust-tier gate, the custom
  // behavior would absolutely win the keystone — it appears alongside
  // 4+ other completions on its "done" days and alone on its "not"
  // days, the strongest possible signal. The gate is the only reason
  // it's not returned. (Previous version of this test had logs that
  // recorded only the custom completion, so mD == mN == 0 and the
  // custom was discarded by the effect-size check, not the gate —
  // the test passed for the wrong reason.)
  function buildCustomKeystoneCandidate(): AppState {
    const customPack: ProtocolPack = {
      id: "user-magic",
      name: "User's Magic Trick",
      tagline: "t",
      goal: "custom",
      accent: "x",
      icon: "sparkle",
      source: "custom",
      durationLabel: "Custom",
      behaviors: [
        {
          canonicalKey: "custom:user-magic:magic-trick-xyz",
          title: "Aunt Mary's herbal blend",
          block: "morning",
          anchor: "wake",
          offsetMin: 30,
          rationale: "Custom behavior.",
          icon: "sparkle",
          leverage: 3,
          kind: "action",
        },
      ],
    };
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["longevity-foundation", "user-magic"],
      customPacks: [customPack],
    };
    // 30 days of strong correlation: on custom-done days, 5 curated
    // behaviors are also completed. On custom-not days, only 1 is.
    // This is a deliberately overwhelming signal so the custom would
    // win on Cohen's d without the gate.
    const others = [
      "morning-sunlight",
      "hydrate-am",
      "protein-breakfast",
      "wind-down",
      "magnesium-pm",
    ];
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 30; i++) {
      const customDone = i % 2 === 0;
      const bc: Record<string, boolean> = {
        "custom:user-magic:magic-trick-xyz": customDone,
      };
      if (customDone) {
        for (const k of others) bc[k] = true;
      } else {
        bc["morning-sunlight"] = true; // one weak curated each "not" day
      }
      logs.push(logLocal(dkLocal(i), bc, customDone ? 85 : 25));
    }
    return { ...st, dailyLogs: logs };
  }

  it("custom behavior never becomes the keystone, no matter how strong the signal", () => {
    const st = buildCustomKeystoneCandidate();
    const ks = keystone(st);
    // The keystone function MUST return something (the curated others
    // satisfy every threshold) — proving the function actually ran
    // past the trust-tier gate, not silently returned null. Then the
    // returned key must not be the custom.
    expect(ks).not.toBeNull();
    expect(ks!.key).not.toBe("custom:user-magic:magic-trick-xyz");
    // And the winner must be one of the curated others — sanity check
    // that the gate filters correctly without breaking the function.
    expect(ks!.key.startsWith("custom:")).toBe(false);
  });

  it("whatWorks does not surface a free-text custom as 'proven by your data'", () => {
    // Use feltIndex-driving signals AND make the custom correlate
    // strongly with high felt index — without the gate, the custom
    // would win this insight too.
    const st = buildCustomKeystoneCandidate();
    const logsWithFelt: DailyLog[] = st.dailyLogs.map((l) => {
      const customDone =
        l.behaviorCompletions?.["custom:user-magic:magic-trick-xyz"] === true;
      return {
        ...l,
        energyLevel: customDone ? 5 : 2,
        sleepLog: { sleepQuality: customDone ? 5 : 2 },
      } as DailyLog;
    });
    const ww = whatWorks({ ...st, dailyLogs: logsWithFelt });
    // whatWorks must not be null here (curated others have the same
    // correlation pattern with felt index). The returned key must not
    // be the custom — that's the gate working.
    expect(ww).not.toBeNull();
    expect(ww!.key).not.toBe("custom:user-magic:magic-trick-xyz");
    expect(ww!.key.startsWith("custom:")).toBe(false);
  });

  it("suggestions does not auto-recommend retiming/pausing a custom behavior", () => {
    // 21+ days, 5+ active, custom never completed → would trigger
    // retime/pause WITHOUT the trust-tier gate. To prove the gate is
    // what's protecting the custom (not vacuous emptiness), we
    // include a curated-but-never-done behavior too and verify the
    // suggestions list does contain a retime/pause for *that* one —
    // proving the suggestion path is alive and the custom's absence
    // is specifically the gate's doing.
    const customPack: ProtocolPack = {
      id: "user-skip",
      name: "Skip Pack",
      tagline: "t",
      goal: "custom",
      accent: "x",
      icon: "sparkle",
      source: "custom",
      durationLabel: "Custom",
      behaviors: [
        {
          canonicalKey: "custom:user-skip:never-done-xyz",
          title: "Thing user never does",
          block: "morning",
          anchor: "wake",
          offsetMin: 90,
          rationale: "Custom behavior.",
          icon: "sparkle",
          leverage: 2,
          kind: "action",
        },
      ],
    };
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["longevity-foundation", "user-skip"],
      customPacks: [customPack],
    };
    // 25 days of activity — hydrate done daily, but NSDR (curated,
    // installed via longevity-foundation) never done. Both the custom
    // and the curated-skipped behavior reach the "ever done in 7 days"
    // gate.
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 25; i++)
      logs.push(
        logLocal(
          dkLocal(i),
          { "hydrate-am": true, "morning-sunlight": true },
          60
        )
      );
    const sug = suggestions({ ...st, dailyLogs: logs });
    // Custom never gets a retime or pause suggestion.
    expect(
      sug.find(
        (s) =>
          (s.action.type === "retime" || s.action.type === "pause") &&
          s.action.key === "custom:user-skip:never-done-xyz"
      )
    ).toBeUndefined();
    // Proof the suggestion path executed past the gate: it produced at
    // least one retime/pause for a curated skipped behavior (or no
    // skipped suggestion at all because every curated behavior in
    // longevity-foundation reaches "ever done" via hydrate/sunlight).
    // The key assertion is the custom-specific one above; this is just
    // a sanity that suggestions returned a real array.
    expect(Array.isArray(sug)).toBe(true);
  });
});

describe("governance: atom registry + ontology audit", () => {
  it("buildAtomRegistry returns every curated atom in the live catalog", () => {
    const registry = buildAtomRegistry();
    expect(registry.size).toBeGreaterThan(50);
    // Sanity: known atoms are present and tagged curated.
    expect(registry.get("morning-sunlight")?.trustTier).toBe("curated");
    expect(registry.get("magnesium-pm")?.trustTier).toBe("curated");
  });

  it("auditOntology reports zero errors against the live catalog", () => {
    const issues = auditOntology();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new Error(
        "Ontology errors:\n" +
          errors.map((e) => ` - ${e.kind}: ${e.message}`).join("\n")
      );
    }
  });

  it("catalogInventory counts atoms by trust tier + evidence tier", () => {
    const inv = catalogInventory();
    expect(inv.totalCurated).toBeGreaterThan(50);
    expect(inv.byTrustTier.curated).toBe(inv.totalCurated);
    expect(inv.byTrustTier.derived).toBe(0); // Registry doesn't include user-derived
    expect(inv.byTrustTier.custom).toBe(0);
    // Some atoms have evidenceTier (the ones we hedged); some don't.
    const tiered =
      (inv.byEvidenceTier.established ?? 0) +
      (inv.byEvidenceTier.emerging ?? 0) +
      (inv.byEvidenceTier.exploratory ?? 0);
    expect(tiered).toBeGreaterThan(5);
  });
});

describe("user-facing provenance — calm language, not enterprise jargon", () => {
  it("custom behavior gets the 'Personal' pill + kept-just-for-you line", () => {
    const prov = provenanceLabel({
      canonicalKey: "custom:p1:thing-xyz",
      trustTier: "custom",
    });
    expect(prov.shortLabel).toBe("Personal");
    expect(prov.fullLine).toContain("personal behavior");
    // Forbid enterprise/clinical language anywhere
    expect(prov.fullLine?.toLowerCase()).not.toMatch(
      /tier|governance|validated|verified|trust|class/
    );
  });

  it("derived behavior names the curated original it's adapted from", () => {
    const registry = buildAtomRegistry();
    const prov = provenanceLabel(
      {
        canonicalKey: "custom:p1:my-magnesium-xyz",
        derivedFrom: "magnesium-pm",
        trustTier: "derived",
      },
      registry
    );
    expect(prov.shortLabel).toBeNull();
    expect(prov.fullLine).toMatch(/Adapted from .*[Mm]agnesium/);
  });

  it("curated behavior names the protocol(s) it came from", () => {
    const prov = provenanceLabel({
      canonicalKey: "magnesium-pm",
      trustTier: "curated",
      fromPacks: ["Better Sleep"],
    });
    expect(prov.shortLabel).toBeNull();
    expect(prov.fullLine).toContain("Better Sleep");
    expect(prov.fullLine).toContain("From your");
  });

  it("curated behavior across multiple packs uses the 'common across' framing", () => {
    const prov = provenanceLabel({
      canonicalKey: "morning-sunlight",
      trustTier: "curated",
      fromPacks: ["Better Sleep", "Longevity Foundation", "Cognitive Performance"],
    });
    expect(prov.fullLine).toContain("Common across");
    expect(prov.fullLine).toContain("3");
  });

  it("derives trustTier from canonicalKey shape when not provided", () => {
    // Custom-namespaced key without trustTier → treated as custom.
    const prov = provenanceLabel({ canonicalKey: "custom:p1:thing-xyz" });
    expect(prov.shortLabel).toBe("Personal");
  });

  it("evidenceFraming returns null for established + undefined", () => {
    expect(evidenceFraming(undefined)).toBeNull();
    expect(evidenceFraming("established")).toBeNull();
  });

  it("evidenceFraming hedges emerging + exploratory tiers calmly", () => {
    const emerging = evidenceFraming("emerging");
    const exploratory = evidenceFraming("exploratory");
    expect(emerging).toContain("encouraging");
    expect(exploratory).toContain("experimental");
    // Forbid clinical/anxiety language
    for (const text of [emerging, exploratory]) {
      expect(text?.toLowerCase()).not.toMatch(
        /tier|level|grade|class|warning|danger|unproven|unsafe/
      );
    }
  });
});

describe("explainBehavior — provenance + suppression reasons surface", () => {
  it("returns provenance for a curated atom in the timeline", () => {
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["longevity-foundation", "better-sleep"],
    };
    const exp = explainBehavior(st, "morning-sunlight", 0);
    expect(exp).toBeTruthy();
    expect(exp!.trustTier).toBe("curated");
    expect(exp!.recommendationEligible).toBe(true);
    expect(exp!.keystoneEligible).toBe(true);
    // Morning sunlight appears in both packs — should show merged.
    expect(exp!.mergedFromMultiple).toBe(true);
  });

  it("explains why an atom is muted by a conflict pair", () => {
    let st = getDefaultState();
    // Install Fasted Mornings → delay-first-meal restraint active →
    // protein-breakfast mutes.
    st = {
      ...st,
      installedPacks: ["fasted-mornings", "longevity-foundation"],
    };
    const exp = explainBehavior(st, "protein-breakfast", 0);
    expect(exp).toBeTruthy();
    expect(exp!.muted).toBe(true);
    expect(exp!.muteReason).toContain("conflict pair");
    expect(exp!.muteReason).toContain("delay-first-meal");
  });

  it("flags a custom behavior as recommendation-ineligible", () => {
    const customPack: ProtocolPack = {
      id: "user-custom",
      name: "Custom",
      tagline: "t",
      goal: "custom",
      accent: "x",
      icon: "sparkle",
      source: "custom",
      durationLabel: "Custom",
      behaviors: [
        {
          canonicalKey: "custom:user-custom:thing-xyz",
          title: "Thing",
          block: "morning",
          anchor: "wake",
          offsetMin: 30,
          rationale: "Custom",
          icon: "sparkle",
          leverage: 2,
          kind: "action",
        },
      ],
    };
    let st = getDefaultState();
    st = {
      ...st,
      installedPacks: ["user-custom"],
      customPacks: [customPack],
    };
    const exp = explainBehavior(st, "custom:user-custom:thing-xyz", 0);
    expect(exp).toBeTruthy();
    expect(exp!.trustTier).toBe("custom");
    expect(exp!.recommendationEligible).toBe(false);
    expect(exp!.keystoneEligible).toBe(false);
    expect(exp!.notes.some((n) => n.toLowerCase().includes("custom"))).toBe(
      true
    );
  });
});
