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
import {
  compileTimeline,
  adapt,
  effectiveKey,
  masteredKeys,
} from "@/lib/engine";
import { suggestions, behaviorStats } from "@/lib/intel";
import { mergeStates, chooseCloudLoad } from "@/lib/datasource";
import { buildCatalogBundle, diffBundles } from "@/lib/cms/publish";
import {
  getTz,
  dateKeyInTz,
  addDaysToKey,
  dayIndexOfKeyInTz,
} from "@/lib/tz";
import { nudgeTimeWithinBlock } from "@/lib/time";

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

// ── Move earlier/later nudges the time, clamped to the block ──
describe("nudgeTimeWithinBlock", () => {
  const settings = { wakeTime: "07:00", bedtime: "22:30" }; // default bounds
  it("steps the time by the delta", () => {
    expect(nudgeTimeWithinBlock(19 * 60, "evening", 15, settings)).toBe("19:15");
    expect(nudgeTimeWithinBlock(19 * 60, "evening", -15, settings)).toBe("18:45");
  });
  it("clamps to the block's start (can't leave the block earlier)", () => {
    // evening starts 17:00 — nudging earlier from 17:05 stops at 17:00
    expect(nudgeTimeWithinBlock(17 * 60 + 5, "evening", -15, settings)).toBe("17:00");
  });
  it("clamps evening to bedtime (can't push past bed)", () => {
    expect(nudgeTimeWithinBlock(22 * 60 + 20, "evening", 15, settings)).toBe("22:30");
  });
  it("morning stays before the afternoon boundary", () => {
    expect(nudgeTimeWithinBlock(11 * 60 + 55, "morning", 15, settings)).toBe("11:59");
  });
});

// ── Move-to-block re-derives the shown time (no stale clock) ──
describe("move to a block re-derives the displayed time", () => {
  const stWith = (ov: Record<string, unknown>): AppState =>
    ({
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: ov,
    }) as unknown as AppState;

  it("a behavior moved to a different block shows a time INSIDE that block", () => {
    // strength is an afternoon behavior baked at 12:30; moving it to evening
    // must NOT keep 12:30 — it adopts the evening block's start (17:00).
    const item = compileTimeline(stWith({ strength: { block: "evening" } }), 0).find(
      (i) => i.canonicalKey === "strength"
    )!;
    expect(item.block).toBe("evening");
    expect(item.customTime).toBe("17:00");
  });

  it("an explicit specific time still wins over the block default", () => {
    const item = compileTimeline(
      stWith({ strength: { block: "evening", customTime: "20:30" } }),
      0
    ).find((i) => i.canonicalKey === "strength")!;
    expect(item.customTime).toBe("20:30");
  });

  it("leaves the baked time intact when NOT moved", () => {
    const item = compileTimeline(stWith({}), 0).find(
      (i) => i.canonicalKey === "strength"
    )!;
    // Catalog order swap (2026-07-12): strength bakes at wake+5h = 11:30 for
    // this fixture's wake, which clock-files under MORNING. Still "unchanged"
    // — no override, block derived purely from the baked time.
    expect(item.block).toBe("morning");
  });
});

