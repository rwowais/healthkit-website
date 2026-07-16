/**
 * Advisory placement evaluator (ontology engine, 2026-07-12).
 * Contract: PURE and read-only — describes what fights a recommended window
 * or dependency; never mutes, moves, or blocks. Notes appear only on actual
 * violations and disappear when the user fixes the placement.
 */
import { describe, it, expect } from "vitest";
import type { TimeBlock, UserSettings, Interaction } from "@/lib/types";
import {
  evaluatePlacements,
  compileTimeline,
  ADVISORY_INTERACTIONS,
  BUILTIN_INTERACTIONS,
  applyConflictMutes,
  type TimelineItem,
} from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";

const settings = {
  ...getDefaultState().settings,
  wakeTime: "07:00",
  bedtime: "22:30",
} as UserSettings;

function ti(
  key: string,
  block: TimeBlock,
  title: string,
  over: Partial<TimelineItem> = {}
): TimelineItem {
  return {
    canonicalKey: key,
    title,
    block,
    anchor: "wake",
    offsetMin: 0,
    rationale: "",
    icon: "check",
    leverage: 1,
    kind: "action",
    fromPacks: [],
    muted: false,
    recommendedBlock: block,
    retimed: false,
    blockPinned: false,
    trustTier: "curated",
    ...over,
  };
}

describe("evaluatePlacements — timing (gapHours)", () => {
  const rule: Interaction = {
    aKey: "strength",
    bKey: "cold-plunge-am",
    type: "timing",
    severity: "soft",
    gapHours: 6,
    direction: "a_to_b",
    nudge: "Cold within ~6h after lifting can blunt strength adaptations.",
  };

  it("fires when B follows A inside the gap", () => {
    const items = [
      ti("strength", "afternoon", "Strength", { offsetMin: 300 }), // 12:00
      ti("cold-plunge-am", "afternoon", "Cold plunge", { offsetMin: 420 }), // 14:00
    ];
    const notes = evaluatePlacements(items, [rule], settings, 0);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain("blunt");
  });

  it("stays quiet when B comes BEFORE A (a_to_b direction)", () => {
    const items = [
      ti("cold-plunge-am", "morning", "Cold plunge", { offsetMin: 30 }), // 07:30
      ti("strength", "afternoon", "Strength", { offsetMin: 540 }), // 16:00
    ];
    expect(evaluatePlacements(items, [rule], settings, 0)).toHaveLength(0);
  });

  it("stays quiet when the gap is respected", () => {
    const items = [
      ti("strength", "morning", "Strength", { offsetMin: 120 }), // 09:00
      ti("cold-plunge-am", "evening", "Cold plunge", { offsetMin: 600 }), // 17:00 (8h)
    ];
    expect(evaluatePlacements(items, [rule], settings, 0)).toHaveLength(0);
  });

  it("mutual direction fires in either order", () => {
    const mutual: Interaction = { ...rule, direction: "mutual", gapHours: 2 };
    const items = [
      ti("cold-plunge-am", "morning", "Cold", { offsetMin: 60 }),
      ti("strength", "morning", "Strength", { offsetMin: 120 }), // 1h later
    ];
    expect(evaluatePlacements(items, [mutual], settings, 0)).toHaveLength(1);
  });
});

describe("evaluatePlacements — ordering", () => {
  const rule = ADVISORY_INTERACTIONS.find(
    (r) => r.type === "ordering" && r.aKey === "strength"
  )!;

  it("fires only when the order is violated (zone2 before strength)", () => {
    const bad = [
      ti("zone2", "morning", "Zone 2", { offsetMin: 150 }),
      ti("strength", "afternoon", "Strength", { offsetMin: 300 }),
    ];
    const good = [
      ti("strength", "morning", "Strength", { offsetMin: 150 }),
      ti("zone2", "afternoon", "Zone 2", { offsetMin: 300 }),
    ];
    expect(evaluatePlacements(bad, [rule], settings, 0)).toHaveLength(1);
    expect(evaluatePlacements(good, [rule], settings, 0)).toHaveLength(0);
  });

  it("skips a rule carrying a condition (no runtime gate context yet)", () => {
    const gated: Interaction = { ...rule, condition: { goal: "muscle" } };
    const bad = [
      ti("zone2", "morning", "Zone 2", { offsetMin: 150 }),
      ti("strength", "afternoon", "Strength", { offsetMin: 300 }),
    ];
    expect(evaluatePlacements(bad, [gated], settings, 0)).toHaveLength(0);
  });

  it("ignores muted and not-scheduled-today items", () => {
    const items = [
      ti("zone2", "morning", "Zone 2", { offsetMin: 150, muted: true }),
      ti("strength", "afternoon", "Strength", { offsetMin: 300 }),
    ];
    expect(evaluatePlacements(items, [rule], settings, 0)).toHaveLength(0);
    const offDay = [
      ti("zone2", "morning", "Zone 2", {
        offsetMin: 150,
        daysActive: [false, true, true, true, true, true, true], // off Monday
      }),
      ti("strength", "afternoon", "Strength", { offsetMin: 300 }),
    ];
    expect(evaluatePlacements(offDay, [rule], settings, 0)).toHaveLength(0);
  });
});

describe("evaluatePlacements — soft-window drift (via compileTimeline)", () => {
  it("magnesium moved to 9am gets a window note; default placement is quiet", () => {
    const inWindow = [
      ti("magnesium-pm", "evening", "Magnesium", {
        anchor: "bed",
        offsetMin: -45,
        timeWindow: { min: -180, max: 0 },
        timingOff: false,
      }),
    ];
    expect(evaluatePlacements(inWindow, [], settings, 0)).toHaveLength(0);
    const moved = [
      ti("magnesium-pm", "morning", "Magnesium", {
        anchor: "bed",
        offsetMin: -45,
        customTime: "09:00",
        timeWindow: { min: -180, max: 0 },
        timingOff: true, // compileTimeline stamps this for soft windows
      }),
    ];
    const notes = evaluatePlacements(moved, [], settings, 0);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toMatch(/usual window/i);
  });

  it("compileTimeline stamps timingOff on a soft-window catalog atom moved off-window (cold plunge at 21:30)", () => {
    const st = {
      ...getDefaultState(),
      installedPacks: ["cold-heat-therapy"],
      behaviorOverrides: {
        "cold-plunge-am": { customTime: "21:30" }, // wake+870 > soft max 600
      },
      settings,
    };
    const tl = compileTimeline(st, 0);
    const cold = tl.find((i) => i.canonicalKey === "cold-plunge-am")!;
    expect(cold.timeWindow?.strict).toBeFalsy();
    expect(cold.timingOff).toBe(true);
    const notes = evaluatePlacements(tl, [], st.settings, 0);
    expect(notes.some((n) => n.keys.includes("cold-plunge-am"))).toBe(true);
  });
});

describe("advisory rules never harden", () => {
  it("ADVISORY_INTERACTIONS are all soft and applyConflictMutes ignores them", () => {
    expect(ADVISORY_INTERACTIONS.every((r) => r.severity === "soft")).toBe(
      true
    );
    const items = [
      ti("strength", "morning", "Strength", { offsetMin: 120 }),
      ti("zone2", "morning", "Zone 2", { offsetMin: 60 }), // violated order
    ];
    const out = applyConflictMutes(items, BUILTIN_INTERACTIONS);
    expect(out.every((i) => !i.muted)).toBe(true); // advice, never a mute
  });
});
