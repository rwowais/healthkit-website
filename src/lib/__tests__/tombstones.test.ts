/**
 * Deletion tombstones (audit REL-9, 2026-07-24).
 *
 * The dirty-path merge unions collections, so a pack / biomarker / supplement
 * deleted on one device was merely "missing" there and got resurrected from
 * another device's stale copy — then pushed back up, making the undo permanent
 * account-wide ("I deleted that supplement and it came back").
 *
 * A tombstone records that the removal was INTENTIONAL, so the merge can tell
 * that apart from "my copy is just older". Re-adding clears it.
 */
import { describe, it, expect } from "vitest";
import { mergeStates } from "@/lib/datasource";
import {
  getDefaultState,
  uninstallPack,
  installPack,
  deleteBiomarker,
  removeSupplement,
  deleteCustomPack,
  upsertCustomPack,
  deletionKey,
  TOMBSTONE_TTL_MS,
} from "@/lib/storage";
import type { AppState, ProtocolPack } from "@/lib/types";

function withPacks(ids: string[]): AppState {
  const s = getDefaultState();
  return { ...s, installedPacks: ids };
}

const bio = (id: string) =>
  ({ id, metric: "weight", value: 80, date: "2026-05-19" }) as unknown as
    AppState["biomarkers"][number];

const supp = (id: string) =>
  ({ id, name: `S-${id}`, dose: "1" }) as unknown as NonNullable<
    AppState["supplements"]
  >[number];

const customPack = (id: string) =>
  ({ id, name: id, source: "custom", behaviors: [] }) as unknown as ProtocolPack;

describe("tombstones — deletions survive a merge (REL-9)", () => {
  it("a pack uninstalled on one device is NOT resurrected by the other", () => {
    const cloud = withPacks(["better-sleep", "deep-focus"]);
    // This device uninstalled one; the cloud copy predates that.
    const local = uninstallPack(withPacks(["better-sleep", "deep-focus"]), "deep-focus");

    const merged = mergeStates(local, cloud);
    expect(merged.installedPacks).toContain("better-sleep");
    expect(merged.installedPacks).not.toContain("deep-focus");
  });

  it("without the tombstone the union would revive it (proves the test bites)", () => {
    const cloud = withPacks(["better-sleep", "deep-focus"]);
    // Same removal, but with the intent record stripped — the old behaviour.
    const naive = { ...withPacks(["better-sleep"]), deletions: undefined };
    const merged = mergeStates(naive, cloud);
    expect(merged.installedPacks).toContain("deep-focus"); // resurrected
  });

  it("re-installing after deleting wins — the tombstone is cleared", () => {
    const cloud = withPacks(["deep-focus"]);
    const removed = uninstallPack(withPacks(["deep-focus"]), "deep-focus");
    const reAdded = installPack(removed, "deep-focus");

    expect(reAdded.deletions?.[deletionKey("pack", "deep-focus")]).toBeUndefined();
    expect(mergeStates(reAdded, cloud).installedPacks).toContain("deep-focus");
  });

  it("covers biomarkers, supplements and custom packs", () => {
    const base = getDefaultState();
    const cloud: AppState = {
      ...base,
      biomarkers: [bio("b1"), bio("b2")],
      supplements: [supp("s1"), supp("s2")],
      customPacks: [customPack("c1")],
      installedPacks: ["c1"],
    };

    let local: AppState = { ...cloud };
    local = deleteBiomarker(local, "b2");
    local = removeSupplement(local, "s2");
    local = deleteCustomPack(local, "c1");

    const merged = mergeStates(local, cloud);
    expect(merged.biomarkers.map((b) => b.id)).toEqual(["b1"]);
    expect((merged.supplements ?? []).map((s) => s.id)).toEqual(["s1"]);
    expect(merged.customPacks).toHaveLength(0);
    expect(merged.installedPacks).not.toContain("c1");
  });

  it("re-creating a custom pack with a reused id clears both its tombstones", () => {
    const removed = deleteCustomPack(
      {
        ...getDefaultState(),
        customPacks: [customPack("c1")],
        installedPacks: ["c1"],
      },
      "c1"
    );
    const recreated = upsertCustomPack(removed, customPack("c1"));
    expect(recreated.deletions?.[deletionKey("custom", "c1")]).toBeUndefined();
    expect(recreated.deletions?.[deletionKey("pack", "c1")]).toBeUndefined();
    expect(recreated.installedPacks).toContain("c1");
  });

  it("expired tombstones are pruned and stop filtering", () => {
    const cloud = withPacks(["deep-focus"]);
    const stale: AppState = {
      ...withPacks([]),
      deletions: {
        [deletionKey("pack", "deep-focus")]: Date.now() - TOMBSTONE_TTL_MS - 1000,
      },
    };
    const merged = mergeStates(stale, cloud);
    // Past its TTL the tombstone is dropped, so the item is no longer filtered
    // and the map doesn't grow forever.
    expect(merged.installedPacks).toContain("deep-focus");
    expect(merged.deletions?.[deletionKey("pack", "deep-focus")]).toBeUndefined();
  });
});
