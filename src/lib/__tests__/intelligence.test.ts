/**
 * Tests for the intelligence cluster: trend forecasting, week-over-week
 * digest, anonymous benchmarks, outcome-goal progress, experiment readouts.
 * All pure functions over synthetic AppState fixtures.
 */
import { describe, it, expect } from "vitest";
import type { AppState, DailyLog, BiomarkerEntry } from "@/lib/types";
import { getDefaultState } from "@/lib/storage";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";
import { biomarkerForecasts, whatChanged, benchmarks } from "@/lib/analytics";
import { goalProgress, experimentReadout } from "@/lib/goals";

const TZ_STATE = getDefaultState();
const TODAY = dateKeyInTz(getTz(TZ_STATE.settings));
const d = (off: number) => addDaysToKey(TODAY, off);

function mkLog(
  date: string,
  o: {
    energy?: number;
    mood?: number;
    sleepQ?: number;
    bed?: string;
    wake?: string;
    behaviors?: string[];
  } = {}
): DailyLog {
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
      actualBedtime: o.bed ?? null,
      actualWakeTime: o.wake ?? null,
      sleepQuality: o.sleepQ ?? null,
      sleepDurationMinutes: null,
    },
    energyLevel: o.energy ?? null,
    moodLevel: o.mood ?? null,
    dayNote: "",
    score: 0,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: Object.fromEntries(
      (o.behaviors ?? []).map((k) => [k, true])
    ),
  };
}

function withState(over: Partial<AppState>): AppState {
  return { ...getDefaultState(), ...over };
}

describe("biomarkerForecasts", () => {
  it("flags a confident improving trend (resting HR falling)", () => {
    const bms: BiomarkerEntry[] = [];
    for (let i = 0; i < 8; i++) {
      bms.push({
        id: `rhr-${i}`,
        metric: "restingHR",
        value: 70 - i * 1.4, // steadily falling over ~35 days
        date: d(-35 + i * 5),
      });
    }
    const fc = biomarkerForecasts(withState({ biomarkers: bms }));
    expect(fc.length).toBe(1);
    expect(fc[0].metric).toBe("restingHR");
    expect(fc[0].direction).toBe("improving"); // lower is better
    expect(fc[0].perWeek).toBeLessThan(0);
    expect(fc[0].projected).toBeLessThan(fc[0].current);
  });

  it("stays silent on a flat series (no fabricated trend)", () => {
    const bms: BiomarkerEntry[] = [];
    for (let i = 0; i < 8; i++)
      bms.push({ id: `h-${i}`, metric: "hrv", value: 55, date: d(-35 + i * 5) });
    expect(biomarkerForecasts(withState({ biomarkers: bms }))).toEqual([]);
  });

  it("requires enough readings", () => {
    const bms: BiomarkerEntry[] = [
      { id: "a", metric: "weight", value: 80, date: d(-30) },
      { id: "b", metric: "weight", value: 79, date: d(-10) },
    ];
    expect(biomarkerForecasts(withState({ biomarkers: bms }))).toEqual([]);
  });
});

describe("whatChanged", () => {
  it("needs two comparable weeks", () => {
    const logs = [mkLog(d(-1), { energy: 3 })];
    expect(whatChanged(withState({ dailyLogs: logs })).hasData).toBe(false);
  });

  it("detects a stronger recent week and surfaces movers", () => {
    const logs: DailyLog[] = [];
    // prior week: energy 3
    for (let i = 7; i <= 13; i++) logs.push(mkLog(d(-i), { energy: 3, behaviors: ["x"] }));
    // recent week: energy 4
    for (let i = 0; i <= 6; i++) logs.push(mkLog(d(-i), { energy: 4, behaviors: ["x"] }));
    const wc = whatChanged(withState({ dailyLogs: logs }));
    expect(wc.hasData).toBe(true);
    const energy = wc.changes.find((c) => c.key === "energy");
    expect(energy?.dir).toBe("up");
    expect(energy?.good).toBe(true);
    expect(wc.headline).toMatch(/stronger/i);
  });

  it("flags a slip in attention", () => {
    const logs: DailyLog[] = [];
    for (let i = 7; i <= 13; i++) logs.push(mkLog(d(-i), { energy: 4, behaviors: ["x"] }));
    for (let i = 0; i <= 6; i++) logs.push(mkLog(d(-i), { energy: 2, behaviors: ["x"] }));
    const wc = whatChanged(withState({ dailyLogs: logs }));
    expect(wc.attention).toMatch(/Energy/i);
  });
});

