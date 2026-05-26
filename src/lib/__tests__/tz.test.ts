/**
 * tz.ts boundary tests — DST transitions, leap year, timezone math.
 *
 * Why this matters:
 *   The original engine used `new Date().getDay()` everywhere, which
 *   reads the device clock and quietly skips a day each March (spring
 *   forward) for users near a DST boundary, and silently shifts an
 *   entire timeline for users who travel.
 *
 *   The tz.ts wrappers use Intl.DateTimeFormat with explicit
 *   timeZone, so DST cliffs become invisible to the engine. These
 *   tests pin that invariant.
 */
import { describe, it, expect } from "vitest";
import {
  getTz,
  isValidTz,
  dateKeyInTz,
  dayIndexInTz,
  nowMinutesInTz,
  dayIndexOfKeyInTz,
  addDaysToKey,
  tzLabel,
} from "@/lib/tz";

describe("tz — basic resolution", () => {
  it("getTz returns the stored timezone when set", () => {
    expect(getTz({ timezone: "America/New_York" })).toBe("America/New_York");
  });

  it("getTz falls back to UTC for unparseable input", () => {
    expect(getTz({ timezone: "Mars/Olympus_Mons" })).not.toBe(
      "Mars/Olympus_Mons"
    );
    // Whatever it returns must be a valid tz.
    expect(isValidTz(getTz({ timezone: "Mars/Olympus_Mons" }))).toBe(true);
  });

  it("isValidTz rejects garbage", () => {
    expect(isValidTz("Not/A/Zone")).toBe(false);
    expect(isValidTz("")).toBe(false);
    expect(isValidTz("America/New_York")).toBe(true);
    expect(isValidTz("UTC")).toBe(true);
  });
});

describe("tz — date keys are timezone-correct", () => {
  it("dateKeyInTz returns the user's local day, not UTC", () => {
    // 2026-04-01T03:00:00Z is 11pm March 31 in New York (UTC-4 DST).
    const when = new Date("2026-04-01T03:00:00Z");
    expect(dateKeyInTz("America/New_York", when)).toBe("2026-03-31");
    expect(dateKeyInTz("Europe/London", when)).toBe("2026-04-01"); // BST
    expect(dateKeyInTz("UTC", when)).toBe("2026-04-01");
  });

  it("dateKeyInTz survives DST spring-forward in New York", () => {
    // 2026 US DST start: March 8, 2am → 3am.
    // 06:30 UTC on March 8, 2026 = 1:30 AM EST (before DST) — same date as before.
    const before = new Date("2026-03-08T06:30:00Z");
    expect(dateKeyInTz("America/New_York", before)).toBe("2026-03-08");
    // 09:00 UTC = 5am EDT (after DST) — still the 8th.
    const after = new Date("2026-03-08T09:00:00Z");
    expect(dateKeyInTz("America/New_York", after)).toBe("2026-03-08");
  });

  it("dateKeyInTz survives DST fall-back in New York", () => {
    // 2026 US DST end: November 1, 2am → 1am.
    // Both 05:30 UTC (1:30am EDT) and 06:30 UTC (1:30am EST) are
    // November 1 in New York — the local day doesn't repeat or skip.
    const before = new Date("2026-11-01T05:30:00Z");
    const after = new Date("2026-11-01T06:30:00Z");
    expect(dateKeyInTz("America/New_York", before)).toBe("2026-11-01");
    expect(dateKeyInTz("America/New_York", after)).toBe("2026-11-01");
  });

  it("dateKeyInTz handles leap day correctly (2028)", () => {
    // 2028-02-29T12:00:00Z is leap day.
    const when = new Date("2028-02-29T12:00:00Z");
    expect(dateKeyInTz("UTC", when)).toBe("2028-02-29");
    expect(dateKeyInTz("America/Los_Angeles", when)).toBe("2028-02-29");
  });

  it("dateKeyInTz handles year boundary", () => {
    // 2026-01-01T00:30:00Z is Dec 31, 7:30pm in New York (UTC-5 standard).
    const when = new Date("2026-01-01T00:30:00Z");
    expect(dateKeyInTz("America/New_York", when)).toBe("2025-12-31");
    expect(dateKeyInTz("UTC", when)).toBe("2026-01-01");
  });
});

