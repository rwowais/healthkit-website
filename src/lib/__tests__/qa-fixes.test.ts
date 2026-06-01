/**
 * Regression tests for the 6 Round-3 deferred fixes that carry logic:
 *   #3 — interactions appear in the publish diff (add / remove / change).
 *   #6 — suggestions() gates the chronic-skip retime nag on PACK tenure,
 *        not raw account age, so a freshly-installed pack on an old account
 *        isn't nagged while a genuinely chronically-skipped slot still is.
 */
import { describe, it, expect } from "vitest";
import type { AppState, DailyLog, Interaction } from "@/lib/types";
import { getDefaultState } from "@/lib/storage";
import { compileTimeline } from "@/lib/engine";
import { suggestions } from "@/lib/intel";
import { buildCatalogBundle, diffBundles } from "@/lib/cms/publish";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";

const TODAY = dateKeyInTz(getTz(getDefaultState().settings));
const dk = (off: number) => addDaysToKey(TODAY, -off);

function mkLog(
  date: string,
  done: Record<string, boolean>,
  score: number
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
    behaviorCompletions: done,
    score,
  } as unknown as DailyLog;
}

// ── #3: interactions in the publish diff ───────────────────────────────
describe("#3 publish diff — interactions", () => {
  const inter = (
    aKey: string,
    bKey: string,
    type: Interaction["type"],
    severity: Interaction["severity"],
    nudge = "note"
  ): Interaction => ({ aKey, bKey, type, severity, nudge });

  const withInteractions = (xs: Interaction[]) => ({
    ...buildCatalogBundle(3),
    interactions: xs,
  });

  it("detects an added interaction", () => {
    const prev = withInteractions([]);
    const next = withInteractions([
      inter("caffeine", "sleep", "timing", "firm"),
    ]);
    const d = diffBundles(prev, next);
    expect(d.interactionsAdded).toHaveLength(1);
    expect(d.interactionsRemoved).toHaveLength(0);
    expect(d.interactionsChanged).toHaveLength(0);
    expect(d.interactionsAdded[0]).toMatchObject({
      aKey: "caffeine",
      bKey: "sleep",
      type: "timing",
    });
    expect(d.hasChanges).toBe(true);
  });

  it("detects a removed interaction", () => {
    const prev = withInteractions([
      inter("caffeine", "sleep", "timing", "firm"),
    ]);
    const next = withInteractions([]);
    const d = diffBundles(prev, next);
    expect(d.interactionsRemoved).toHaveLength(1);
    expect(d.interactionsAdded).toHaveLength(0);
  });

  it("flags a severity flip as a CHANGE, not add+remove", () => {
    // soft → firm on the same (aKey,bKey,type) triple. A firm conflict
    // silently mutes a behavior, so this MUST be reviewable before ship.
    const prev = withInteractions([
      inter("caffeine", "sleep", "timing", "soft"),
    ]);
    const next = withInteractions([
      inter("caffeine", "sleep", "timing", "firm"),
    ]);
    const d = diffBundles(prev, next);
    expect(d.interactionsChanged).toHaveLength(1);
    expect(d.interactionsAdded).toHaveLength(0);
    expect(d.interactionsRemoved).toHaveLength(0);
  });

  it("identical interactions produce no interaction diff", () => {
    const xs = [inter("caffeine", "sleep", "timing", "firm")];
    const d = diffBundles(withInteractions(xs), withInteractions([...xs]));
    expect(d.interactionsAdded).toHaveLength(0);
    expect(d.interactionsRemoved).toHaveLength(0);
    expect(d.interactionsChanged).toHaveLength(0);
  });
});

// ── #6: pack-tenure gate on the chronic-skip retime nag ─────────────────
describe("#6 suggestions — pack-tenure gate", () => {
  it("does NOT nag a freshly-installed pack on a long-lived account", () => {
    // Account is well past 21 days and active (score>0 daily), but the
    // ONLY engagement is an unrelated key — none of the installed pack's
    // behaviors have ever been completed, so the pack looks brand-new.
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 25; i++)
      logs.push(mkLog(dk(i), { "unrelated:activity": true }, 60));
    const sug = suggestions({ ...st, dailyLogs: logs });
    const retime = sug.find((s) => s.action.type === "retime");
    expect(retime).toBeUndefined();
  });

  it("STILL nags a chronically-skipped slot in an established pack", () => {
    // Same account length, but here the pack is clearly lived-in: every
    // sibling behaviour is completed daily and only one clock-anchored
    // slot is skipped. That slot should be offered as "anytime".
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const items = compileTimeline(st, 0);
    const skip = items.find((i) => i.block !== "anytime")!;
    const others = Object.fromEntries(
      items
        .filter((i) => i.canonicalKey !== skip.canonicalKey)
        .map((i) => [i.canonicalKey, true])
    );
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 21; i++) logs.push(mkLog(dk(i), { ...others }, 60));
    const sug = suggestions({ ...st, dailyLogs: logs });
    const retime = sug.find((s) => s.action.type === "retime");
    expect(retime).toBeTruthy();
    expect(retime!.action).toMatchObject({
      type: "retime",
      key: skip.canonicalKey,
    });
  });
});
