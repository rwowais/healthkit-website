/**
 * Regression tests for the data-safety merge fixes (QA review 2026-06-05).
 * The dirty/local-preferring merge previously inherited supplements,
 * supplementMeta, protocols and insights from `...cloud` only, silently
 * dropping un-pushed local edits (then pushing the loss back up).
 */
import { describe, it, expect } from "vitest";
import { mergeStates, slicesDiffer, hasMeaningfulData } from "@/lib/datasource";
import { getDefaultState } from "@/lib/storage";
import type { AppState, Supplement } from "@/lib/types";

const base = () => getDefaultState();
const supp = (id: string, name: string) =>
  ({ id, name } as unknown as Supplement);

describe("mergeStates preserves local-only slices (dirty / local-preferring merge)", () => {
  it("keeps an un-pushed local supplement the cloud row doesn't have", () => {
    const cloud = base();
    const local = base();
    local.supplements = [supp("supp-local-1", "Magnesium")];
    const merged = mergeStates(local, cloud);
    expect(merged.supplements?.some((x) => x.id === "supp-local-1")).toBe(true);
  });

  it("unions supplements across devices, local winning on id collision", () => {
    const cloud = base();
    cloud.supplements = [supp("shared", "Cloud-dose"), supp("cloud-only", "Omega")];
    const local = base();
    local.supplements = [supp("shared", "Local-dose")];
    const merged = mergeStates(local, cloud);
    const byId = Object.fromEntries(
      (merged.supplements ?? []).map((s) => [s.id, s as { name: string }])
    );
    expect(byId["cloud-only"]).toBeTruthy(); // cloud-only survives
    expect(byId["shared"].name).toBe("Local-dose"); // un-pushed local edit wins
  });

  it("merges supplementMeta with local winning per key", () => {
    const cloud = base();
    (cloud.supplementMeta as Record<string, unknown>)["a"] = { v: "cloud" };
    const local = base();
    (local.supplementMeta as Record<string, unknown>)["b"] = { v: "local" };
    const merged = mergeStates(local, cloud);
    expect(Object.keys(merged.supplementMeta)).toEqual(
      expect.arrayContaining(["a", "b"])
    );
  });

  it("does not drop the cloud copy when local has no supplements", () => {
    const cloud = base();
    cloud.supplements = [supp("cloud-1", "D3")];
    const local = base(); // no supplements set
    const merged = mergeStates(local, cloud);
    expect(merged.supplements?.some((x) => x.id === "cloud-1")).toBe(true);
  });
});

describe("first-sign-in conflict gate sees config slices (audit 2026-06-09)", () => {
  // Before the fix the gate compared only logs/biomarkers/installedPacks, so a
  // guest with divergent supplements / custom packs / behavior overrides but
  // matching logs was silently cloud-overwritten (data loss) instead of prompted.
  it("slicesDiffer flags a divergent supplement stack", () => {
    const a = base();
    a.supplements = [supp("s1", "Magnesium")];
    expect(slicesDiffer(a, base())).toBe(true);
  });

  it("slicesDiffer flags divergent custom packs and behavior overrides", () => {
    const a1 = base();
    a1.customPacks = [
      { id: "custom-x" } as unknown as AppState["customPacks"][number],
    ];
    expect(slicesDiffer(a1, base())).toBe(true);

    const a2 = base();
    a2.behaviorOverrides = { "morning-sunlight": { customTime: "08:15" } };
    expect(slicesDiffer(a2, base())).toBe(true);
  });

  it("slicesDiffer stays false for two identical default states", () => {
    expect(slicesDiffer(base(), base())).toBe(false);
  });

  it("hasMeaningfulData counts supplements and overrides as meaningful", () => {
    const s = base();
    s.behaviorOverrides = { "wind-down": { block: "evening" } };
    expect(hasMeaningfulData(s)).toBe(true);
    const t = base();
    t.supplements = [supp("s2", "Creatine")];
    expect(hasMeaningfulData(t)).toBe(true);
  });

  it("hasMeaningfulData treats a curated installedPacks set as meaningful (HIGH #3)", () => {
    // A pristine guest (default packs, nothing else) is NOT meaningful — cloud
    // may win on first sign-in with no real loss.
    expect(hasMeaningfulData(base())).toBe(false);
    // But a guest who curated their packs (the core onboarding action) IS
    // meaningful and must reach the conflict prompt instead of silent
    // cloud-wins. Both a removal and an addition diverge from the seed.
    const removed = base();
    removed.installedPacks = ["longevity-foundation"]; // dropped better-sleep
    expect(hasMeaningfulData(removed)).toBe(true);
    const added = base();
    added.installedPacks = [...(added.installedPacks ?? []), "heart-health"];
    expect(hasMeaningfulData(added)).toBe(true);
  });
});
