/**
 * Regression: the weekly review must not flag a conflict-MUTED behavior as the
 * week's "highest-leverage gap" (sweep 2026-06-09 HIGH #7).
 *
 * A burnout-recovery user installs the "no intense training" restraint, which
 * firm-conflict-mutes Strength (leverage 3). Because a muted behavior is
 * non-completable it shows 0 completions, so weeklyReview's focus loop (which
 * picks the essential with the FEWEST completions) always selected it — the
 * coach literally telling the user to "tighten Strength training", the exact
 * behavior the user's own active protocol is resting. The fix filters
 * conflict-muted keys out of the `essentials` set feeding focus + continuity.
 */
import { describe, it, expect } from "vitest";
import { weeklyReview } from "@/lib/intel";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState, DailyLog } from "@/lib/types";

function dk(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const log = (date: string, bc: Record<string, boolean>, score: number): DailyLog =>
  ({
    date,
    behaviorCompletions: bc,
    score,
    sleepLog: {},
    energyLevel: 4,
    moodLevel: null,
    exerciseEntries: [],
    supplementEntries: [],
    sleepCompletions: [],
    completions: [],
    nutritionScorecard: { customItems: [], note: "" },
  }) as unknown as DailyLog;

describe("weekly review skips conflict-muted essentials (HIGH #7)", () => {
  it("does not name muted Strength as the focus/continuity gap", () => {
    const base: AppState = {
      ...getDefaultState(),
      // strength (longevity-foundation) + no-intense restraint (burnout-recovery)
      // → Strength is firm-conflict-muted, exactly the persona's config.
      installedPacks: ["longevity-foundation", "burnout-recovery"],
    };

    // Complete every compiled behavior EXCEPT strength, every day, for two
    // weeks — so strength is the lone 0-completion essential that the old code
    // would always flag, while the new code excludes it (muted).
    const keys = compileTimeline(base, 0).map((i) => i.canonicalKey);
    const completable = keys.filter((k) => k !== "strength");
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 14; i++) {
      const bc: Record<string, boolean> = {};
      for (const k of completable) bc[k] = true;
      logs.push(log(dk(i), bc, 82));
    }

    const state: AppState = { ...base, dailyLogs: logs };
    const review = weeklyReview(state);
    expect(review).not.toBeNull();
    // The core invariant: the coach never tells the user to do more of the
    // behavior its own protocol is actively resting.
    expect(review!.focus.toLowerCase()).not.toContain("strength");
    if (review!.continuity) {
      expect(review!.continuity.toLowerCase()).not.toContain("strength");
    }
  });

  it("also holds when Strength is scheduled on non-Monday days (heart-health)", () => {
    // Audit round 2: conflictMutedKeys sampled ONLY day-0 (Monday), so a
    // behavior whose daysActive excludes Monday (heart-health Strength,
    // Tue/Thu/Sat) never appeared in the sampled compile — its conflict mute
    // was invisible to the filter and HIGH #7 reproduced verbatim with zero
    // user customization. The filter now unions all seven weekdays.
    const base: AppState = {
      ...getDefaultState(),
      installedPacks: ["heart-health", "burnout-recovery"],
    };
    const keys = new Set<string>();
    for (let d = 0; d < 7; d++)
      for (const it of compileTimeline(base, d)) keys.add(it.canonicalKey);
    expect(keys.has("strength")).toBe(true); // sanity: combo carries strength

    const completable = [...keys].filter((k) => k !== "strength");
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 14; i++) {
      const bc: Record<string, boolean> = {};
      for (const k of completable) bc[k] = true;
      logs.push(log(dk(i), bc, 82));
    }

    const review = weeklyReview({ ...base, dailyLogs: logs });
    expect(review).not.toBeNull();
    expect(review!.focus.toLowerCase()).not.toContain("strength");
    if (review!.continuity) {
      expect(review!.continuity.toLowerCase()).not.toContain("strength");
    }
  });
});
