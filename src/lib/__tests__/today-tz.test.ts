/**
 * #7 — Today timezone consistency.
 *
 * Bug: the Today UI derived its date-keys and "now" from the DEVICE clock
 * (`new Date()`, `nowMinutes()`), while the engine + storage derive theirs
 * from the user's SAVED zone (`getTz(settings)` via tz.ts). Near midnight
 * after a device-tz change (a flight), the two could disagree by a calendar
 * day — and that day-key drives which day's log is READ and WRITTEN. So the
 * UI could show / mutate the wrong day's log. Latent, traveler-only,
 * data-loss-class.
 *
 * Fix: Today now derives every date-key and "now" from getTz(settings) too —
 * the exact same tz helpers the engine uses. These tests pin two things:
 *   1. currentBlock() accepts an injected, tz-aware `now` (new signature)
 *      and is backward-compatible when called without one.
 *   2. The exact expressions Today now uses follow settings.timezone, agree
 *      with the engine, and — critically — are byte-identical to the old
 *      device-based formulas when the device zone equals the saved zone
 *      (the common case → zero regression).
 */
import { describe, it, expect } from "vitest";
import { currentBlock, isOvernight, nowMinutes } from "@/lib/time";
import {
  getTz,
  deviceTz,
  dateKeyInTz,
  dayIndexOfKeyInTz,
  addDaysToKey,
  nowMinutesInTz,
} from "@/lib/tz";

// A normal day: wake 7:00, bed 23:00 → dayLength 960, nightLength 480.
const S = { wakeTime: "07:00", bedtime: "23:00" };

describe("#7 currentBlock — injectable tz-aware now", () => {
  it("maps an explicit `now` (minutes since local midnight) to the block", () => {
    // Clock-based: Morning 5:00–11:59, Afternoon 12:00–16:59, else Evening.
    expect(currentBlock(S, 8 * 60)).toBe("morning"); // 8:00am
    expect(currentBlock(S, 13 * 60)).toBe("afternoon"); // 1:00pm
    expect(currentBlock(S, 21 * 60 + 30)).toBe("evening"); // 9:30pm
    expect(currentBlock(S, 1 * 60)).toBe("evening"); // 1:00am — late-night tail
    expect(currentBlock(S, 5 * 60 + 30)).toBe("morning"); // 5:30am
  });

  it("is backward-compatible called WITHOUT a now (defaults to device nowMinutes)", () => {
    // Calling with no second arg must still return a valid block — the
    // default param preserves every existing 1-arg call site.
    const block = currentBlock(S);
    expect(["morning", "afternoon", "evening"]).toContain(block);
    // And it equals the explicit device-now form it defaults to.
    expect(currentBlock(S)).toBe(currentBlock(S, nowMinutes()));
  });

  it("the actual Today expression picks the user's local block, not the device's", () => {
    // 2026-05-05T12:34:56Z. For a user whose SAVED zone is New York this is
    // 8:34 AM (→ morning). A device sitting in Tokyo reads 21:34 (→ evening).
    const when = new Date("2026-05-05T12:34:56Z");
    const userBlock = currentBlock(
      S,
      nowMinutesInTz(getTz({ timezone: "America/New_York" }), when)
    );
    const deviceBlockIfTokyo = currentBlock(
      S,
      nowMinutesInTz("Asia/Tokyo", when)
    );
    expect(userBlock).toBe("morning"); // correct — follows saved zone
    expect(deviceBlockIfTokyo).toBe("evening"); // the OLD device-based bug
    expect(userBlock).not.toBe(deviceBlockIfTokyo);
  });

  it("isOvernight also honors an injected tz-aware now", () => {
    expect(isOvernight(S, 1 * 60)).toBe(true); // 1:00 — dead of night
    expect(isOvernight(S, 5 * 60 + 30)).toBe(false); // 5:30 — pre-dawn run-up
    expect(isOvernight(S, 9 * 60)).toBe(false); // 9:00 — awake day
    // tz-aware: same instant is "overnight" for the saved zone but not the device.
    const when = new Date("2026-05-05T05:00:00Z"); // 1:00 AM in NY, 14:00 in Tokyo
    expect(isOvernight(S, nowMinutesInTz("America/New_York", when))).toBe(true);
    expect(isOvernight(S, nowMinutesInTz("Asia/Tokyo", when))).toBe(false);
  });
});

