import { describe, it, expect } from "vitest";
import {
  resolveTimeWindow,
  isWithinWindow,
  clampToWindow,
  minutesToHM,
  windowBlocks,
} from "@/lib/time";
import { compileTimeline } from "@/lib/engine";
import { getDefaultState } from "@/lib/storage";

const settings = { wakeTime: "07:00", bedtime: "22:30" };
// morning light: anchor wake, allowed within 0–120 min of waking (7:00–9:00)
const sunlight = { anchor: "wake", timeWindow: { min: 0, max: 120, strict: true } };
// pre-bed wind-down: anchor bed, allowed in the 4h before bed (18:30–22:30)
const windDown = { anchor: "bed", timeWindow: { min: -240, max: 0, strict: true } };
const free = { anchor: "wake" as const };

describe("time-window helpers", () => {
  it("resolves a wake-anchored window to absolute clock minutes", () => {
    expect(resolveTimeWindow(sunlight, settings)).toEqual({
      lo: 420, // 7:00
      hi: 540, // 9:00
      strict: true,
    });
  });

  it("isWithinWindow: noon is outside morning-light, 8am is inside", () => {
    expect(isWithinWindow(720, sunlight, settings)).toBe(false); // 12:00
    expect(isWithinWindow(480, sunlight, settings)).toBe(true); // 8:00
    expect(isWithinWindow(420, sunlight, settings)).toBe(true); // 7:00 edge
    expect(isWithinWindow(541, sunlight, settings)).toBe(false); // 9:01
  });

  it("clampToWindow snaps an out-of-window time to the nearest edge", () => {
    expect(clampToWindow(720, sunlight, settings)).toBe(540); // 12:00 → 9:00
    expect(clampToWindow(300, sunlight, settings)).toBe(420); // 5:00 → 7:00 (wake)
    expect(clampToWindow(500, sunlight, settings)).toBe(500); // 8:20 unchanged
  });

  it("bed-anchored window resolves + clamps correctly", () => {
    const w = resolveTimeWindow(windDown, settings)!; // bed 22:30 = 1350
    expect(w.lo).toBe(1110); // 18:30
    expect(w.hi).toBe(1350); // 22:30
    expect(clampToWindow(480, windDown, settings)).toBe(1110); // 8am → 18:30
    expect(isWithinWindow(480, windDown, settings)).toBe(false);
  });

  it("no window → unconstrained", () => {
    expect(isWithinWindow(720, free, settings)).toBe(true);
    expect(clampToWindow(720, free, settings)).toBe(720);
    expect(resolveTimeWindow(free, settings)).toBeNull();
  });

  it("minutesToHM formats 24h HH:MM", () => {
    expect(minutesToHM(540)).toBe("09:00");
    expect(minutesToHM(720)).toBe("12:00");
    expect(minutesToHM(1110)).toBe("18:30");
  });

  it("windowBlocks reports which blocks a window spans", () => {
    expect(windowBlocks(sunlight, settings)).toEqual(["morning"]);
    expect(windowBlocks(windDown, settings)).toEqual(["evening"]);
    expect(windowBlocks(free, settings)).toEqual([]);
  });
});

describe("engine: a hard window self-heals a mis-scheduled circadian behavior", () => {
  it("morning sunlight forced to noon (and pinned to afternoon) is filed back under morning, in-window", () => {
    const st = getDefaultState();
    st.installedPacks = ["longevity-foundation"];
    st.settings.wakeTime = "07:00";
    st.settings.bedtime = "22:30";
    // Mangle it exactly like the founder's data: an exact-time pin at noon AND
    // an explicit afternoon block pin.
    st.behaviorOverrides = {
      ...(st.behaviorOverrides ?? {}),
      "morning-sunlight": { customTime: "12:00", block: "afternoon" },
    };
    const tl = compileTimeline(st, 0);
    const sun = tl.find((i) => i.canonicalKey === "morning-sunlight");
    expect(sun).toBeTruthy();
    // Healed back into the morning section, overriding the afternoon pin…
    expect(sun!.block).toBe("morning");
    // …and its effective time clamped to the window's late edge (9:00).
    expect(sun!.customTime).toBe("09:00");
  });

  it("a behavior with no window keeps its (even unusual) custom time + clock block", () => {
    const st = getDefaultState();
    st.installedPacks = ["longevity-foundation"];
    st.settings.wakeTime = "07:00";
    st.settings.bedtime = "22:30";
    // protein-forward first meal has no window — a 2pm custom time is allowed
    // and files under afternoon by the clock (no clamping).
    st.behaviorOverrides = {
      ...(st.behaviorOverrides ?? {}),
      "protein-breakfast": { customTime: "14:00" },
    };
    const tl = compileTimeline(st, 0);
    const meal = tl.find((i) => i.canonicalKey === "protein-breakfast");
    expect(meal).toBeTruthy();
    expect(meal!.customTime).toBe("14:00");
    expect(meal!.block).toBe("afternoon");
  });
});
