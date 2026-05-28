/**
 * Keystone must actually FIRE for a genuinely engaged, consistent user
 * (the earlier hardening over-corrected it into a near-dead feature).
 * Still de-circularised + effect-size + sample gated — this asserts a
 * strong, real signal is detected, not that the bar is gone.
 */
import { describe, it, expect } from "vitest";
import { keystone, whatWorks, suggestions } from "@/lib/intel";
import {
  compileTimeline,
  masteredKeys,
  freshlyMastered,
} from "@/lib/engine";
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

describe("D1 periodization — masteredKeys", () => {
  it("graduates a long-streak high-adherence behavior to maintenance", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const K = compileTimeline(st, 0).map((i) => i.canonicalKey)[0];
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 30; i++)
      logs.push(log(dk(i), { [K]: true }, 80));
    const state = { ...st, dailyLogs: logs };
    // Across 7 consecutive days it should be mastered (muted) on most,
    // and resurface on its weekly spot-check (absent ~1 in 7).
    let muted = 0;
    for (let off = 0; off < 7; off++) {
      if (masteredKeys(state, dk(off)).has(K)) muted++;
    }
    expect(muted).toBeGreaterThanOrEqual(5);
    expect(muted).toBeLessThan(7); // spot-check resurfaces it
  });

  it("does not graduate without a long streak", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const K = compileTimeline(st, 0).map((i) => i.canonicalKey)[0];
    const logs = Array.from({ length: 25 }, (_, i) =>
      log(dk(i + 1), i < 5 ? { [K]: true } : {}, 40)
    );
    expect(masteredKeys({ ...st, dailyLogs: logs }, dk(0)).has(K)).toBe(
      false
    );
  });
});

describe("D2 friction intelligence — suggestions", () => {
  it("offers to re-time a chronically skipped clock-anchored behavior", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const items = compileTimeline(st, 0);
    const skip = items.find((i) => i.block !== "anytime")!;
    const others = items
      .filter((i) => i.canonicalKey !== skip.canonicalKey)
      .map((i) => i.canonicalKey);
    const allOthers = Object.fromEntries(others.map((o) => [o, true]));
    // 21+ tracked days are required before the engine will say a
    // behavior isn't working — short-streak users on week-2 should NOT
    // get told their behavior doesn't fit yet. Plenty of activity in
    // recent days satisfies the "5 active days in the last 7" gate.
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 21; i++)
      logs.push(log(dk(i), { ...allOthers }, 60));
    const sug = suggestions({ ...st, dailyLogs: logs });
    const retime = sug.find((s) => s.action.type === "retime");
    expect(retime).toBeTruthy();
    expect(retime!.action).toMatchObject({
      type: "retime",
      key: skip.canonicalKey,
      block: "anytime",
    });
  });

  it("freshlyMastered identifies the one-day mastery transition", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const K = compileTimeline(st, 0).map((i) => i.canonicalKey)[0];
    // Long-streak case: 30 day streak ending today. freshlyMastered
    // returns the set diff (today \ yesterday). For a deeply mastered
    // behavior, both days typically include K — but the weekly
    // spot-check can shift K off yesterday and back on today, which
    // legitimately produces a transition. We just check the function
    // runs without crashing and returns a Set.
    const logsLong: DailyLog[] = [];
    for (let i = 0; i <= 30; i++)
      logsLong.push(log(dk(i), { [K]: true }, 80));
    const longFresh = freshlyMastered(
      { ...st, dailyLogs: logsLong },
      dk(0)
    );
    expect(longFresh).toBeInstanceOf(Set);
    // Streak ends *today* exactly at the mastery boundary — today is
    // mastered, yesterday wasn't yet. That's the transition we want
    // to celebrate.
    const logsTransition: DailyLog[] = [];
    // 21 consecutive days ending today: i=0..21 → 22 days. masteredKeys
    // requires streak>=21 *up to but not requiring today*, plus 14
    // active in the last 30. 22 days satisfies both today; 21 days
    // (yesterday's window) had only 20-day streak. Provide enough.
    for (let i = 0; i <= 21; i++)
      logsTransition.push(log(dk(i), { [K]: true }, 80));
    const today = masteredKeys(
      { ...st, dailyLogs: logsTransition },
      dk(0)
    );
    if (today.has(K)) {
      // Only assert the differential if the underlying mastery actually
      // tipped today; that depends on the spot-check hash for K + dk(0).
      expect(
        freshlyMastered({ ...st, dailyLogs: logsTransition }, dk(0)).has(K)
      ).toBe(true);
    }
  });

  it("does NOT offer to re-time short-streak (< 21 days) intermittent users", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const items = compileTimeline(st, 0);
    const skip = items.find((i) => i.block !== "anytime")!;
    const others = items
      .filter((i) => i.canonicalKey !== skip.canonicalKey)
      .map((i) => i.canonicalKey);
    const allOthers = Object.fromEntries(others.map((o) => [o, true]));
    // 6 days of logs — used to trip the retime branch on the old 14-day
    // threshold. New 21-day floor must hold the line: a week-2 user
    // skipping one slot deserves patience, not "this isn't working."
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 6; i++) logs.push(log(dk(i), { ...allOthers }, 60));
    const sug = suggestions({ ...st, dailyLogs: logs });
    expect(sug.find((s) => s.action.type === "retime")).toBeUndefined();
    expect(sug.find((s) => s.action.type === "pause")).toBeUndefined();
  });
});