describe("benchmarks", () => {
  it("is not confident with thin history", () => {
    const logs = [mkLog(d(-1), { energy: 3 })];
    expect(benchmarks(withState({ dailyLogs: logs })).confident).toBe(false);
  });

  it("ranks a very consistent user in a high band", () => {
    const logs: DailyLog[] = [];
    for (let i = 0; i < 30; i++) logs.push(mkLog(d(-i), { energy: 4, behaviors: ["a", "b", "c"] }));
    const b = benchmarks(withState({ dailyLogs: logs }));
    expect(b.confident).toBe(true);
    const consistency = b.items.find((x) => x.key === "consistency")!;
    expect(consistency.percentile).toBeGreaterThanOrEqual(80);
    expect(consistency.band).toBe("top");
    const weekly = b.items.find((x) => x.key === "weekly")!;
    expect(weekly.value).toBe(7);
  });
});

describe("goalProgress", () => {
  it("biomarker (lower-is-better) computes directional progress", () => {
    const state = withState({
      biomarkers: [{ id: "r", metric: "restingHR", value: 60, date: d(-1) }],
    });
    const gp = goalProgress(state, {
      id: "g1",
      kind: "biomarker",
      label: "Resting HR under 55",
      metric: "restingHR",
      target: 55,
      startValue: 70,
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(gp.current).toBe(60);
    expect(gp.achieved).toBe(false);
    expect(gp.pct).toBeGreaterThan(0.6); // 10 of 15 covered
    expect(gp.pct).toBeLessThan(0.7);
  });

  it("biomarker goal marks achieved when crossed", () => {
    const state = withState({
      biomarkers: [{ id: "r", metric: "restingHR", value: 54, date: d(-1) }],
    });
    const gp = goalProgress(state, {
      id: "g",
      kind: "biomarker",
      label: "RHR",
      metric: "restingHR",
      target: 55,
      startValue: 70,
      createdAt: "x",
    });
    expect(gp.achieved).toBe(true);
    expect(gp.pct).toBe(1);
  });

  it("streak goal tracks the live streak", () => {
    const logs: DailyLog[] = [];
    for (let i = 0; i < 5; i++) logs.push(mkLog(d(-i), { energy: 3 }));
    const gp = goalProgress(withState({ dailyLogs: logs }), {
      id: "s",
      kind: "streak",
      label: "10-day streak",
      target: 10,
      createdAt: "x",
    });
    expect(gp.current).toBe(5);
    expect(gp.pct).toBeCloseTo(0.5, 1);
    expect(gp.achieved).toBe(false);
  });

  it("weeklyActive goal can be achieved", () => {
    const logs: DailyLog[] = [];
    for (let i = 0; i < 6; i++) logs.push(mkLog(d(-i), { energy: 3 }));
    const gp = goalProgress(withState({ dailyLogs: logs }), {
      id: "w",
      kind: "weeklyActive",
      label: "5 active days",
      target: 5,
      createdAt: "x",
    });
    expect(gp.current).toBe(6);
    expect(gp.achieved).toBe(true);
  });
});

describe("experimentReadout", () => {
  const baseExp = {
    id: "e",
    hypothesis: "Magnesium improves sleep",
    metric: "energy" as const,
    startDate: d(-7),
    endDate: d(7),
    baselineDays: 7,
    createdAt: "x",
  };

  it("reports 'better' when the metric rises with enough data", () => {
    const logs: DailyLog[] = [];
    for (let i = 8; i <= 14; i++) logs.push(mkLog(d(-i), { energy: 3 })); // baseline
    for (let i = 0; i <= 6; i++) logs.push(mkLog(d(-i), { energy: 4 })); // during
    const ro = experimentReadout(withState({ dailyLogs: logs }), baseExp);
    expect(ro.enough).toBe(true);
    expect(ro.delta).toBeCloseTo(1, 1);
    expect(ro.verdict).toBe("better");
    expect(ro.active).toBe(true);
  });

  it("is inconclusive without enough during-data", () => {
    const logs: DailyLog[] = [];
    for (let i = 8; i <= 14; i++) logs.push(mkLog(d(-i), { energy: 3 }));
    logs.push(mkLog(d(-1), { energy: 4 }));
    const ro = experimentReadout(withState({ dailyLogs: logs }), baseExp);
    expect(ro.enough).toBe(false);
    expect(ro.verdict).toBe("inconclusive");
  });
});
