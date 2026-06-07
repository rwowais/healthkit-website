/**
 * Regression tests for the data-safety merge fixes (QA review 2026-06-05).
 * The dirty/local-preferring merge previously inherited supplements,
 * supplementMeta, protocols and insights from `...cloud` only, silently
 * dropping un-pushed local edits (then pushing the loss back up).
 */
import { describe, it, expect } from "vitest";
import { mergeStates } from "@/lib/datasource";
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
