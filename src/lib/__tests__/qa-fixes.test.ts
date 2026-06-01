/**
 * Regression tests for the 6 Round-3 deferred fixes that carry logic:
 *   #3 — interactions appear in the publish diff (add / remove / change).
 *   #6 — suggestions() gates the chronic-skip retime nag on PACK tenure,
 *        not raw account age, so a freshly-installed pack on an old account
 *        isn't nagged while a genuinely chronically-skipped slot still is.
 */
import { describe, it, expect } from "vitest";
import type { AppState, DailyLog, Interaction } from "@/lib/types";
import { getDefaultState, toggleBehavior } from "@/lib/storage";
import { compileTimeline } from "@/lib/engine";
import { suggestions, behaviorStats } from "@/lib/intel";
import { mergeStates } from "@/lib/datasource";
import { buildCatalogBundle, diffBundles } from "@/lib/cms/publish";
import {
  getTz,
  dateKeyInTz,
  addDaysToKey,
  dayIndexOfKeyInTz,
} from "@/lib/tz";

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

// ── Round-4: sync merge keeps per-field detail (no whole-array clobber) ──
describe("sync merge — per-field, no data loss", () => {
  const dayWith = (date: string, over: Partial<DailyLog>): DailyLog =>
    ({ ...mkLog(date, {}, 50), ...over }) as unknown as DailyLog;

  it("keeps distinct exercise entries logged on different devices", () => {
    const cloud = { ...getDefaultState() };
    const local = { ...getDefaultState() };
    cloud.dailyLogs = [
      dayWith("2026-05-20", {
        exerciseEntries: [
          {
            itemId: "run",
            completed: true,
            durationMinutes: 45,
            intensity: 3,
            feeling: 5,
            note: "great run",
          },
        ],
      }),
    ];
    local.dailyLogs = [
      dayWith("2026-05-20", {
        exerciseEntries: [
          {
            itemId: "lift",
            completed: true,
            durationMinutes: 30,
            intensity: 2,
            feeling: 4,
            note: "",
          },
        ],
      }),
    ];
    const day = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!;
    expect(day.exerciseEntries.map((e) => e.itemId).sort()).toEqual([
      "lift",
      "run",
    ]);
    // The losing side's per-entry detail survives.
    expect(
      day.exerciseEntries.find((e) => e.itemId === "run")?.durationMinutes
    ).toBe(45);
  });

  it("field-merges the nutrition scorecard (distinct answers survive)", () => {
    const empty = mkLog("x", {}, 0).nutritionScorecard;
    const cloud = { ...getDefaultState() };
    const local = { ...getDefaultState() };
    cloud.dailyLogs = [
      dayWith("2026-05-20", {
        nutritionScorecard: { ...empty, hitProteinTarget: "yes" },
      }),
    ];
    local.dailyLogs = [
      dayWith("2026-05-20", {
        nutritionScorecard: { ...empty, stayedHydrated: "yes" },
      }),
    ];
    const sc = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!.nutritionScorecard;
    expect(sc.hitProteinTarget).toBe("yes");
    expect(sc.stayedHydrated).toBe("yes");
  });
});

// ── Round-4: interaction identity includes condition (no diff collision) ──
describe("publish diff — interaction identity", () => {
  const withInteractions = (xs: Interaction[]) => ({
    ...buildCatalogBundle(3),
    interactions: xs,
  });
  it("treats condition-distinct interactions as separate, not collapsed", () => {
    const next = withInteractions([
      { aKey: "creatine", bKey: "sleep", type: "timing", severity: "soft", nudge: "n" },
      {
        aKey: "creatine",
        bKey: "sleep",
        type: "timing",
        severity: "soft",
        nudge: "n",
        condition: { goal: "muscle" },
      },
    ]);
    const d = diffBundles(withInteractions([]), next);
    expect(d.interactionsAdded).toHaveLength(2); // both survive the identity key
    expect(new Set(d.interactionsAdded.map((i) => i.key)).size).toBe(2);
  });
});

