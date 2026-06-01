/**
 * Per-day plan helpers: one-off injection + snoozes. Pure, applied on Today
 * after shapeTimeline.
 */
import { describe, it, expect } from "vitest";
import { injectOneOffs, applySnoozes, type TimelineItem } from "@/lib/engine";
import { getDefaultState, addOneOff, toggleBehavior } from "@/lib/storage";
import { dateKeyInTz } from "@/lib/tz";
import type { AppState, TimeBlock } from "@/lib/types";

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

  it("'later' relocates to evening with a bed-anchored time", () => {
    const out = applySnoozes([item("a", "morning")], { snoozes: { a: "later" } });
    const a = out.find((i) => i.canonicalKey === "a")!;
    expect(a.block).toBe("evening");
    expect(a.anchor).toBe("bed");
    expect(a.offsetMin).toBe(-120);
  });
});

describe("injectOneOffs — representative block times", () => {
  it("gives a one-off a sensible clock time for its block ('anytime' stays untimed)", () => {
    const ev = injectOneOffs([], { oneOffs: [{ key: "x", title: "X", block: "evening" }] });
    expect(ev[0].customTime).toBe("19:00");
    const am = injectOneOffs([], { oneOffs: [{ key: "y", title: "Y", block: "morning" }] });
    expect(am[0].customTime).toBe("08:00");
    const any = injectOneOffs([], { oneOffs: [{ key: "z", title: "Z", block: "anytime" }] });
    expect(any[0].customTime).toBeUndefined();
  });
});

describe("computeBehaviorScore reconciles with the rendered timeline", () => {
  it("counts a completed one-off in the day's stored score (regression: was 0)", () => {
    const base = getDefaultState();
    let s: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, timezone: "UTC" },
    };
    const today = dateKeyInTz("UTC");
    s = addOneOff(s, today, { key: "oneoff:sauna-x", title: "Sauna", block: "evening" });
    s = toggleBehavior(s, today, "oneoff:sauna-x");
    const log = s.dailyLogs.find((l) => l.date === today)!;
    // Pre-fix the one-off was excluded from the scored set, so completing only
    // it stored score 0. Now it's part of the active set → score reflects it.
    expect(log.score).toBeGreaterThan(0);
  });
});
