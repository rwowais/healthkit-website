/**
 * Personal model + identity reflection — only surface when the data can
 * honestly support it; produce real traits for an engaged user.
 */
import { describe, it, expect } from "vitest";
import { personalModel, identityReflection } from "@/lib/reflect";
import { weeklyReview } from "@/lib/intel";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState, DailyLog } from "@/lib/types";

function dk(off: number) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
const mk = (
  date: string,
  bc: Record<string, boolean>,
  score: number,
  e: number | null = null,
  s: number | null = null
): DailyLog =>
  ({
    date,
    behaviorCompletions: bc,
    score,
    sleepLog: { sleepQuality: s },
    energyLevel: e,
    moodLevel: null,
    exerciseEntries: [],
    supplementEntries: [],
    sleepCompletions: [],
    completions: [],
    nutritionScorecard: { customItems: [], note: "" },
  }) as unknown as DailyLog;

const base = (): AppState => ({
  ...getDefaultState(),
  installedPacks: ["longevity-foundation"],
});

describe("personalModel", () => {
  it("is empty until there is enough history (honest)", () => {
    const logs = [mk(dk(1), {}, 50), mk(dk(2), {}, 50)];
    expect(personalModel({ ...base(), dailyLogs: logs }).length).toBe(0);
  });

  it("produces real traits for a consistent, improving user", () => {
    const st = base();
    const keys = compileTimeline(st, 0).map((i) => i.canonicalKey);
    const allDone = Object.fromEntries(keys.map((k) => [k, true]));
    const logs: DailyLog[] = [];
    // prior 30 days: weaker (~55)
    for (let i = 31; i <= 60; i++) logs.push(mk(dk(i), {}, 55, 3, 3));
    // recent 30 days: strong, everything done (~90) → trend up + anchor
    for (let i = 1; i <= 30; i++) logs.push(mk(dk(i), allDone, 90, 5, 5));
    const traits = personalModel({ ...st, dailyLogs: logs });
    expect(traits.length).toBeGreaterThanOrEqual(1);
    expect(traits.length).toBeLessThanOrEqual(4);
  });
});

describe("identityReflection", () => {
  it("is null without ~3 weeks of real activity", () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      mk(dk(i + 1), { x: true }, 60)
    );
    expect(identityReflection({ ...base(), dailyLogs: logs })).toBeNull();
  });

  it("reflects identity for a month-long engaged user", () => {
    const st = base();
    const k = compileTimeline(st, 0).map((i) => i.canonicalKey)[0];
    const logs = Array.from({ length: 25 }, (_, i) =>
      mk(dk(i + 1), { [k]: true }, 80, 4, 4)
    );
    const id = identityReflection({ ...st, dailyLogs: logs });
    expect(id).not.toBeNull();
    expect(id!.body).toContain("showed up");
  });
});

describe("weeklyReview continuity (coach memory)", () => {
  it("references whether last week's focus held", () => {
    const st = base();
    const ess = compileTimeline(st, 0).filter((i) => i.leverage === 3);
    if (ess.length === 0) return; // pack has no leverage-3 → skip
    const focusKey = ess[0].canonicalKey;
    const others = compileTimeline(st, 0)
      .filter((i) => i.canonicalKey !== focusKey)
      .map((i) => i.canonicalKey);
    const allOthers = Object.fromEntries(others.map((o) => [o, true]));
    const logs: DailyLog[] = [];
    // prev week (offsets 7..13): focus mostly NOT done → it gets flagged
    for (let i = 7; i <= 13; i++)
      logs.push(mk(dk(i), { ...allOthers, [focusKey]: false }, 60));
    // this week (0..6): focus now done → "holding"
    for (let i = 0; i <= 6; i++)
      logs.push(mk(dk(i), { ...allOthers, [focusKey]: true }, 75));
    const r = weeklyReview({ ...st, dailyLogs: logs });
    expect(r).not.toBeNull();
    expect(typeof r!.continuity).toBe("string");
    expect(r!.continuity).toMatch(/holding|still light/);
  });
});
