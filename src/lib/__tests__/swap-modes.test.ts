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
  conflictBlockedKeys,
  type TimelineItem,
  type AdaptMode,
} from "@/lib/engine";
import { availableWorkoutAlternatives } from "@/lib/workouts";
import { getDefaultState } from "@/lib/storage";
import type { AppState, TimeBlock } from "@/lib/types";

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

  // Audit round 2 secondary holes — each was probe-proven by the fix-breaker.
  describe("round-2 holes", () => {
    it("two same-day swaps to the SAME replacement inject it exactly once", () => {
      const items = [
        item("zone2", "afternoon", 3),
        item("vo2max-intervals", "afternoon", 3),
      ];
      const out = applySwaps(items, {
        swaps: { zone2: "strength", "vo2max-intervals": "strength" },
      });
      const strengths = out.filter((i) => i.canonicalKey === "strength");
      expect(strengths).toHaveLength(1);
      // Both originals are still marked swapped-away.
      expect(out.find((i) => i.canonicalKey === "zone2")?.swappedTo).toBe("strength");
      expect(
        out.find((i) => i.canonicalKey === "vo2max-intervals")?.swappedTo
      ).toBe("strength");
    });

    it("the swapped-away original keeps its 'swapped for …' provenance in every mode", () => {
      for (const mode of MODES) {
        const shaped = shapeTimeline(
          applySwaps(base(), { swaps: { zone2: "strength" } }),
          mode,
          {}
        );
        const orig = shaped.find((i) => i.canonicalKey === "zone2");
        expect(orig?.muted).toBe(true);
        expect(orig?.muteReason).toBe("swapped for strength");
      }
    });

    it("guaranteePerBlock does not count a doomed swapped-away original as alive", () => {
      // Afternoon holds the swapped-away original (lighter un-mutes it by
      // leverage pre-pass) + another low-leverage item muted by the trim. The
      // liveness check must see the original as doomed and resurrect the
      // other item, so the block isn't visibly empty after the final pass.
      const items = [
        item("zone2", "afternoon", 3), // will be swapped away → doomed
        item("fiber-veg", "afternoon", 1), // lighter mutes leverage-1
      ];
      // Swap to a MORNING-block replacement so the afternoon loses its live row.
      const swapped = applySwaps(items, { swaps: { zone2: "morning-sunlight" } });
      const shaped = shapeTimeline(swapped, "lighter", {});
      const afternoonLive = shaped.filter(
        (i) => i.block === "afternoon" && !i.muted
      );
      expect(afternoonLive.length).toBeGreaterThanOrEqual(1);
      expect(afternoonLive.some((i) => i.canonicalKey === "fiber-veg")).toBe(true);
    });

    it("the swap sheet never offers a restraint-blocked replacement", () => {
      // Burnout-recovery's "no intense training" restraint firm-conflict-mutes
      // strength. Offering it as a swap target auto-completed the swap and
      // then hid the replacement in the collapsed Resting group — a silent
      // dead-end on the sheet's own recommendation.
      const state: AppState = {
        ...getDefaultState(),
        installedPacks: ["longevity-foundation", "burnout-recovery"],
      };
      const candidates = availableWorkoutAlternatives(state);
      expect(candidates.some((c) => c.canonicalKey === "strength")).toBe(true);
      const blocked = conflictBlockedKeys(state, 0, candidates);
      expect(blocked.has("strength")).toBe(true);
      // A gentle option stays offerable.
      expect(blocked.has("extended-walk")).toBe(false);
    });
  });
});
