/**
 * Behavior interaction model — foundational guarantees (Phases 0-1).
 *
 * Phase 0 — guards the data-driven interaction layer we're building on
 * top of the existing hardcoded CONFLICT_PAIRS:
 *  - evidenceRank ordering (most → least evidence-based),
 *  - bundle checksum backward-compat (an empty/absent interactions field
 *    must NOT change the checksum, so bundles published before this field
 *    existed still validate on read-back),
 *  - every key any interaction can reference resolves to a real curated
 *    atom (the guard against a typo'd a_key/b_key ever shipping).
 *
 * Phase 1 — the restraint-whitelist safety fix: only a CURATED behavior
 * may act as a conflict restraint, so a user's own custom/derived "no
 * intense training" can never silently mute their real curated training.
 */
import { describe, it, expect, afterEach } from "vitest";
import { evidenceRank, knownCuratedKeys } from "@/lib/governance";
import {
  bundleChecksum,
  builtinBundle,
  applyPublishedBundle,
  resetKnowledge,
} from "@/lib/knowledge";
import {
  CONFLICT_PAIRS,
  BUILTIN_INTERACTIONS,
  resolvedInteractions,
  applyConflictMutes,
  compileTimeline,
  shapeTimeline,
  type TimelineItem,
} from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { Interaction, AppState, ProtocolPack } from "@/lib/types";

describe("evidenceRank", () => {
  it("orders established < emerging < absent < exploratory", () => {
    expect(evidenceRank("established")).toBe(0);
    expect(evidenceRank("emerging")).toBe(1);
    expect(evidenceRank(undefined)).toBe(2); // foundational / no claim — neutral middle
    expect(evidenceRank("exploratory")).toBe(3);
    // strongest first; experimental last; "no claim" sits between, never punished below experimental
    expect(evidenceRank("established")).toBeLessThan(evidenceRank("emerging"));
    expect(evidenceRank("emerging")).toBeLessThan(evidenceRank(undefined));
    expect(evidenceRank(undefined)).toBeLessThan(evidenceRank("exploratory"));
  });
});

describe("bundle checksum — interactions backward-compat", () => {
  const base = { protocols: builtinBundle().protocols, config: {} };
  it("absent or empty interactions does not change the checksum", () => {
    const without = bundleChecksum(base);
    expect(bundleChecksum({ ...base, interactions: [] })).toBe(without);
    expect(bundleChecksum({ ...base, interactions: undefined })).toBe(without);
  });
  it("a non-empty interactions list does change the checksum", () => {
    const without = bundleChecksum(base);
    const withOne = bundleChecksum({
      ...base,
      interactions: [
        {
          aKey: "strength",
          bKey: "zone2",
          type: "ordering",
          severity: "soft",
          nudge: "x",
        },
      ],
    });
    expect(withOne).not.toBe(without);
  });
});

describe("interaction keys resolve to real atoms", () => {
  const known = knownCuratedKeys();

  it("the curated registry is populated", () => {
    expect(known.size).toBeGreaterThan(0);
  });

  // Every key referenced by the built-in CONFLICT_PAIRS (which Phase 2
  // migrates into interaction records) must be a real curated atom. This
  // is the same check the engine's interaction layer relies on — a typo'd
  // a_key/b_key can never silently ship.
  it("every CONFLICT_PAIRS key is a known curated atom", () => {
    for (const p of CONFLICT_PAIRS) {
      expect(known.has(p.restraint), `restraint "${p.restraint}"`).toBe(true);
      expect(known.has(p.target), `target "${p.target}"`).toBe(true);
    }
  });

  // Reusable shape Phase 2+ applies to BUILTIN_INTERACTIONS and any
  // bundle-authored interactions before they are allowed to ship.
  it("a sample interaction set validates against the registry", () => {
    const sample: Interaction[] = CONFLICT_PAIRS.map((p) => ({
      aKey: p.restraint,
      bKey: p.target,
      type: "conflict",
      severity: "firm",
      nudge: "",
    }));
    for (const i of sample) {
      expect(known.has(i.aKey) && known.has(i.bKey)).toBe(true);
    }
  });
});

// ── Phase 1: restraint whitelist (safety) ──────────────────────────────
// A curated "strength" behavior, active every day (no daysActive).
const strengthPack: ProtocolPack = {
  id: "test-strength",
  name: "Test Strength",
  tagline: "t",
  goal: "custom",
  accent: "x",
  icon: "dumbbell",
  source: "official",
  durationLabel: "x",
  behaviors: [
    {
      canonicalKey: "strength",
      title: "Strength training",
      block: "afternoon",
      anchor: "wake",
      offsetMin: 300,
      rationale: "r",
      icon: "dumbbell",
      leverage: 3,
      kind: "action",
    },
  ],
};
// A curated (official) "no-intense" restraint — the legitimate case.
const officialNoIntense: ProtocolPack = {
  id: "test-burnout",
  name: "Test Burnout",
  tagline: "t",
  goal: "custom",
  accent: "x",
  icon: "shield",
  source: "official",
  durationLabel: "x",
  behaviors: [
    {
      canonicalKey: "no-intense",
      title: "No intense training",
      block: "anytime",
      anchor: "wake",
      offsetMin: 0,
      rationale: "r",
      icon: "shield",
      leverage: 3,
      kind: "avoid",
    },
  ],
};
// A user-authored restraint DERIVED from the curated "no-intense" key
// (the atom-library pick path: custom: key + derivedFrom). trustTier
// resolves to "derived", never "curated".
const customNoIntense: ProtocolPack = {
  id: "user-rest",
  name: "User Rest Rule",
  tagline: "t",
  goal: "custom",
  accent: "x",
  icon: "shield",
  source: "custom",
  durationLabel: "x",
  behaviors: [
    {
      canonicalKey: "custom:user-rest:no-int-x",
      derivedFrom: "no-intense",
      title: "My own rest rule",
      block: "anytime",
      anchor: "wake",
      offsetMin: 0,
      rationale: "Custom behavior.",
      icon: "shield",
      leverage: 3,
      kind: "avoid",
    },
  ],
};

