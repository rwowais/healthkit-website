/**
 * Vacation mode must produce a truly empty Today — even for a user whose
 * current day's log carries a workout swap.
 *
 * Regression: compileTimeline returns [] under vacation, but applySwaps()
 * (run after it on Today) injected the swap's *replacement* behavior as a new
 * row when it wasn't already present. On an emptied (vacation) timeline that
 * re-populated the day with a lone behavior, so the calm "you're on a break"
 * surface never appeared. A swap is meaningless with no base timeline.
 */
import { describe, it, expect } from "vitest";
import { compileTimeline, applySwaps } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

describe("applySwaps — never introduces a behavior into an empty timeline", () => {
  it("returns empty for empty items, even with a swap recorded", () => {
    expect(applySwaps([], { swaps: { zone2: "strength" } })).toEqual([]);
  });
});

describe("vacation mode stays empty even with a recorded swap", () => {
  it("compileTimeline + applySwaps yields no items under vacation", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, vacationMode: true },
    };
    const items = compileTimeline(state, 6);
    expect(items).toEqual([]);
    expect(applySwaps(items, { swaps: { zone2: "strength" } })).toEqual([]);
  });
});