// ── Pause reversibility: a paused behavior must stay findable so it can be
//    resumed. The normal compile drops it; a management surface passes
//    { includeDisabled: true } to render it dimmed with a working Resume. ──
describe("paused behaviors remain findable (audit 2026-06-09)", () => {
  const stWith = (ov: Record<string, unknown>): AppState =>
    ({
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: ov,
    }) as unknown as AppState;

  it("the normal compile drops a paused behavior entirely", () => {
    const tl = compileTimeline(stWith({ strength: { disabled: true } }), 0);
    expect(tl.find((i) => i.canonicalKey === "strength")).toBeUndefined();
  });

  it("includeDisabled keeps it, flagged disabled, so Resume is reachable", () => {
    const tl = compileTimeline(
      stWith({ strength: { disabled: true } }),
      0,
      undefined,
      { includeDisabled: true }
    );
    const item = tl.find((i) => i.canonicalKey === "strength");
    expect(item, "paused behavior should be present under includeDisabled").toBeTruthy();
    expect(item!.disabled).toBe(true);
  });

  it("an active behavior is never flagged disabled under includeDisabled", () => {
    const tl = compileTimeline(stWith({}), 0, undefined, {
      includeDisabled: true,
    });
    const item = tl.find((i) => i.canonicalKey === "strength");
    expect(item).toBeTruthy();
    expect(item!.disabled).toBeFalsy();
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

// ── The cloud-present load DECISION (chooseCloudLoad) ──
describe("chooseCloudLoad — dirty merges, clean takes cloud", () => {
  it("clean local → returns the cloud state verbatim (cloud-wins)", () => {
    const cloud: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const local: AppState = {
      ...getDefaultState(),
      // a local-only pack that a clean (already-synced) load must NOT keep —
      // proving deletions/divergence from another device still propagate.
      installedPacks: ["longevity-foundation", "stale-local"],
    };
    expect(chooseCloudLoad(local, cloud, false)).toBe(cloud); // exact cloud
  });

  it("dirty local → merges so un-pushed local edits survive", () => {
    const cloud: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
    };
    const local: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation", "better-sleep"],
      settings: { ...getDefaultState().settings, name: "LocalEdit" },
    };
    const out = chooseCloudLoad(local, cloud, true);
    expect(out.installedPacks).toContain("better-sleep"); // un-pushed survives
    expect(out.settings.name).toBe("LocalEdit");
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

// ── Mastery honors a weekend-only OVERRIDE schedule (R1 #214) ──
describe("masteredKeys — weekend-only override can graduate", () => {
  it("graduates an official behavior re-scheduled weekend-only via behaviorOverrides", () => {
    const tz = getTz(getDefaultState().settings);
    // Sat/Sun only (Mon=0..Sun=6).
    const weekendOnly = [false, false, false, false, false, true, true];
    const logs: DailyLog[] = [];
    // ~230 days of history: zone2 completed every weekend (its scheduled days),
    // plus weekday activity so the ≥14-engaged-days gate is satisfied. Weekdays
    // are NOT scheduled for zone2, so they're transparent to the streak walk.
    for (let i = 0; i <= 230; i++) {
      const day = dk(i);
      const wd = dayIndexOfKeyInTz(tz, day);
      const isWeekend = wd === 5 || wd === 6;
      logs.push(mkLog(day, isWeekend ? { zone2: true } : {}, 60));
    }
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"],
      behaviorOverrides: {
        zone2: { daysActive: weekendOnly },
      } as AppState["behaviorOverrides"],
      dailyLogs: logs,
    };
    // Robust to the deterministic ~1-in-7 weekly spot-check: mastered on at
    // least one of the next 7 days. Pre-fix (catalog-only daysActive) this was
    // false on EVERY day — the weekday streak break meant it could never reach
    // 21 scheduled completions.
    const masteredSomeDay = [0, 1, 2, 3, 4, 5, 6].some((off) =>
      masteredKeys(st, dk(off)).has("zone2")
    );
    expect(masteredSomeDay).toBe(true);
  });
});

// ── Recovery banner only claims work was "set aside" when there is some (R1 #144) ──
describe("recovery banner honesty", () => {
  const poorLog = (date: string): DailyLog =>
    ({
      date,
      sleepCompletions: [],
      exerciseEntries: [],
      nutritionScorecard: { customItems: [], note: "" },
      supplementEntries: [],
      completions: [],
      sleepLog: { sleepQuality: 1 },
      energyLevel: 1,
      moodLevel: null,
      score: 0,
      behaviorCompletions: {},
    }) as unknown as DailyLog;

  it("sleep-only persona in recovery does NOT claim demanding work was set aside", () => {
    const st = {
      ...getDefaultState(),
      installedPacks: ["better-sleep"], // no RECOVERY_DEMOTE behavior
      dailyLogs: [poorLog(dk(0))],
    } as AppState;
    const a = adapt(st);
    expect(a.mode).toBe("recovery");
    expect(a.tone).toContain("Nothing here is high-intensity");
    expect(a.tone).not.toContain("demanding work is set aside");
  });

  it("a persona WITH demotable training keeps the 'set aside' copy", () => {
    const st = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation"], // has zone2 (RECOVERY_DEMOTE)
      dailyLogs: [poorLog(dk(0))],
    } as AppState;
    const a = adapt(st);
    expect(a.mode).toBe("recovery");
    expect(a.tone).toContain("the demanding work is set aside");
  });
});

// ── A poor check-in must not silently re-ease the NEXT, un-rated day, and the
//    banner/mode must not pre-judge a day the user hasn't rated (audit 2026-06-09). ──
describe("recovery read is today-only — no carryover into an un-rated day", () => {
  const emptyLog = (
    date: string,
    over: Partial<DailyLog> = {}
  ): DailyLog =>
    ({
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
      score: 0,
      pillarScores: { sleep: 0, exercise: 0, diet: 0, supplements: 0 },
      behaviorCompletions: {},
      ...over,
    }) as unknown as DailyLog;

  const poor = (date: string) =>
    emptyLog(date, {
      sleepLog: {
        actualBedtime: null,
        actualWakeTime: null,
        sleepQuality: 1,
        sleepDurationMinutes: null,
      },
      energyLevel: 1,
      behaviorCompletions: { zone2: true },
    });

  it("poor check-in YESTERDAY + none today → not recovery/lighter (was: carried over)", () => {
    const state = {
      ...getDefaultState(),
      dailyLogs: [poor(dk(1))],
    } as AppState;
    const mode = adapt(state).mode;
    expect(mode).not.toBe("recovery");
    expect(mode).not.toBe("lighter");
  });

  it("poor check-in TODAY still eases the day (the real signal is respected)", () => {
    const state = {
      ...getDefaultState(),
      dailyLogs: [poor(dk(0))],
    } as AppState;
    expect(["recovery", "lighter"]).toContain(adapt(state).mode);
  });
});

// ── intel must never nag/credit a behavior the engine itself conflict-mutes
//    (the user can't complete it; "make it anytime" can't help) (audit 2026-06-09). ──
describe("suggestions skip conflict-muted behaviors", () => {
  it("offers no retime/pause for a firm-conflict-muted behavior", () => {
    // Fasting (delay-first-meal, from fasted-mornings) firm-conflict-mutes
    // protein-breakfast — the user sees it "Resting today" and can't complete it.
    const st: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation", "fasted-mornings"],
    };
    const items = compileTimeline(st, 0);
    const muted = items.find((i) => effectiveKey(i) === "protein-breakfast");
    expect(muted, "protein-breakfast should be present and muted").toBeTruthy();

    // Establish the packs and chronically skip ONLY the muted slot: complete
    // every other behavior daily for 21 days. Pre-fix this nagged the muted one.
    const others = Object.fromEntries(
      items
        .filter((i) => i.canonicalKey !== muted!.canonicalKey)
        .map((i) => [i.canonicalKey, true])
    );
    const logs: DailyLog[] = [];
    for (let i = 1; i <= 21; i++) logs.push(mkLog(dk(i), { ...others }, 70));

    const sug = suggestions({ ...st, dailyLogs: logs });
    const nag = sug.find(
      (s) =>
        (s.action.type === "retime" || s.action.type === "pause") &&
        (s.action as { key?: string }).key === muted!.canonicalKey
    );
    expect(nag).toBeUndefined();
  });
});
