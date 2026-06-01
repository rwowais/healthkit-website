/**
 * analytics.ts — records / milestones / on-this-day / consistency / pillars /
 * correlation. Dates are built relative to "today in UTC" so the suite is
 * deterministic regardless of when it runs.
 */
import { describe, it, expect } from "vitest";
import {
  personalRecords,
  freshMilestone,
  achievedMilestones,
  onThisDay,
  consistencyWindows,
  pillarSummaries,
  correlate,
  completionsOnLog,
  monthlyReport,
} from "@/lib/analytics";
import { getDefaultState } from "@/lib/storage";
import { dateKeyInTz, addDaysToKey } from "@/lib/tz";
import type { AppState, DailyLog } from "@/lib/types";

const TZ = "UTC";
const today = () => dateKeyInTz(TZ);
const back = (n: number) => addDaysToKey(today(), -n);

function log(date: string, opts: Partial<DailyLog> = {}): DailyLog {
  return {
    date,
    sleepCompletions: [],
    exerciseEntries: [],
    nutritionScorecard: {
      ateFruitsVeggies: null,
      avoidedProcessedSugar: null,
      customItems: [],
      finishedEatingOnTime: null,
      hitProteinTarget: null,
      minimizedAlcohol: null,
      note: "",
      stayedHydrated: null,
    },
    supplementEntries: [],
    completions: [],
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepDurationMinutes: null,
      sleepQuality: null,
    },
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: {},
    supplementCompletions: {},
    ...opts,
  } as DailyLog;
}

function stateWith(logs: DailyLog[], extra: Partial<AppState> = {}): AppState {
  const base = getDefaultState();
  return {
    ...base,
    settings: { ...base.settings, timezone: TZ },
    dailyLogs: logs,
    ...extra,
  };
}

describe("completionsOnLog", () => {
  it("counts checked behaviors + supplements", () => {
    expect(
      completionsOnLog(
        log("2026-01-01", {
          behaviorCompletions: { a: true, b: false, c: true },
          supplementCompletions: { d: true },
        })
      )
    ).toBe(3);
  });
});

describe("personalRecords", () => {
  it("computes longest streak, best week, top behavior and totals", () => {
    // 5 consecutive active days ending today.
    const logs = [0, 1, 2, 3, 4].map((n) =>
      log(back(n), { behaviorCompletions: { meditate: true } })
    );
    const r = personalRecords(stateWith(logs));
    expect(r.longestStreak).toBeGreaterThanOrEqual(5);
    expect(r.bestWeek).toBe(5);
    expect(r.activeDays).toBe(5);
    expect(r.totalCompletions).toBe(5);
    expect(r.topBehavior?.count).toBe(5);
  });

  it("never reports zero records for a fresh user", () => {
    const r = personalRecords(stateWith([]));
    expect(r.longestStreak).toBe(0);
    expect(r.topBehavior).toBeNull();
  });
});

describe("freshMilestone", () => {
  it("fires the day a streak threshold is crossed", () => {
    // 7 consecutive active days ending today → crosses the 7-day mark today.
    const logs = [0, 1, 2, 3, 4, 5, 6].map((n) =>
      log(back(n), { behaviorCompletions: { x: true } })
    );
    const m = freshMilestone(stateWith(logs));
    expect(m?.id).toBe("streak-7");
  });

  it("does NOT fire for a milestone already passed (no stale pop)", () => {
    // 8 consecutive days — yesterday the streak was already 7.
    const logs = [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
      log(back(n), { behaviorCompletions: { x: true } })
    );
    expect(freshMilestone(stateWith(logs))).toBeNull();
  });

  it("respects celebrated ids so it doesn't repeat the same day", () => {
    const logs = [0, 1, 2, 3, 4, 5, 6].map((n) =>
      log(back(n), { behaviorCompletions: { x: true } })
    );
    const base = stateWith(logs);
    const s: AppState = {
      ...base,
      settings: { ...base.settings, celebratedMilestones: ["streak-7"] },
    };
    expect(freshMilestone(s)).toBeNull();
  });

  it("achievedMilestones lists reached tiers", () => {
    const logs = [0, 1, 2, 3, 4, 5, 6].map((n) =>
      log(back(n), { behaviorCompletions: { x: true } })
    );
    const ach = achievedMilestones(stateWith(logs));
    expect(ach.some((m) => m.id === "streak-7")).toBe(true);
  });
});

