/**
 * invariants.test.ts — exercises the invariant suite against well-
 * known states (default, vacation, premium, free-trial-expired,
 * with-swaps) so regressions in the rules themselves are caught
 * before they leak into persona tests.
 */
import { describe, it, expect } from "vitest";
import { getDefaultState, setVacationMode, swapBehavior } from "@/lib/storage";
import { checkInvariants, ALL_INVARIANTS } from "./invariants";
import type { AppState } from "@/lib/types";

describe("invariant suite — sanity on known states", () => {
  it("registry is non-empty and each invariant has a name + check fn", () => {
    expect(ALL_INVARIANTS.length).toBeGreaterThan(0);
    for (const inv of ALL_INVARIANTS) {
      expect(inv.name).toBeTruthy();
      expect(typeof inv.check).toBe("function");
    }
  });

  it("default state passes every invariant", () => {
    const s = getDefaultState();
    const violations = checkInvariants(s);
    expect(violations).toEqual([]);
  });

  it("vacation-mode state passes every invariant", () => {
    let s = getDefaultState();
    s = setVacationMode(s, true);
    const violations = checkInvariants(s);
    expect(violations).toEqual([]);
  });

  it("post-vacation state passes (mode flip on then off)", () => {
    let s = getDefaultState();
    s = setVacationMode(s, true);
    s = setVacationMode(s, false);
    const violations = checkInvariants(s);
    expect(violations).toEqual([]);
  });

  it("state with a workout swap passes", () => {
    let s = getDefaultState();
    const today = new Date().toISOString().slice(0, 10);
    s = swapBehavior(s, today, "strength", "extended-walk");
    const violations = checkInvariants(s);
    expect(violations).toEqual([]);
  });

  it("a state crafted to BREAK an invariant surfaces it", () => {
    // Build a free-tier state with 4 official packs installed —
    // this should violate inv_free_tier_caps_held when we go around
    // the storage gate (we mutate state directly).
    const s: AppState = {
      ...getDefaultState(),
      installedPacks: [
        "longevity-foundation",
        "better-sleep",
        "heart-health",
        "blood-sugar",
      ],
    };
    const violations = checkInvariants(s);
    expect(
      violations.some((v) =>
        /free-tier caps never exceeded/.test(v)
      )
    ).toBe(true);
  });
});
