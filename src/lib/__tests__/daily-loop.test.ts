/**
 * Daily-loop cluster: habit stacking (applyStacks) + streak-freeze bank
 * (freezeStatus + getVacationDates union + streak bridging).
 */
import { describe, it, expect } from "vitest";
import type { AppState, DailyLog, TimeBlock } from "@/lib/types";
import { applyStacks, type TimelineItem } from "@/lib/engine";
import { getDefaultState, getVacationDates } from "@/lib/storage";
import { freezeStatus, calculateStreak } from "@/lib/scoring";
import { learnedReminderMinutes } from "@/lib/smartReminders";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";

function ti(key: string, block: TimeBlock, title: string): TimelineItem {
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
  };
}

const TODAY = dateKeyInTz(getTz(getDefaultState().settings));
const d = (off: number) => addDaysToKey(TODAY, off);

function activeLog(date: string): DailyLog {
  return {
    date,
    sleepCompletions: [],
    exerciseEntries: [],
    nutritionScorecard: {
      hitProteinTarget: null,
      ateFruitsVeggies: null,
      stayedHydrated: null,
      avoidedProcessedSugar: null,
      finishedEatingOnTime: null,
      minimizedAlcohol: null,
      customItems: [],
      note: "",
    },
    supplementEntries: [],
    completions: [],
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: null,
      sleepDurationMinutes: null,
    },
    energyLevel: 3,
    moodLevel: null,
    dayNote: "",
    score: 50,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: { x: true },
  };
}

describe("applyStacks", () => {
  it("files a stacked behavior in its anchor's block, right after it", () => {
    const out = applyStacks(
      [ti("a", "morning", "Sunlight"), ti("b", "evening", "Pushups")],
      { b: { stackAfter: "a" } }
    );
    expect(out.map((i) => i.canonicalKey)).toEqual(["a", "b"]);
    expect(out[1].block).toBe("morning");
    expect(out[1].stackedAfter).toBe("Sunlight");
  });

  it("ignores a stack whose anchor isn't in the timeline", () => {
    const items = [ti("a", "morning", "Sunlight"), ti("b", "evening", "Pushups")];
    const out = applyStacks(items, { b: { stackAfter: "missing" } });
    expect(out).toBe(items); // untouched (same reference)
  });

  it("handles a chain A→B→C", () => {
    const out = applyStacks(
      [
        ti("a", "morning", "A"),
        ti("b", "afternoon", "B"),
        ti("c", "evening", "C"),
      ],
      { b: { stackAfter: "a" }, c: { stackAfter: "b" } }
    );
    expect(out.map((i) => i.canonicalKey)).toEqual(["a", "b", "c"]);
    expect(out.every((i) => i.block === "morning")).toBe(true);
  });

  it("is a no-op without overrides", () => {
    const items = [ti("a", "morning", "A")];
    expect(applyStacks(items, undefined)).toBe(items);
    expect(applyStacks(items, {})).toBe(items);
  });
});

describe("freezeStatus", () => {
  it("starts at the base monthly allowance", () => {
    const s = getDefaultState();
    expect(freezeStatus(s).available).toBe(2);
  });

  it("counts recent uses against the allowance", () => {
    const s = getDefaultState();
    s.settings.usedFreezeDates = [d(0), d(-3)];
    expect(freezeStatus(s).available).toBe(0);
  });

  it("ignores uses outside the rolling window", () => {
    const s = getDefaultState();
    s.settings.usedFreezeDates = [d(-40)];
    expect(freezeStatus(s).available).toBe(2);
  });

  it("grants a loyalty bump with deep history", () => {
    const s = getDefaultState();
    s.dailyLogs = Array.from({ length: 60 }, (_, i) => activeLog(d(-i)));
    expect(freezeStatus(s).allowance).toBe(3);
  });
});

describe("learnedReminderMinutes (smart timing)", () => {
  const withCompletion = (date: string, key: string, min: number): DailyLog => ({
    ...activeLog(date),
    behaviorCompletions: { [key]: true },
    behaviorCompletionMinutes: { [key]: min },
  });

  it("returns null when Smart timing is off", () => {
    const s = getDefaultState();
    s.dailyLogs = [1, 2, 3, 4, 5].map((i) => withCompletion(d(-i), "k", 480));
    expect(learnedReminderMinutes(s, "k")).toBeNull();
  });

  it("returns null until there are enough samples", () => {
    const s = getDefaultState();
    s.settings.smartReminders = true;
    s.dailyLogs = [1, 2, 3].map((i) => withCompletion(d(-i), "k", 480));
    expect(learnedReminderMinutes(s, "k")).toBeNull();
  });

  it("returns the median of recent completion times", () => {
    const s = getDefaultState();
    s.settings.smartReminders = true;
    s.dailyLogs = [
      withCompletion(d(-1), "k", 420),
      withCompletion(d(-2), "k", 440),
      withCompletion(d(-3), "k", 460),
      withCompletion(d(-4), "k", 480),
      withCompletion(d(-5), "k", 500),
    ];
    expect(learnedReminderMinutes(s, "k")).toBe(460); // median
  });
});

describe("streak freeze bridges a gap", () => {
  it("a frozen day is transparent to the streak (like a rest day)", () => {
    const s: AppState = {
      ...getDefaultState(),
      dailyLogs: [activeLog(d(0)), activeLog(d(-3))],
    };
    // Two missed days (-1,-2) → grace alone forgives only one → streak 1.
    expect(calculateStreak(s.dailyLogs, getVacationDates(s), s.settings)).toBe(1);
    // Freeze both gap days → the streak bridges to 2.
    s.settings.usedFreezeDates = [d(-1), d(-2)];
    expect(getVacationDates(s).has(d(-1))).toBe(true);
    expect(calculateStreak(s.dailyLogs, getVacationDates(s), s.settings)).toBe(2);
  });
});