describe("#7 Today date-keys follow settings.timezone (match the engine)", () => {
  it("todayKey is the SAVED-zone day, not the device/UTC day", () => {
    // 2026-04-01T03:00:00Z = 11:00 PM March 31 in New York, but already
    // April 1 in UTC and Tokyo. The engine/storage write to the NY day; the
    // OLD Today read the device day → off by one near midnight after a flight.
    const when = new Date("2026-04-01T03:00:00Z");
    const todayKey = dateKeyInTz(getTz({ timezone: "America/New_York" }), when);
    expect(todayKey).toBe("2026-03-31"); // agrees with engine/storage
    // What a device in another zone would have produced (the bug):
    expect(dateKeyInTz("Asia/Tokyo", when)).toBe("2026-04-01");
    expect(dateKeyInTz("UTC", when)).toBe("2026-04-01");
  });

  it("selectedDate (addDaysToKey from todayKey) stays in the saved zone", () => {
    const when = new Date("2026-04-01T03:00:00Z"); // NY: Mar 31
    const tz = getTz({ timezone: "America/New_York" });
    const todayKey = dateKeyInTz(tz, when);
    expect(addDaysToKey(todayKey, 0)).toBe("2026-03-31"); // offset 0 = today
    expect(addDaysToKey(todayKey, -1)).toBe("2026-03-30"); // yesterday
    expect(addDaysToKey(todayKey, -7)).toBe("2026-03-24"); // a week back
  });

  it("selDayIdx (dayIndexOfKeyInTz) is the saved-zone weekday, Mon=0..Sun=6", () => {
    // 2026-03-31 is a Tuesday → index 1 in the Mon=0 convention the app uses.
    const tz = getTz({ timezone: "America/New_York" });
    const key = dateKeyInTz(tz, new Date("2026-04-01T03:00:00Z"));
    expect(key).toBe("2026-03-31");
    expect(dayIndexOfKeyInTz(tz, key)).toBe(1); // Tue
  });

  it("getTz passes a valid saved zone straight through (Today === engine)", () => {
    const when = new Date("2026-04-01T03:00:00Z");
    // Today calls dateKeyInTz(getTz(settings)); the engine calls the same.
    expect(dateKeyInTz(getTz({ timezone: "America/New_York" }), when)).toBe(
      dateKeyInTz("America/New_York", when)
    );
  });
});

describe("#7 zero regression when device zone === saved zone (common case)", () => {
  // Whatever zone the test runner is in, simulate "settings.timezone matches
  // the device" and prove the NEW tz-helper expressions are byte-identical to
  // the OLD device-based formulas they replaced.
  const dev = deviceTz();
  const when = new Date("2026-05-05T15:34:56Z"); // arbitrary fixed instant

  it("dateKeyInTz(deviceTz) === the old device-local YYYY-MM-DD", () => {
    const oldKey = `${when.getFullYear()}-${String(
      when.getMonth() + 1
    ).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
    expect(dateKeyInTz(dev, when)).toBe(oldKey);
  });

  it("nowMinutesInTz(deviceTz) === the old device nowMinutes math", () => {
    const oldNow = when.getHours() * 60 + when.getMinutes();
    expect(nowMinutesInTz(dev, when)).toBe(oldNow);
  });

  it("dayIndexOfKeyInTz(deviceTz, key) === the old getDay()+Mon=0 conversion", () => {
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(when.getDate()).padStart(2, "0")}`;
    const j = new Date(key + "T00:00:00").getDay(); // old: local parse
    const oldIdx = j === 0 ? 6 : j - 1; // old: Mon=0 conversion
    expect(dayIndexOfKeyInTz(dev, key)).toBe(oldIdx);
  });

  it("currentBlock with the device-tz now === the old device-now block", () => {
    const oldNow = when.getHours() * 60 + when.getMinutes();
    expect(currentBlock(S, nowMinutesInTz(dev, when))).toBe(
      currentBlock(S, oldNow)
    );
  });
});
