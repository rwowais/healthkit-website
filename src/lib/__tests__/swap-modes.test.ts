/**
 * Regression (sweep 2026-06-09, HIGH #5 + #6): a per-day workout swap must
 * survive every adaptation mode.
 *
 * applySwaps runs BEFORE shapeTimeline and injects the chosen replacement
 * (muted:false + swappedFrom) while muting the swapped-away original
 * (muted:true + swappedTo). But each mode branch (recovery/essentials/
 * lighter/rebuild) rebuilt `muted` from scratch with no swap awareness, so:
 *   #5 the chosen replacement silently vanished (recovery demoted it /
 *      essentials+rebuild trimmed it by leverage) and scored 0; and
 *   #6 the swapped-away original RESURRECTED as an active, un-completable
 *      to-do (lighter/essentials un-mute by leverage), blocking "day complete".
 *
 * The fix re-asserts swap state as shapeTimeline's final word: swappedTo stays
 * muted always; swappedFrom is un-muted unless a genuine safety conflict-mute
 * applies. These tests drive the REAL applySwaps → shapeTimeline chain.
 */
import { describe, it, expect } from "vitest";
import {
  shapeTimeline,
  applySwaps,
  type TimelineItem,
  type AdaptMode,
} from "@/lib/engine";
import type { TimeBlock } from "@/lib/types";

const item = (key: string, block: TimeBlock, leverage = 3): TimelineItem =>
  ({
    canonicalKey: key,
    title: key,
    block,
    anchor: "wake",
    offsetMin: 0,
    rationale: "",
    icon: "check",
    leverage,
    kind: "action",
    recommendedBlock: block,
    retimed: false,
    blockPinned: false,
    trustTier: "curated",
    fromPacks: [],
    muted: false,
  }) as TimelineItem;

const base = (): TimelineItem[] => [
  item("zone2", "afternoon", 3),
  item("morning-sunlight", "morning", 2),
];

const MODES: AdaptMode[] = [
  "normal",
  "recovery",
  "essentials",
  "lighter",
  "rebuild",
];

describe("workout swap survives every adaptation mode (HIGH #5/#6)", () => {
  // zone2 -> strength: strength is RECOVERY_DEMOTE, the case that vanished in
  // recovery mode; both are real curated keys resolvable by applySwaps.
  describe("swap zone2 → strength (a still-demanding replacement)", () => {
    for (const mode of MODES) {
      it(`mode=${mode}: replacement visible, original hidden`, () => {
        const shaped = shapeTimeline(
          applySwaps(base(), { swaps: { zone2: "strength" } }),
          mode,
          {}
        );
        const byKey = Object.fromEntries(shaped.map((i) => [i.canonicalKey, i]));
        // The swapped-away original must never resurrect.
        expect(byKey["zone2"]?.swappedTo).toBe("strength");
        expect(byKey["zone2"]?.muted).toBe(true);
        // The chosen replacement must stay visible (and thus score).
        expect(byKey["strength"]?.swappedFrom).toBe("zone2");
        expect(byKey["strength"]?.muted).toBe(false);
      });
    }
  });

  // zone2 -> extended-walk: a LOW-leverage replacement, the case that vanished
  // under essentials/rebuild (leverage trim) and that drives easierDayFromSwap.
  describe("swap zone2 → extended-walk (a lighter replacement)", () => {
    for (const mode of MODES) {
      it(`mode=${mode}: replacement visible, original hidden`, () => {
        const shaped = shapeTimeline(
          applySwaps(base(), { swaps: { zone2: "extended-walk" } }),
          mode,
          {}
        );
        const byKey = Object.fromEntries(shaped.map((i) => [i.canonicalKey, i]));
        expect(byKey["zone2"]?.swappedTo).toBe("extended-walk");
        expect(byKey["zone2"]?.muted).toBe(true);
        expect(byKey["extended-walk"]?.swappedFrom).toBe("zone2");
        expect(byKey["extended-walk"]?.muted).toBe(false);
      });
    }
  });
});
