/**
 * workouts.ts — workout detection + swap-menu source.
 * Regression for audit 2026-06-09: a published CMS bundle can serve a workout
 * behavior WITHOUT the `category:"workout"` tag, which silently removed the
 * swap affordance. isWorkoutBehavior must also recognize the curated workout
 * keys so swap survives a bundle that dropped the tag.
 */
import { describe, it, expect } from "vitest";
import { isWorkoutBehavior, availableWorkoutAlternatives } from "@/lib/workouts";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

describe("isWorkoutBehavior — tag + curated-key fallback", () => {
  it("matches the explicit category tag", () => {
    expect(
      isWorkoutBehavior({ category: "workout", canonicalKey: "anything" })
    ).toBe(true);
  });

  it("matches a known workout key even when category is missing (bundle drop)", () => {
    expect(isWorkoutBehavior({ canonicalKey: "zone2" })).toBe(true);
    expect(isWorkoutBehavior({ canonicalKey: "strength" })).toBe(true);
    expect(isWorkoutBehavior({ canonicalKey: "vo2max-intervals" })).toBe(true);
  });

  it("matches a fork/atom-library pick via derivedFrom", () => {
    expect(
      isWorkoutBehavior({
        canonicalKey: "fork:abc:strength",
        derivedFrom: "strength",
      })
    ).toBe(true);
  });

  it("does NOT match a non-workout behavior", () => {
    expect(isWorkoutBehavior({ canonicalKey: "morning-sunlight" })).toBe(false);
    expect(isWorkoutBehavior({ canonicalKey: "protein-breakfast" })).toBe(false);
    expect(isWorkoutBehavior({})).toBe(false);
  });
});

describe("availableWorkoutAlternatives — swap menu source", () => {
  it("includes the curated workouts for a default install", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const alts = availableWorkoutAlternatives(st).map((b) => b.canonicalKey);
    expect(alts).toContain("zone2");
    expect(alts).toContain("strength");
    expect(alts.length).toBeGreaterThanOrEqual(2);
  });
});
