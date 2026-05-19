/**
 * Keystone must actually FIRE for a genuinely engaged, consistent user
 * (the earlier hardening over-corrected it into a near-dead feature).
 * Still de-circularised + effect-size + sample gated — this asserts a
 * strong, real signal is detected, not that the bar is gone.
 */
import { describe, it, expect } from "vitest";
import { keystone, whatWorks } from "@/lib/intel";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState, DailyLog } from "@/lib/types";

function dk(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const log = (
  date: string,
  bc: Record<string, boolean>,
  score: number
): DailyLog =>
  ({
    date,
    behaviorCompletions: bc,
    score,
    sleepLog: {},
    energyLevel: null,
    moodLevel: null,
    exerciseEntries: [],
    supplementEntries: [],
    sleepCompletions: [],
    completions: [],
    nutritionScorecard: { customItems: [], note: "" },
  }) as unknown as DailyLog;

describe("keystone detection", () => {
  it("fires for a consistent user where one behavior predicts the rest", () => {
    const base: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const keys = compileTimeline(base, 0).map((i) => i.canonicalKey);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    const K = keys[0];
    const others = keys.slice(1);

    const logs: DailyLog[] = [];
    // 9 days K done → almost everything else done too
    for (let i = 0; i < 9; i++) {
      const bc: Record<string, boolean> = { [K]: true };
      for (const o of others) bc[o] = true;
      logs.push(log(dk(i + 1), bc, 85));
    }
    // 5 days K NOT done → almost nothing else done
    for (let i = 0; i < 5; i++) {
      const bc: Record<string, boolean> = { [K]: false };
      if (others[0]) bc[others[0]] = true;
      logs.push(log(dk(i + 11), bc, 20));
    }

    const ks = keystone({ ...base, dailyLogs: logs });
    expect(ks).not.toBeNull();
    expect(ks!.key).toBe(K);
    expect(ks!.delta).toBeGreaterThanOrEqual(1);
  });

  it("returns null when there isn't enough signal (no false causality)", () => {
    const base: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const logs = [log(dk(1), {}, 10), log(dk(2), {}, 10)];
    expect(keystone({ ...base, dailyLogs: logs })).toBeNull();
  });
});

describe("outcome reflection — whatWorks", () => {
  const feltLog = (
    date: string,
    bc: Record<string, boolean>,
    energy: number | null,
    sleepQ: number | null
  ): DailyLog =>
    ({
      date,
      behaviorCompletions: bc,
      score: 50,
      sleepLog: { sleepQuality: sleepQ },
      energyLevel: energy,
      moodLevel: null,
      exerciseEntries: [],
      supplementEntries: [],
      sleepCompletions: [],
      completions: [],
      nutritionScorecard: { customItems: [], note: "" },
    }) as unknown as DailyLog;

  it("proves a behavior that tracks with the user's own better days", () => {
    const base: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const K = compileTimeline(base, 0).map((i) => i.canonicalKey)[0];
    const logs: DailyLog[] = [];
    for (let i = 0; i < 9; i++)
      logs.push(feltLog(dk(i + 1), { [K]: true }, 5, 5)); // done → feels great
    for (let i = 0; i < 5; i++)
      logs.push(feltLog(dk(i + 11), { [K]: false }, 2, 2)); // not → low
    const w = whatWorks({ ...base, dailyLogs: logs });
    expect(w).not.toBeNull();
    expect(w!.key).toBe(K);
    expect(w!.delta).toBeGreaterThanOrEqual(1);
  });

  it("is null without enough check-in signal (honest)", () => {
    const base: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    // completions but no energy/sleep logged → no felt signal
    const logs = Array.from({ length: 12 }, (_, i) =>
      feltLog(dk(i + 1), { x: true }, null, null)
    );
    expect(whatWorks({ ...base, dailyLogs: logs })).toBeNull();
  });
});
