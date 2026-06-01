/**
 * Regression tests for the overnight QA round-1 fixes.
 */
import { describe, it, expect } from "vitest";
import type { AppState, TimeBlock } from "@/lib/types";
import { getDefaultState } from "@/lib/storage";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";
import { applyStacks, type TimelineItem } from "@/lib/engine";
import { effectiveMinutes } from "@/lib/time";
import { experimentReadout, goalProgress } from "@/lib/goals";
import { parseQuickLog } from "@/lib/quicklog";
import { freezeStatus } from "@/lib/scoring";
import { mergeStates } from "@/lib/datasource";

const BASE = getDefaultState();
const TODAY = dateKeyInTz(getTz(BASE.settings));
const d = (off: number) => addDaysToKey(TODAY, off);

function ti(
  key: string,
  block: TimeBlock,
  customTime: string,
  title: string
): TimelineItem {
  return {
    canonicalKey: key,
    title,
    block,
    anchor: "wake",
    offsetMin: 0,
    customTime,
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
  };
}

describe("F4: stacked follower inherits the anchor's clock time", () => {
  it("a cross-block follower adopts the anchor block AND time (no contradiction)", () => {
    const A = ti("a", "morning", "08:00", "Sunlight");
    const B = ti("b", "evening", "21:00", "Pushups");
    const out = applyStacks([A, B], { b: { stackAfter: "a" } });
    const follower = out.find((x) => x.canonicalKey === "b")!;
    expect(follower.block).toBe("morning");
    expect(effectiveMinutes(follower, BASE.settings)).toBe(
      effectiveMinutes(A, BASE.settings)
    ); // 8:00, not its old 21:00
    expect(follower.stackedAfter).toBe("Sunlight");
  });

  it("F6: a follower snoozed 'later' is NOT dragged back to the anchor block", () => {
    const A = ti("a", "morning", "08:00", "Sunlight");
    const B = ti("b", "evening", "21:00", "Pushups");
    const out = applyStacks([A, B], { b: { stackAfter: "a" } }, { b: "later" });
    const follower = out.find((x) => x.canonicalKey === "b")!;
    expect(follower.block).toBe("evening"); // snooze placement preserved
    expect(follower.stackedAfter).toBeUndefined();
  });
});

describe("F1: experimentReadout.daysLeft is correct across a month boundary", () => {
  it("counts real calendar days, not month-shifted ones", () => {
    const ro = experimentReadout(BASE, {
      id: "e",
      hypothesis: "x",
      metric: "energy",
      startDate: d(0),
      endDate: d(40), // always crosses ≥1 month boundary
      baselineDays: 7,
      createdAt: "x",
    });
    expect(ro.daysLeft).toBe(40);
  });
});

describe("F7: freezeStatus dedupes duplicate freeze dates", () => {
  it("a date recorded twice still costs only one token", () => {
    const s = getDefaultState();
    s.settings.usedFreezeDates = [d(0), d(0)]; // duplicate today
    expect(freezeStatus(s).usedRecent).toBe(1);
    expect(freezeStatus(s).available).toBe(1); // base 2 − 1
  });
});

describe("F8/F9: quick-log negation + sleep-cue gating", () => {
  it("does not flip sentiment on negation", () => {
    expect(parseQuickLog("not tired today").energy).toBeUndefined();
    expect(parseQuickLog("wasn't stressed at all").mood).toBeUndefined();
  });
  it("does not misread non-sleep hours as sleep", () => {
    expect(parseQuickLog("8 hours of meetings, exhausted").sleepHours).toBeUndefined();
    expect(parseQuickLog("ran for 2h").sleepHours).toBeUndefined();
  });
  it("still parses a real sleep statement", () => {
    expect(parseQuickLog("slept 7h, energy low").sleepHours).toBe(7);
  });
});

describe("F13: goalProgress denom===0 respects direction", () => {
  it("lower-is-better goal already-at-target is not 'achieved' when worse", () => {
    const s: AppState = {
      ...getDefaultState(),
      biomarkers: [{ id: "r", metric: "restingHR", value: 60, date: d(-1) }],
    };
    const gp = goalProgress(s, {
      id: "g",
      kind: "biomarker",
      label: "RHR",
      metric: "restingHR", // lower is better
      target: 55,
      startValue: 55, // degenerate: start === target
      createdAt: "x",
    });
    expect(gp.achieved).toBe(false); // current 60 > target 55 → not achieved
  });
});

describe("F2/F3: mergeStates is lossless for new settings fields", () => {
  it("unions usedFreezeDates and by-id-merges goals + experiments", () => {
    const local: AppState = {
      ...getDefaultState(),
      settings: {
        ...getDefaultState().settings,
        usedFreezeDates: ["2026-05-01"],
        outcomeGoals: [
          { id: "g-local", kind: "streak", label: "L", target: 10, createdAt: "x" },
        ],
        experiments: [],
      },
    };
    const cloud: AppState = {
      ...getDefaultState(),
      settings: {
        ...getDefaultState().settings,
        usedFreezeDates: ["2026-05-02"],
        outcomeGoals: [
          { id: "g-cloud", kind: "weeklyActive", label: "C", target: 5, createdAt: "x" },
        ],
        experiments: [
          {
            id: "e-cloud",
            hypothesis: "h",
            metric: "energy",
            startDate: "2026-05-01",
            endDate: "2026-05-15",
            baselineDays: 7,
            createdAt: "x",
          },
        ],
      },
    };
    const merged = mergeStates(local, cloud);
    expect(new Set(merged.settings.usedFreezeDates)).toEqual(
      new Set(["2026-05-01", "2026-05-02"])
    );
    expect(merged.settings.outcomeGoals!.map((g) => g.id).sort()).toEqual([
      "g-cloud",
      "g-local",
    ]);
    expect(merged.settings.experiments!.map((e) => e.id)).toEqual(["e-cloud"]);
  });
});
