/**
 * Regression: recovery mode must not resurrect demoted training.
 *
 * shapeTimeline's recovery branch mutes every RECOVERY_DEMOTE behavior, then
 * calls guaranteePerBlock — which un-mutes the top item of any all-muted block.
 * Without a recovery-aware filter, a block holding ONLY demoted training (e.g.
 * an afternoon that is just `strength` on a single-workout day) had strength
 * resurrected as a normal todo, directly contradicting the recovery headline
 * ("the demanding work is set aside"). The fix passes guaranteePerBlock an
 * `eligible` predicate so it can only fill with a NON-demoted item.
 */
import { describe, it, expect } from "vitest";
import { shapeTimeline, type TimelineItem } from "@/lib/engine";
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

describe("recovery mode: an only-demoted-training block stays quiet", () => {
  it("strength alone in the afternoon stays MUTED (not resurrected by guaranteePerBlock)", () => {
    const shaped = shapeTimeline([item("strength", "afternoon")], "recovery", {});
    const strength = shaped.find((i) => i.canonicalKey === "strength");
    expect(strength).toBeTruthy();
    // The recovery contract: the demanding work is set aside — strength must
    // not come back as a normal todo just because it's the only afternoon item.
    expect(strength!.muted).toBe(true);
  });

  it("a whole afternoon of demoted training stays muted; a non-demoted item stays visible", () => {
    const shaped = shapeTimeline(
      [
        item("strength", "afternoon"),
        item("zone2", "afternoon"),
        item("vo2max-intervals", "afternoon"),
        item("morning-sunlight", "morning"), // not RECOVERY_DEMOTE
      ],
      "recovery",
      {}
    );
    const byKey = Object.fromEntries(shaped.map((i) => [i.canonicalKey, i]));
    expect(byKey["strength"].muted).toBe(true);
    expect(byKey["zone2"].muted).toBe(true);
    expect(byKey["vo2max-intervals"].muted).toBe(true);
    // A non-training behavior is never demoted and stays a normal todo.
    expect(byKey["morning-sunlight"].muted).toBe(false);
  });
});
