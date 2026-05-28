/**
 * A custom behavior authored with an exact clock time must sort to that
 * time on Today. Regression guard for two bugs found together:
 *   1) the custom-behavior builder didn't capture a time at all
 *      (it saved offsetMin:0 → everything piled at wake time), and
 *   2) compileTimeline's merge set `customTime: ov?.customTime`, which
 *      silently DROPPED a behavior's own baked customTime when there was
 *      no user override — so even a correctly-authored time fell back to
 *      anchor math and mis-sorted.
 * This test pins the engine half (the durable contract): a baked
 * customTime survives compileTimeline and resolves via effectiveMinutes.
 */
import { describe, it, expect } from "vitest";
import { compileTimeline } from "@/lib/engine";
import { effectiveMinutes } from "@/lib/time";
import { getDefaultState } from "@/lib/storage";
import type { AppState, ProtocolPack } from "@/lib/types";

function stateWithCustomTimed(customTime: string): AppState {
  const base = getDefaultState();
  const pack: ProtocolPack = {
    id: "custom:test",
    name: "Test Pack",
    tagline: "",
    goal: "longevity",
    accent: "var(--readiness)",
    icon: "sparkle",
    source: "custom",
    behaviors: [
      {
        canonicalKey: "custom:test:meditate",
        title: "Midday meditation",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360, // anchor math would resolve to ~12:30 (wake+6h)
        customTime, // …but the baked clock time must win
        dose: "10 min",
        rationale: "Custom behavior.",
        icon: "sparkle",
        leverage: 2,
        kind: "action",
      },
    ],
  };
  return {
    ...base,
    installedPacks: ["custom:test"],
    customPacks: [pack],
  };
}

describe("custom behavior clock time", () => {
  it("compileTimeline preserves a behavior's baked customTime", () => {
    const state = stateWithCustomTimed("11:29");
    const item = compileTimeline(state, 0).find(
      (i) => i.canonicalKey === "custom:test:meditate"
    );
    expect(item).toBeTruthy();
    expect(item!.customTime).toBe("11:29");
    // effectiveMinutes must use the baked time (11:29 = 689), NOT the
    // anchor+offset math (which would land ~12:30).
    expect(effectiveMinutes(item!, state.settings)).toBe(11 * 60 + 29);
  });

  it("a baked customTime overrides the anchor+offset fallback", () => {
    const state = stateWithCustomTimed("07:05");
    const item = compileTimeline(state, 0).find(
      (i) => i.canonicalKey === "custom:test:meditate"
    )!;
    expect(effectiveMinutes(item, state.settings)).toBe(7 * 60 + 5);
  });
});