// A curated behavior with no built-in restraint relationship — used to
// prove a brand-new, data-authored conflict (not in BUILTIN) can fire.
const sunlightPack: ProtocolPack = {
  id: "test-light",
  name: "Test Light",
  tagline: "t",
  goal: "custom",
  accent: "x",
  icon: "sun",
  source: "official",
  durationLabel: "x",
  behaviors: [
    {
      canonicalKey: "morning-sunlight",
      title: "Morning sunlight",
      block: "morning",
      anchor: "wake",
      offsetMin: 20,
      rationale: "r",
      icon: "sun",
      leverage: 3,
      kind: "action",
    },
  ],
};

function stateWith(installed: string[]): AppState {
  return { ...getDefaultState(), installedPacks: installed };
}
function isMuted(items: TimelineItem[], key: string): boolean | null {
  const it = items.find((i) => i.canonicalKey === key);
  return it ? it.muted : null; // null = not present
}

describe("restraint whitelist — only curated restraints mute (safety)", () => {
  it("a curated (official) restraint DOES mute curated strength (control)", () => {
    const st = stateWith(["test-strength", "test-burnout"]);
    const tl = compileTimeline(st, 0, [strengthPack, officialNoIntense]);
    const shaped = shapeTimeline(tl, "normal", {});
    expect(isMuted(shaped, "strength")).toBe(true);
  });

  it("a user custom/derived restraint does NOT mute curated strength", () => {
    const st = stateWith(["test-strength", "user-rest"]);
    const tl = compileTimeline(st, 0, [strengthPack, customNoIntense]);
    const shaped = shapeTimeline(tl, "normal", {});
    // present AND not muted — a self-authored "no intense" can't silence
    // the user's real curated training.
    expect(shaped.some((i) => i.canonicalKey === "strength")).toBe(true);
    expect(isMuted(shaped, "strength")).toBe(false);
  });
});

// ── Phase 2: data-driven conflict seam ─────────────────────────────────
describe("data-driven conflict seam (interactions)", () => {
  it("BUILTIN_INTERACTIONS mute the same target as the hardcoded pairs; [] mutes nothing", () => {
    const st = stateWith(["test-strength", "test-burnout"]);
    const items = compileTimeline(st, 0, [strengthPack, officialNoIntense]);
    expect(
      isMuted(applyConflictMutes(items, BUILTIN_INTERACTIONS), "strength")
    ).toBe(true);
    expect(isMuted(applyConflictMutes(items, []), "strength")).toBe(false);
  });

  it("resolvedInteractions() with no published bundle equals the built-in set", () => {
    // No bundle is published in this test file → only the built-in pairs.
    expect(resolvedInteractions()).toEqual([...BUILTIN_INTERACTIONS]);
    expect(BUILTIN_INTERACTIONS.length).toBe(CONFLICT_PAIRS.length);
  });

  it("a data-authored (non-built-in) firm conflict fires; a soft one does not", () => {
    const st = stateWith(["test-light", "test-burnout"]);
    const items = compileTimeline(st, 0, [sunlightPack, officialNoIntense]);
    // morning-sunlight is NOT a built-in conflict target — only this
    // authored record can mute it, and only when severity is "firm".
    const firm: Interaction[] = [
      {
        aKey: "no-intense",
        bKey: "morning-sunlight",
        type: "conflict",
        severity: "firm",
        nudge: "x",
      },
    ];
    const soft: Interaction[] = [{ ...firm[0], severity: "soft" }];
    expect(isMuted(applyConflictMutes(items, firm), "morning-sunlight")).toBe(
      true
    );
    expect(isMuted(applyConflictMutes(items, soft), "morning-sunlight")).toBe(
      false
    );
  });

  it("the curated-only whitelist holds inside applyConflictMutes", () => {
    const st = stateWith(["test-strength", "user-rest"]);
    const items = compileTimeline(st, 0, [strengthPack, customNoIntense]);
    expect(
      isMuted(applyConflictMutes(items, BUILTIN_INTERACTIONS), "strength")
    ).toBe(false);
  });
});

// ── Phase 3: a published bundle's interactions reach the engine ────────
describe("published bundle interactions reach the engine (end-to-end)", () => {
  afterEach(() => resetKnowledge());

  it("a published firm-conflict interaction takes effect with no code change", () => {
    const applied = applyPublishedBundle({
      ...builtinBundle(),
      version: 1,
      interactions: [
        {
          aKey: "no-intense",
          bKey: "morning-sunlight",
          type: "conflict",
          severity: "firm",
          nudge: "rest",
        },
      ],
    });
    expect(applied).toBe(true);
    // The engine unions the built-in pairs with the published one…
    expect(
      resolvedInteractions().some(
        (i) => i.aKey === "no-intense" && i.bKey === "morning-sunlight"
      )
    ).toBe(true);
    // …and it fires through the real shape path — no code deploy needed.
    const st = stateWith(["test-light", "test-burnout"]);
    const items = compileTimeline(st, 0, [sunlightPack, officialNoIntense]);
    const shaped = shapeTimeline(items, "normal", {});
    expect(isMuted(shaped, "morning-sunlight")).toBe(true);
  });
});
