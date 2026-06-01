/**
 * Clock-based day blocks.
 *
 * Waking hours are split by the CLOCK — Morning before noon, Afternoon
 * noon–5pm, Evening 5pm until bedtime — independent of wake time. The small
 * hours (past bedtime, before the next wake) defer to the sleep schedule,
 * since only that can tell a late-night wind-down from a pre-dawn run-up. A
 * behavior is filed under the section matching its time, and the live "NOW"
 * block uses the same rule, so the header and the time under it can't
 * contradict.
 *
 * Regression target: "Zone 2 movement · 11:30 AM" was filed under an
 * "AFTERNOON" header for an early riser, because its block was a static
 * catalog tag ("afternoon") while its time was wake+5h (11:30 for a 6:30
 * wake). Now the block follows the clock time, so 11:30 → Morning.
 */
import { describe, it, expect } from "vitest";
import { blockForMinutes, currentBlock, inQuietHours } from "@/lib/time";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

const HM = (h: number, m = 0) => h * 60 + m;
// Wide-awake schedule so daytime clock times are clearly in the awake window.
const AWAKE = { wakeTime: "05:00", bedtime: "23:00" };
const NORMAL = { wakeTime: "07:00", bedtime: "22:30" };
const NIGHT_OWL = { wakeTime: "09:00", bedtime: "01:00" };

describe("blockForMinutes — clock through the waking day", () => {
  it("splits the waking day by the clock", () => {
    expect(blockForMinutes(HM(5, 0), AWAKE)).toBe("morning"); // 5:00am
    expect(blockForMinutes(HM(11, 59), AWAKE)).toBe("morning"); // 11:59am
    expect(blockForMinutes(HM(12, 0), AWAKE)).toBe("afternoon"); // noon
    expect(blockForMinutes(HM(16, 59), AWAKE)).toBe("afternoon"); // 4:59pm
    expect(blockForMinutes(HM(17, 0), AWAKE)).toBe("evening"); // 5:00pm
    expect(blockForMinutes(HM(22, 0), AWAKE)).toBe("evening"); // 10:00pm
  });

  it("5am is morning (the start of the day), never evening", () => {
    expect(blockForMinutes(HM(5, 0), NORMAL)).toBe("morning");
    expect(blockForMinutes(HM(5, 0), AWAKE)).toBe("morning");
  });

  it("normalizes wrapped / out-of-range minutes", () => {
    expect(blockForMinutes(HM(13), NORMAL)).toBe("afternoon");
    expect(blockForMinutes(HM(13) + 1440, NORMAL)).toBe("afternoon"); // wraps
  });
});

describe("blockForMinutes — the small hours defer to the sleep schedule", () => {
  it("a wind-down BEFORE bedtime reads as evening, even past midnight", () => {
    // Night owl, still up at 12:30am with a 1:00am bedtime — their evening.
    expect(blockForMinutes(HM(0, 30), NIGHT_OWL)).toBe("evening");
  });

  it("the dead of night just after bed is the evening wind-down tail", () => {
    expect(blockForMinutes(HM(2, 0), NORMAL)).toBe("evening"); // 2am, after 10:30pm bed
  });

  it("pre-dawn, approaching wake, reads as morning", () => {
    expect(blockForMinutes(HM(6, 0), NORMAL)).toBe("morning"); // 6am, before 7am wake
    expect(blockForMinutes(HM(8, 0), NIGHT_OWL)).toBe("morning"); // 8am, before 9am wake
  });
});

describe("currentBlock — clock-based, independent of wake time", () => {
  it("the same clock minute yields the same block for any wake/bed schedule", () => {
    const early = { wakeTime: "05:00", bedtime: "21:00" };
    const late = { wakeTime: "10:00", bedtime: "02:00" };
    // 11:30am is Morning for BOTH, despite very different schedules — the
    // old wake-anchored model would have called it Afternoon for the early
    // riser (5+ hours after a 5am wake).
    expect(currentBlock(early, HM(11, 30))).toBe("morning");
    expect(currentBlock(late, HM(11, 30))).toBe("morning");
    expect(currentBlock(early, HM(12, 30))).toBe("afternoon");
    expect(currentBlock(late, HM(12, 30))).toBe("afternoon");
    expect(currentBlock(early, HM(18))).toBe("evening");
  });
});

