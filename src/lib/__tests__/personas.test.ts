/**
 * Dev persona builders — sanity that each lifecycle fixture is well-formed.
 */
import { describe, it, expect } from "vitest";
import { buildPersona, PERSONAS } from "@/lib/dev/personas";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";

describe("buildPersona", () => {
  it("every persona builds a valid AppState without throwing", () => {
    for (const p of PERSONAS) {
      const s = buildPersona(p.kind);
      expect(s.settings.completedOnboarding).toBe(true);
      expect(Array.isArray(s.dailyLogs)).toBe(true);
      expect(s.installedPacks.length).toBeGreaterThan(0);
    }
  });

  it("fresh: onboarded, one pack, no logs, free trial", () => {
    const s = buildPersona("fresh");
    expect(s.dailyLogs.length).toBe(0);
    expect(s.settings.tier).toBe("free");
    expect(s.installedPacks).toEqual(["longevity-foundation"]);
  });

  it("engaged: ~3 weeks of logs + weekly goal", () => {
    const s = buildPersona("engaged");
    expect(s.dailyLogs.length).toBe(18);
    expect(s.settings.weeklyGoal).toBe(5);
  });

  it("power: months of logs, premium, multiple packs, biomarkers", () => {
    const s = buildPersona("power");
    expect(s.dailyLogs.length).toBe(60);
    expect(s.settings.tier).toBe("premium");
    expect(s.installedPacks.length).toBe(3);
    expect(s.biomarkers.length).toBeGreaterThan(0);
  });

  it("lapsed: a gap up to today (no log in the last several days)", () => {
    const s = buildPersona("lapsed");
    const tz = getTz(s.settings);
    const today = dateKeyInTz(tz);
    const keys = new Set(s.dailyLogs.map((l) => l.date));
    expect(keys.has(today)).toBe(false);
    expect(keys.has(addDaysToKey(today, -1))).toBe(false);
    expect(keys.has(addDaysToKey(today, -9))).toBe(false);
    expect(s.dailyLogs.length).toBeGreaterThan(0); // but has history
  });

  it("vacation: on a break with an open period", () => {
    const s = buildPersona("vacation");
    expect(s.settings.vacationMode).toBe(true);
    expect((s.settings.vacationPeriods ?? []).some((p) => p.end === null)).toBe(true);
  });
});