describe("tz — weekday index respects timezone", () => {
  it("dayIndexInTz maps Mon=0..Sun=6", () => {
    // 2026-05-04 was a Monday.
    const mon = new Date("2026-05-04T12:00:00Z");
    expect(dayIndexInTz("UTC", mon)).toBe(0); // Mon
    const sun = new Date("2026-05-10T12:00:00Z");
    expect(dayIndexInTz("UTC", sun)).toBe(6); // Sun
  });

  it("dayIndexInTz returns the user's weekday across midnight", () => {
    // 2026-05-05T02:00:00Z is Monday 10pm in New York (UTC-4).
    const when = new Date("2026-05-05T02:00:00Z");
    expect(dayIndexInTz("America/New_York", when)).toBe(0); // Mon
    expect(dayIndexInTz("UTC", when)).toBe(1); // Tue
  });

  it("dayIndexOfKeyInTz is stable for a stored date key", () => {
    // 2026-05-04 is Monday in every reasonable zone.
    expect(dayIndexOfKeyInTz("UTC", "2026-05-04")).toBe(0);
    expect(dayIndexOfKeyInTz("America/New_York", "2026-05-04")).toBe(0);
    expect(dayIndexOfKeyInTz("Asia/Tokyo", "2026-05-04")).toBe(0);
  });
});

describe("tz — now-minutes respects timezone", () => {
  it("nowMinutesInTz returns minutes-since-local-midnight", () => {
    // 2026-05-05T12:34:56Z. In UTC that's 12*60 + 34 = 754.
    const when = new Date("2026-05-05T12:34:56Z");
    expect(nowMinutesInTz("UTC", when)).toBe(12 * 60 + 34);
    // In NY (UTC-4 DST), the local time is 8:34am → 8*60 + 34 = 514.
    expect(nowMinutesInTz("America/New_York", when)).toBe(8 * 60 + 34);
    // In Tokyo (UTC+9), local is 21:34 → 21*60 + 34 = 1294.
    expect(nowMinutesInTz("Asia/Tokyo", when)).toBe(21 * 60 + 34);
  });

  it("nowMinutesInTz handles the DST spring-forward gap", () => {
    // At 06:30 UTC on March 8 2026, it's 1:30am EST (before the jump).
    const before = new Date("2026-03-08T06:30:00Z");
    expect(nowMinutesInTz("America/New_York", before)).toBe(90); // 01:30
    // At 07:30 UTC, the clock has just jumped: 3:30am EDT.
    const after = new Date("2026-03-08T07:30:00Z");
    expect(nowMinutesInTz("America/New_York", after)).toBe(3 * 60 + 30);
  });
});

describe("tz — date arithmetic survives DST", () => {
  it("addDaysToKey doesn't skip or duplicate calendar days across DST", () => {
    expect(addDaysToKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToKey("2026-03-08", 1)).toBe("2026-03-09");
    // Fall-back week
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("addDaysToKey is correct across year boundaries and leap day", () => {
    expect(addDaysToKey("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29"); // leap day
    expect(addDaysToKey("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDaysToKey("2027-02-28", 1)).toBe("2027-03-01"); // non-leap
  });

  it("addDaysToKey supports negative offsets", () => {
    expect(addDaysToKey("2026-05-04", -7)).toBe("2026-04-27");
    expect(addDaysToKey("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("tz — labels for surfaces", () => {
  it("tzLabel formats human-readable string", () => {
    const label = tzLabel("America/New_York", new Date("2026-05-05T12:00:00Z"));
    expect(label).toMatch(/New York/);
  });

  it("tzLabel falls back to raw tz on errors", () => {
    expect(tzLabel("Mars/Olympus_Mons")).toBe("Mars/Olympus_Mons");
  });
});
