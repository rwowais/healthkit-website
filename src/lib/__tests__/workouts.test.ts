/**
 * workouts.ts — workout detection + swap-menu source.
 * Regression for audit 2026-06-09: a published CMS bundle can serve a workout
 * behavior WITHOUT the `category:"workout"` tag, which silently removed the
 * swap affordance. isWorkoutBehavior must also recognize the curated workout
 * keys so swap survives a bundle that dropped the tag.
 */
import { describe, it, expect } from "vitest";
import {
  isWorkoutBehavior,
  availableWorkoutAlternatives,
  resolveBehaviorByKey,
} from "@/lib/workouts";
import { getDefaultState, duplicatePack, swapBehavior } from "@/lib/storage";
import { getTz, dateKeyInTz } from "@/lib/tz";
import type { AppState, ProtocolPack } from "@/lib/types";

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

describe("forked/custom workouts in the swap flow (audit round 2, HIGH)", () => {
  const SRC = {
    id: "longevity-foundation",
    name: "Longevity Foundation",
    tagline: "",
    goal: "longevity",
    accent: "var(--readiness)",
    icon: "sparkle",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      {
        canonicalKey: "strength",
        title: "Strength training",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        rationale: "",
        icon: "dumbbell",
        leverage: 3,
        kind: "action",
        category: "workout",
      },
    ],
  } as unknown as ProtocolPack;
  const forked = (): AppState =>
    duplicatePack(
      { ...getDefaultState(), installedPacks: ["longevity-foundation"] },
      SRC
    );

  it("resolveBehaviorByKey resolves a fork-namespaced key via customPacks", () => {
    const st = forked();
    const forkKey = st.customPacks[0].behaviors[0].canonicalKey;
    expect(forkKey.startsWith("fork:")).toBe(true);
    expect(resolveBehaviorByKey(forkKey)).toBeNull(); // catalog alone: never
    expect(resolveBehaviorByKey(forkKey, st.customPacks)?.title).toBe(
      "Strength training"
    );
  });

  it("the swap sheet offers the user's own custom-pack workouts", () => {
    const st = forked();
    const forkKey = st.customPacks[0].behaviors[0].canonicalKey;
    const alts = availableWorkoutAlternatives(st).map((b) => b.canonicalKey);
    expect(alts).toContain(forkKey);
  });

  it("swapBehavior records a swap FROM a forked workout (was a silent no-op)", () => {
    const st = forked();
    const forkKey = st.customPacks[0].behaviors[0].canonicalKey;
    const today = dateKeyInTz(getTz(st.settings));
    const after = swapBehavior(st, today, forkKey, "extended-walk");
    expect(after).not.toBe(st); // not the identical-state silent no-op
    const log = after.dailyLogs.find((l) => l.date === today);
    expect(log?.swaps?.[forkKey]).toBe("extended-walk");
    expect(log?.behaviorCompletions?.["extended-walk"]).toBe(true);
  });
});
