/**
 * Clock-based day blocks.
 *
 * The day is split by the CLOCK — Morning before noon, Afternoon noon–5pm,
 * Evening 5pm onward — NOT by wake time. A behavior is filed under the
 * section that matches the actual clock time it resolves to, and the live
 * "NOW" block uses the same split, so the section header and the time shown
 * under it can never contradict.
 *
 * Regression target: "Zone 2 movement · 11:30 AM" was filed under an
 * "AFTERNOON" header for an early riser, because its block was a static
 * catalog tag ("afternoon") while its time was wake+5h (11:30 for a 6:30
 * wake). Now the block follows the clock time, so 11:30 → Morning.
 */
import { describe, it, expect } from "vitest";
import { blockForMinutes, currentBlock } from "@/lib/time";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

const HM = (h: number, m = 0) => h * 60 + m;

describe("blockForMinutes — clock boundaries", () => {
  it("splits the day by the clock", () => {
    expect(blockForMinutes(HM(5, 0))).toBe("morning"); // 5:00am
    expect(blockForMinutes(HM(11, 59))).toBe("morning"); // 11:59am
    expect(blockForMinutes(HM(12, 0))).toBe("afternoon"); // 12:00pm
    expect(blockForMinutes(HM(16, 59))).toBe("afternoon"); // 4:59pm
    expect(blockForMinutes(HM(17, 0))).toBe("evening"); // 5:00pm
    expect(blockForMinutes(HM(23, 0))).toBe("evening"); // 11:00pm
  });

  it("treats the late-night tail (before 5am) as evening wind-down", () => {
    expect(blockForMinutes(HM(0, 30))).toBe("evening"); // 12:30am
    expect(blockForMinutes(HM(4, 59))).toBe("evening"); // 4:59am
  });

  it("normalizes wrapped / out-of-range minutes", () => {
    expect(blockForMinutes(HM(13))).toBe("afternoon");
    expect(blockForMinutes(HM(13) + 1440)).toBe("afternoon"); // wraps a day
    expect(blockForMinutes(-30)).toBe("evening"); // 11:30pm previous day
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
});