// ── Sync recency: updatedAt resolves genuine conflicts (un-check) ──
describe("sync merge — recency via updatedAt", () => {
  const logAt = (
    date: string,
    completions: Record<string, boolean>,
    updatedAt: string,
    score = 50
  ): DailyLog =>
    ({ ...mkLog(date, completions, score), updatedAt }) as unknown as DailyLog;
  const stateWith = (log: DailyLog): AppState => ({
    ...getDefaultState(),
    dailyLogs: [log],
  });

  it("keeps a behavior un-checked on the NEWER device (no resurrection)", () => {
    // cloud (a) older = done; local (b) newer = un-done. Newer wins.
    const cloud = stateWith(
      logAt("2026-05-20", { meditate: true }, "2026-05-20T08:00:00.000Z", 50)
    );
    const local = stateWith(
      logAt("2026-05-20", { meditate: false }, "2026-05-20T09:00:00.000Z", 0)
    );
    const day = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!;
    expect(day.behaviorCompletions?.meditate).toBe(false);
    expect(day.score).toBe(0); // score follows the newer side, not Math.max
  });

  it("honors whichever side is newer, regardless of local/cloud position", () => {
    const cloud = stateWith(
      logAt("2026-05-20", { meditate: true }, "2026-05-20T10:00:00.000Z", 50)
    );
    const local = stateWith(
      logAt("2026-05-20", { meditate: false }, "2026-05-20T09:00:00.000Z", 0)
    );
    const day = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!;
    expect(day.behaviorCompletions?.meditate).toBe(true); // cloud newer → wins
  });

  it("falls back to UNION when either side lacks a stamp (legacy unchanged)", () => {
    const cloud = stateWith(mkLog("2026-05-20", { meditate: true }, 50)); // no updatedAt
    const local = stateWith(mkLog("2026-05-20", { meditate: false }, 0));
    const day = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!;
    // OR — never silently drop a completion when recency is unknown.
    expect(day.behaviorCompletions?.meditate).toBe(true);
  });

  it("keeps keys present on only one side (no conflict)", () => {
    const cloud = stateWith(
      logAt("2026-05-20", { a: true }, "2026-05-20T08:00:00.000Z")
    );
    const local = stateWith(
      logAt("2026-05-20", { b: true }, "2026-05-20T09:00:00.000Z")
    );
    const day = mergeStates(local, cloud).dailyLogs.find(
      (l) => l.date === "2026-05-20"
    )!;
    expect(day.behaviorCompletions?.a).toBe(true);
    expect(day.behaviorCompletions?.b).toBe(true);
  });
});

// ── Cloud-wins load path: merge preserves un-pushed local NON-log edits ──
// The dirty-aware load path calls mergeStates(local, cloud) when local has
// un-pushed edits. These prove the combiner keeps those edits (the data the
// old raw cloud-overwrite silently discarded). (The load() wiring itself
// needs a live Supabase session and is exercised on staging.)
describe("sync merge — un-pushed local non-log slices survive", () => {
  it("keeps a locally-installed pack the cloud doesn't have yet", () => {
    const cloud: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const local: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation", "better-sleep"],
    };
    const merged = mergeStates(local, cloud);
    expect(merged.installedPacks).toContain("better-sleep"); // local-only kept
    expect(merged.installedPacks).toContain("longevity-foundation");
  });

  it("keeps a local settings scalar edit (local wins on conflict)", () => {
    const cloud: AppState = {
      ...getDefaultState(),
      settings: { ...getDefaultState().settings, name: "CloudName" },
    };
    const local: AppState = {
      ...getDefaultState(),
      settings: { ...getDefaultState().settings, name: "LocalEdit" },
    };
    expect(mergeStates(local, cloud).settings.name).toBe("LocalEdit");
  });

  it("unions biomarkers + behaviorOverrides from both sides", () => {
    const cloud: AppState = {
      ...getDefaultState(),
      biomarkers: [{ id: "bm-cloud" }] as unknown as AppState["biomarkers"],
      behaviorOverrides: {
        kCloud: { disabled: true },
      } as unknown as AppState["behaviorOverrides"],
    };
    const local: AppState = {
      ...getDefaultState(),
      biomarkers: [{ id: "bm-local" }] as unknown as AppState["biomarkers"],
      behaviorOverrides: {
        kLocal: { disabled: true },
      } as unknown as AppState["behaviorOverrides"],
    };
    const merged = mergeStates(local, cloud);
    expect(merged.biomarkers.map((b) => b.id).sort()).toEqual([
      "bm-cloud",
      "bm-local",
    ]);
    expect(Object.keys(merged.behaviorOverrides).sort()).toEqual([
      "kCloud",
      "kLocal",
    ]);
  });
});

describe("storage — mutations stamp updatedAt", () => {
  it("toggleBehavior stamps the day's log so merge can use recency", () => {
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const next = toggleBehavior(st, dk(0), "zone2");
    const log = next.dailyLogs.find((l) => l.date === dk(0))!;
    expect(typeof log.updatedAt).toBe("string");
    expect(log.behaviorCompletions?.zone2).toBe(true);
  });
});

// ── Round-4: per-behavior streak skips non-scheduled days ──
describe("behaviorStats — scheduled-day streak", () => {
  it("does not reset a non-daily behavior's streak on its OFF days", () => {
    const tz = getTz(getDefaultState().settings);
    const wToday = dayIndexOfKeyInTz(tz, dk(0));
    const wPrev = dayIndexOfKeyInTz(tz, dk(2));
    // Schedule only today's + two-days-ago weekdays; yesterday is an off-day.
    const daysActive = [false, false, false, false, false, false, false];
    daysActive[wToday] = true;
    daysActive[wPrev] = true;
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: { zone2: { daysActive } } as AppState["behaviorOverrides"],
      // done on both scheduled days; the off-day (yesterday) is simply absent.
      dailyLogs: [
        mkLog(dk(2), { zone2: true }, 60),
        mkLog(dk(0), { zone2: true }, 60),
      ],
    };
    // Streak = 2 (today + two-days-ago); the unscheduled off-day between them
    // is transparent rather than a reset. (Pre-fix this returned 1.)
    expect(behaviorStats(st, "zone2").streak).toBe(2);
  });
});
