/**
 * Regression tests for overnight QA round-3 fixes.
 */
import { describe, it, expect } from "vitest";
import type { AppState, BehaviorDef, DailyLog } from "@/lib/types";
import { getDefaultState } from "@/lib/storage";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";
import { behaviorStats } from "@/lib/intel";
import { backfillBuiltinFields } from "@/lib/cms/authoring";

const TZ_STATE = getDefaultState();
const TODAY = dateKeyInTz(getTz(TZ_STATE.settings));
const d = (off: number) => addDaysToKey(TODAY, off);

function log(date: string, done: Record<string, boolean>): DailyLog {
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
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 50,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: done,
  };
}

describe("P0: backfillBuiltinFields preserves safety/scheduling data", () => {
  it("backfills contraindications from the built-in atom (CMS can't strip them)", () => {
    // Simulate a CMS-assembled behavior (only editable fields) for a built-in
    // atom that carries a safety contraindication.
    const cmsBase: BehaviorDef = {
      canonicalKey: "omega-3",
      title: "Omega-3 (admin-edited title)",
      block: "morning",
      anchor: "wake",
      offsetMin: 0,
      leverage: 2,
      kind: "action",
      icon: "fish",
      rationale: "edited rationale",
    };
    const out = backfillBuiltinFields(cmsBase);
    expect(out.contraindications).toContain("anticoagulants");
    // editable fields the admin set are preserved
    expect(out.title).toBe("Omega-3 (admin-edited title)");
    expect(out.rationale).toBe("edited rationale");
  });

  it("backfills daysActive + evidenceTier when the built-in has them", () => {
    // strength is Mon/Wed/Fri in the built-in catalog (a daysActive atom).
    const out = backfillBuiltinFields({
      canonicalKey: "strength",
      title: "Strength",
      block: "afternoon",
      anchor: "wake",
      offsetMin: 0,
      leverage: 3,
      kind: "action",
      icon: "dumbbell",
      rationale: "x",
    });
    // Whatever the built-in scheduling is, it must survive assembly (not undefined).
    expect(out.daysActive === undefined || Array.isArray(out.daysActive)).toBe(true);
    // a behavior with a built-in daysActive must keep it
    expect(out.daysActive).toBeDefined();
  });

  it("leaves a non-built-in (custom) behavior untouched", () => {
    const custom: BehaviorDef = {
      canonicalKey: "custom:abc:my-thing",
      title: "My thing",
      block: "anytime",
      anchor: "wake",
      offsetMin: 0,
      leverage: 1,
      kind: "action",
      icon: "sparkle",
      rationale: "x",
    };
    const out = backfillBuiltinFields(custom);
    expect(out.contraindications).toBeUndefined();
    expect(out).toEqual(custom);
  });
});

describe("behaviorStats: per-behavior streak honors a spent freeze", () => {
  it("bridges a frozen gap like the global streak", () => {
    const base: AppState = {
      ...getDefaultState(),
      dailyLogs: [log(d(0), { k: true }), log(d(-2), { k: true })],
    };
    // Yesterday (d(-1)) has no completion. Without a freeze, the streak breaks.
    expect(behaviorStats(base, "k").streak).toBe(1);
    // Freeze yesterday → transparent → the streak bridges to 2.
    base.settings.usedFreezeDates = [d(-1)];
    expect(behaviorStats(base, "k").streak).toBe(2);
  });
});
