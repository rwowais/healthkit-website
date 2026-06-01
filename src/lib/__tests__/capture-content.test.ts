/**
 * Capture & content cluster: NL quick-log parser, rotating reflection
 * prompts, and the two new library packs.
 */
import { describe, it, expect } from "vitest";
import { parseQuickLog } from "@/lib/quicklog";
import { reflectionPrompt } from "@/lib/prompts";
import { PACKS } from "@/lib/packs";

describe("parseQuickLog", () => {
  it("parses the canonical example", () => {
    const p = parseQuickLog("slept 7h, energy low, felt good");
    expect(p.sleepHours).toBe(7);
    expect(p.energy).toBe(2);
    expect(p.mood).toBe(5);
    expect(p.note).toBe("slept 7h, energy low, felt good");
    expect(p.understood.length).toBeGreaterThanOrEqual(3);
  });

  it("reads sleep quality words", () => {
    expect(parseQuickLog("slept poorly").sleepQuality).toBe(2);
    expect(parseQuickLog("slept really well").sleepQuality).toBe(5);
  });

  it("reads high energy + duration variants", () => {
    const p = parseQuickLog("8.5 hours sleep, high energy, mood great");
    expect(p.sleepHours).toBe(8.5);
    expect(p.energy).toBe(5);
    expect(p.mood).toBe(5);
  });

  it("understands nothing structured but keeps the note (lossless)", () => {
    const p = parseQuickLog("had a normal day, ran errands");
    expect(p.understood).toEqual([]);
    expect(p.note).toBe("had a normal day, ran errands");
    expect(p.energy).toBeUndefined();
  });

  it("ignores absurd sleep durations", () => {
    expect(parseQuickLog("slept 40h").sleepHours).toBeUndefined();
  });
});

describe("reflectionPrompt", () => {
  it("returns a stable, non-empty prompt per day", () => {
    const a = reflectionPrompt("2026-06-01");
    expect(a.length).toBeGreaterThan(5);
    expect(reflectionPrompt("2026-06-01")).toBe(a); // stable same day
  });

  it("varies across days", () => {
    const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"];
    const set = new Set(days.map(reflectionPrompt));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe("new library packs", () => {
  it("includes Mobility & Joints and Calm Mind, each with behaviors", () => {
    const mob = PACKS.find((p) => p.id === "mobility-joints");
    const calm = PACKS.find((p) => p.id === "calm-mind");
    expect(mob).toBeTruthy();
    expect(calm).toBeTruthy();
    expect(mob!.behaviors.length).toBeGreaterThanOrEqual(3);
    expect(calm!.behaviors.length).toBeGreaterThanOrEqual(3);
    // composed from real, resolved atoms (pickAtoms dropped nothing)
    expect(mob!.behaviors.every((b) => !!b.canonicalKey)).toBe(true);
    expect(calm!.behaviors.every((b) => !!b.title)).toBe(true);
  });
});
