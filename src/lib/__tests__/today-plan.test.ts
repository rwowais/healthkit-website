/**
 * Per-day plan helpers: one-off injection + snoozes. Pure, applied on Today
 * after shapeTimeline.
 */
import { describe, it, expect } from "vitest";
import { injectOneOffs, applySnoozes, type TimelineItem } from "@/lib/engine";
import type { TimeBlock } from "@/lib/types";

const item = (key: string, block: TimeBlock): TimelineItem =>
  ({
    canonicalKey: key,
    title: key,
    block,
    anchor: "wake",
    offsetMin: 0,
    rationale: "",
    icon: "check",
    leverage: 1,
    kind: "action",
    recommendedBlock: block,
    retimed: false,
    blockPinned: false,
    trustTier: "curated",
    fromPacks: [],
    muted: false,
  }) as TimelineItem;

describe("injectOneOffs", () => {
  it("adds a one-off that isn't already present, flagged oneOff", () => {
    const out = injectOneOffs([item("a", "morning")], {
      oneOffs: [{ key: "sauna", title: "Sauna", block: "evening" }],
    });
    const sauna = out.find((i) => i.canonicalKey === "sauna");
    expect(sauna).toBeTruthy();
    expect(sauna!.oneOff).toBe(true);
    expect(sauna!.block).toBe("evening");
  });
  it("skips a one-off whose key is already in the timeline", () => {
    const out = injectOneOffs([item("sauna", "evening")], {
      oneOffs: [{ key: "sauna", title: "Sauna", block: "evening" }],
    });
    expect(out.filter((i) => i.canonicalKey === "sauna").length).toBe(1);
  });
});

describe("applySnoozes", () => {
  it("hides a 'tomorrow' behavior from today", () => {
    const out = applySnoozes([item("a", "morning"), item("b", "morning")], {
      snoozes: { a: "tomorrow" },
    });
    expect(out.map((i) => i.canonicalKey)).toEqual(["b"]);
  });
  it("moves a 'later' behavior to the evening block", () => {
    const out = applySnoozes([item("a", "morning")], {
      snoozes: { a: "later" },
    });
    expect(out.find((i) => i.canonicalKey === "a")?.block).toBe("evening");
  });
  it("is a no-op without snoozes", () => {
    const items = [item("a", "morning")];
    expect(applySnoozes(items, {})).toBe(items);
  });
});