describe("onThisDay", () => {
  it("surfaces a still-active habit on its monthly anniversary", () => {
    const logs: DailyLog[] = [
      log(back(30), { behaviorCompletions: { "morning-sunlight": true } }),
      log(back(2), { behaviorCompletions: { "morning-sunlight": true } }),
      // filler active days to clear the >=8 log gate
      ...[3, 4, 5, 6, 7, 8].map((n) =>
        log(back(n), { behaviorCompletions: { hydrate: true } })
      ),
    ];
    const r = onThisDay(stateWith(logs, { installedPacks: ["longevity-foundation"] }));
    expect(r).toBeTruthy();
    expect(r!.daysAgo).toBe(30);
    expect(r!.ago).toBe("a month ago");
    expect(r!.title.length).toBeGreaterThan(0);
  });

  it("returns null without enough history", () => {
    expect(onThisDay(stateWith([log(back(1), {})]))).toBeNull();
  });
});

describe("consistencyWindows", () => {
  it("computes weekday averages and a block split", () => {
    const logs: DailyLog[] = [
      log(back(0), {
        behaviorCompletions: {
          "morning-sunlight": true,
          "hydrate-am": true,
          "protein-breakfast": true,
        },
      }),
      log(back(1), {
        behaviorCompletions: {
          "morning-sunlight": true,
          "hydrate-am": true,
          "protein-breakfast": true,
        },
      }),
      log(back(2), { behaviorCompletions: { "morning-sunlight": true } }),
      log(back(3), { behaviorCompletions: { "morning-sunlight": true } }),
    ];
    const c = consistencyWindows(
      stateWith(logs, { installedPacks: ["longevity-foundation"] })
    );
    expect(c.byWeekday.length).toBe(7);
    expect(c.loggedDays).toBe(4);
    // At least two weekdays sampled → strongest/weakest resolved & ordered.
    expect(c.strongestWeekday).not.toBeNull();
    expect(c.weakestWeekday).not.toBeNull();
    const hi = c.byWeekday[c.strongestWeekday!]!;
    const lo = c.byWeekday[c.weakestWeekday!]!;
    expect(hi).toBeGreaterThanOrEqual(lo);
    // Block split present and shares sum to ~1.
    expect(c.byBlock.length).toBeGreaterThan(0);
    const sum = c.byBlock.reduce((a, b) => a + b.share, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });
});

describe("pillarSummaries", () => {
  it("returns one summary per pillar, with cold-start guidance when untracked", () => {
    const s = pillarSummaries(stateWith([]));
    expect(s.length).toBe(4);
    for (const p of s) {
      expect(p.tracked).toBe(false);
      expect(p.guidance.length).toBeGreaterThan(0);
    }
  });
});

describe("correlate", () => {
  it("finds a strong positive correlation when two factors move together", () => {
    const energies = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5];
    const logs = energies.map((e, i) =>
      log(back(i), { energyLevel: e, moodLevel: e })
    );
    const c = correlate(logs, "energy", "mood");
    expect(c.n).toBe(10);
    expect(c.r).not.toBeNull();
    expect(c.r!).toBeGreaterThan(0.99);
    expect(c.strength).toBe("strong");
    expect(c.direction).toBe("positive");
  });

  it("reports insufficient data below the pair floor", () => {
    const logs = [1, 2, 3].map((e, i) =>
      log(back(i), { energyLevel: e, moodLevel: e })
    );
    const c = correlate(logs, "energy", "mood");
    expect(c.r).toBeNull();
    expect(c.strength).toBe("none");
  });

  it("never correlates a factor with itself", () => {
    const logs = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5].map((e, i) =>
      log(back(i), { energyLevel: e })
    );
    expect(correlate(logs, "energy", "energy").r).toBeNull();
  });
});

describe("monthlyReport", () => {
  it("summarizes the current month's activity", () => {
    const month = today().slice(0, 7);
    const logs = ["01", "02", "03"].map((d) =>
      log(`${month}-${d}`, {
        behaviorCompletions: { meditate: true, hydrate: true },
      })
    );
    const r = monthlyReport(stateWith(logs));
    expect(r.activeDays).toBe(3);
    expect(r.totalCompletions).toBe(6);
    expect(r.topBehaviors.length).toBeGreaterThan(0);
    expect(r.monthLabel.length).toBeGreaterThan(0);
    expect(r.monthShort.length).toBeGreaterThan(0);
  });
});
