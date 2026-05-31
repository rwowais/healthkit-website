/**
 * "Your next habit" — nextBestAddition recommender.
 *
 * The growth counterpart to suggestions() (friction). Property-based so it
 * stays green as the catalog evolves: we assert the CONTRACT, not which exact
 * atom wins today.
 */
import { describe, it, expect } from "vitest";
import { nextBestAddition } from "@/lib/intel";
import { getDefaultState } from "@/lib/storage";
import { listBehaviorAtoms, packById } from "@/lib/packs";
import { isSupplementBehavior } from "@/lib/supplements";
import type { AppState } from "@/lib/types";

const ek = (b: { canonicalKey: string; derivedFrom?: string }) =>
  b.derivedFrom ?? b.canonicalKey;

// A minimal one-pack system, so plenty of high-leverage atoms remain missing.
const oneePack = (): AppState => ({
  ...getDefaultState(),
  installedPacks: ["longevity-foundation"],
});

describe("nextBestAddition — recommends a missing high-leverage behavior", () => {
  it("returns a genuinely high-leverage (>=2) recommendation for a sparse system", () => {
    const rec = nextBestAddition(oneePack());
    expect(rec).toBeTruthy();
    expect(rec!.leverage).toBeGreaterThanOrEqual(2);
    expect(rec!.title.length).toBeGreaterThan(0);
  });

  it("recommends a CURATED behavior — an action, never a supplement or a custom atom", () => {
    const rec = nextBestAddition(oneePack())!;
    const atom = listBehaviorAtoms().find((a) => a.canonicalKey === rec.key);
    expect(atom).toBeTruthy(); // it's in the curated catalog
    expect(rec.key.startsWith("custom:")).toBe(false);
    expect(isSupplementBehavior(atom!)).toBe(false);
    expect(atom!.kind).not.toBe("avoid");
    expect(atom!.kind).not.toBe("reminder");
  });

  it("never recommends something already in the user's system", () => {
    const state = oneePack();
    const have = new Set(
      (packById("longevity-foundation")?.behaviors ?? []).map(ek)
    );
    const rec = nextBestAddition(state)!;
    expect(have.has(rec.key)).toBe(false);
  });

  it("picks the highest available leverage (leverage dominates the ranking)", () => {
    const state = oneePack();
    const have = new Set(
      (packById("longevity-foundation")?.behaviors ?? []).map(ek)
    );
    const eligible = listBehaviorAtoms().filter(
      (a) =>
        !have.has(ek(a)) &&
        !isSupplementBehavior(a) &&
        a.kind !== "avoid" &&
        a.kind !== "reminder" &&
        (a.leverage ?? 1) >= 2
    );
    const maxLev = Math.max(...eligible.map((a) => a.leverage ?? 1));
    expect(nextBestAddition(state)!.leverage).toBe(maxLev);
  });

  it("is deterministic", () => {
    const state = oneePack();
    expect(nextBestAddition(state)?.key).toBe(nextBestAddition(state)?.key);
  });

  it("honors safety flags — never recommends a contraindicated atom", () => {
    // Derive a real flag from the catalog so the test can't drift.
    const flaggedAtom = listBehaviorAtoms().find(
      (a) => (a.contraindications?.length ?? 0) > 0
    );
    expect(flaggedAtom).toBeTruthy();
    const flag = flaggedAtom!.contraindications![0];
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, safetyFlags: { [flag]: true } },
    };
    const rec = nextBestAddition(state);
    if (rec) {
      const atom = listBehaviorAtoms().find((a) => a.canonicalKey === rec.key)!;
      expect(atom.contraindications?.includes(flag) ?? false).toBe(false);
    }
  });
});
