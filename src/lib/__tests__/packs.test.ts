/**
 * Regression locks for two reported bugs:
 *  (b) removing the last protocol re-adds it (normalize refilled an
 *      explicit empty installedPacks with DEFAULT_INSTALLED)
 *  (a) "make editable" / custom-pack edit round-trip
 */
import { describe, it, expect } from "vitest";
import {
  importState,
  exportState,
  uninstallPack,
  duplicatePack,
  upsertCustomPack,
  getDefaultState,
} from "@/lib/storage";
import { DEFAULT_INSTALLED } from "@/lib/packs";
import type { AppState, ProtocolPack } from "@/lib/types";

const v3 = (over: Record<string, unknown>) =>
  JSON.stringify({ ...getDefaultState(), version: 3, ...over });

describe("installedPacks normalization (bug b)", () => {
  it("keeps an EXPLICIT empty list — does not resurrect defaults", () => {
    const s = importState(v3({ installedPacks: [] }));
    expect(s).not.toBeNull();
    expect(s!.installedPacks).toEqual([]);
  });

  it("still defaults when the field is missing/corrupt", () => {
    const raw = JSON.parse(v3({}));
    delete raw.installedPacks;
    const s = importState(JSON.stringify(raw));
    expect(s!.installedPacks).toEqual([...DEFAULT_INSTALLED]);
  });

  it("uninstalling the only pack survives an export→import round-trip", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["longevity-foundation"] };
    st = uninstallPack(st, "longevity-foundation");
    expect(st.installedPacks).toEqual([]);
    const back = importState(exportState(st)) as AppState;
    expect(back.installedPacks).toEqual([]); // stays gone
  });
});

describe("custom pack editability (bug a)", () => {
  const source: ProtocolPack = {
    id: "better-sleep",
    name: "Better Sleep",
    tagline: "t",
    goal: "sleep",
    accent: "var(--sleep)",
    icon: "moon",
    source: "official",
    durationLabel: "x",
    behaviors: [
      {
        canonicalKey: "wind-down",
        title: "Wind down",
        block: "evening",
        anchor: "bed",
        offsetMin: -60,
        rationale: "r",
        icon: "moon",
        leverage: 2,
        kind: "action",
      },
    ],
  } as unknown as ProtocolPack;

  it("forks into an installed, namespaced, editable custom copy", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["better-sleep"] };
    st = duplicatePack(st, source);

    const copy = st.customPacks.at(-1)!;
    expect(copy.source).toBe("custom");
    expect(copy.id).not.toBe("better-sleep");
    expect(st.installedPacks).toContain(copy.id);
    expect(st.installedPacks).not.toContain("better-sleep"); // original removed
    expect(copy.behaviors[0].canonicalKey).toContain(":"); // namespaced
  });

  it("editing a custom pack (same id) replaces it and stays installed", () => {
    let st = getDefaultState();
    st = { ...st, installedPacks: ["better-sleep"] };
    st = duplicatePack(st, source);
    const copy = st.customPacks.at(-1)!;

    const edited: ProtocolPack = {
      ...copy,
      name: copy.name + " v2",
      behaviors: [],
    };
    st = upsertCustomPack(st, edited);

    const found = st.customPacks.filter((p) => p.id === copy.id);
    expect(found).toHaveLength(1); // replaced, not duplicated
    expect(found[0].name).toBe(copy.name + " v2");
    expect(st.installedPacks).toContain(copy.id); // still installed
  });
});