describe("compileTimeline — behaviors are filed by their clock time (the Zone 2 fix)", () => {
  function zone2(state: AppState) {
    // dayIndex 0 = Monday; Zone 2 has no daysActive restriction.
    return compileTimeline(state, 0).find((i) => i.canonicalKey === "zone2");
  }

  it("early riser: Zone 2 (wake 6:30 + 5h = 11:30am) sits under MORNING", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "06:30", bedtime: "22:30" },
    };
    const z = zone2(state);
    expect(z).toBeTruthy();
    expect(z!.block).toBe("morning"); // 11:30am → morning by the clock
    // The catalog recommendation is untouched — only the display block moved.
    expect(z!.recommendedBlock).toBe("afternoon");
  });

  it("normal riser: Zone 2 (wake 8:00 + 5h = 1:00pm) sits under AFTERNOON", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "08:00", bedtime: "23:00" },
    };
    expect(zone2(state)!.block).toBe("afternoon"); // 1:00pm
  });

  it("an explicit user block move is honored over the clock", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "06:30", bedtime: "22:30" },
      // User dragged Zone 2 to the evening section — their choice wins even
      // though its time (11:30am) is clock-morning.
      behaviorOverrides: { ...base.behaviorOverrides, zone2: { block: "evening" } },
    };
    expect(zone2(state)!.block).toBe("evening");
  });

  it("honors a move INTO the recommended block (no snap-back)", () => {
    // Regression: Zone 2 clock-derives to Morning for a 6:30 riser; dragging
    // it to its recommended Afternoon used to snap straight back because the
    // guard keyed on block!==recommendedBlock. Now an explicit pin sticks.
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "06:30", bedtime: "22:30" },
      behaviorOverrides: { ...base.behaviorOverrides, zone2: { block: "afternoon" } },
    };
    const z = zone2(state);
    expect(z!.block).toBe("afternoon"); // pinned, not re-derived to morning
    expect(z!.blockPinned).toBe(true);
  });

  it("a customTime (no block pin) follows the clock and sorts by wake-relative time", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "07:00", bedtime: "22:30" },
      // Zone 2 retimed to 1:00am — a custom TIME, not a block pin.
      behaviorOverrides: { ...base.behaviorOverrides, zone2: { customTime: "01:00" } },
    };
    const tl = compileTimeline(state, 0);
    const z = tl.find((i) => i.canonicalKey === "zone2");
    // Block follows the custom clock time (1am = evening wind-down tail),
    // NOT pinned to its catalog block.
    expect(z!.block).toBe("evening");
    expect(z!.blockPinned).toBe(false);
    // Wake-relative sort: a 1am item is the LAST thing in the evening block,
    // not the first (raw-clock sort would wrongly float 60min to the top).
    const evening = tl.filter((i) => i.block === "evening");
    expect(evening.length).toBeGreaterThan(1);
    expect(evening[evening.length - 1].canonicalKey).toBe("zone2");
    expect(evening[0].canonicalKey).not.toBe("zone2");
  });
});

describe("inQuietHours — do-not-disturb window (with midnight wrap)", () => {
  const HM2 = (h: number, m = 0) => h * 60 + m;

  it("returns false when there's no window", () => {
    expect(inQuietHours(HM2(3), undefined)).toBe(false);
    expect(inQuietHours(HM2(3), { start: "22:00", end: "22:00" })).toBe(false);
  });

  it("a wrapping window (22:00→07:00) covers the night", () => {
    const qh = { start: "22:00", end: "07:00" };
    expect(inQuietHours(HM2(23), qh)).toBe(true); // 11pm
    expect(inQuietHours(HM2(3), qh)).toBe(true); // 3am
    expect(inQuietHours(HM2(6, 59), qh)).toBe(true); // 6:59am
    expect(inQuietHours(HM2(7), qh)).toBe(false); // 7:00am — end exclusive
    expect(inQuietHours(HM2(12), qh)).toBe(false); // noon
    expect(inQuietHours(HM2(21, 59), qh)).toBe(false); // 9:59pm
  });

  it("a same-day window (13:00→14:00) covers only that span", () => {
    const qh = { start: "13:00", end: "14:00" };
    expect(inQuietHours(HM2(13, 30), qh)).toBe(true);
    expect(inQuietHours(HM2(14), qh)).toBe(false); // end exclusive
    expect(inQuietHours(HM2(9), qh)).toBe(false);
  });
});

describe("blockForMinutes — custom block boundaries", () => {
  const CUSTOM = {
    wakeTime: "05:00",
    bedtime: "23:00",
    blockBoundaries: { morning: "06:00", afternoon: "13:00", evening: "18:00" },
  };
  it("honors ascending custom boundaries", () => {
    expect(blockForMinutes(HM(12, 30), CUSTOM)).toBe("morning"); // before 1pm
    expect(blockForMinutes(HM(13, 0), CUSTOM)).toBe("afternoon");
    expect(blockForMinutes(HM(17, 30), CUSTOM)).toBe("afternoon"); // before 6pm
    expect(blockForMinutes(HM(18, 0), CUSTOM)).toBe("evening");
  });
  it("falls back to the 5am/12pm/5pm defaults when not ascending", () => {
    const BAD = {
      wakeTime: "05:00",
      bedtime: "23:00",
      blockBoundaries: { morning: "13:00", afternoon: "12:00", evening: "18:00" },
    };
    expect(blockForMinutes(HM(12, 30), BAD)).toBe("afternoon"); // default noon
    expect(blockForMinutes(HM(17, 30), BAD)).toBe("evening"); // default 5pm
  });
});

describe("compileTimeline — manual reorder via sortIndex", () => {
  it("a negative sortIndex floats a behavior to the top of its block", () => {
    const base = getDefaultState();
    const state: AppState = {
      ...base,
      installedPacks: ["longevity-foundation"],
      settings: { ...base.settings, wakeTime: "07:00", bedtime: "22:30" },
    };
    const morning = compileTimeline(state, 0)
      .filter((i) => i.block === "morning")
      .map((i) => i.canonicalKey);
    expect(morning.length).toBeGreaterThan(1);
    const target = morning[morning.length - 1]; // last by clock
    const moved: AppState = {
      ...state,
      behaviorOverrides: {
        ...base.behaviorOverrides,
        [target]: { sortIndex: -10 },
      },
    };
    const reordered = compileTimeline(moved, 0)
      .filter((i) => i.block === "morning")
      .map((i) => i.canonicalKey);
    expect(reordered[0]).toBe(target); // now first
  });
});
