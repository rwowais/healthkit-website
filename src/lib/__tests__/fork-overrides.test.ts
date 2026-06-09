/**
 * Regression: forking a pack ("Make it editable") must carry across the
 * per-behavior edits the author already made on it (sweep 2026-06-09 #270).
 *
 * Official-pack behaviors are editable in place — overrides keyed by the PLAIN
 * canonicalKey. duplicatePack re-keys every behavior to `fork:<id>:<key>` and
 * the engine looks up overrides strictly by that namespaced key, so before the
 * fix an author who tuned a dose/time BEFORE forking silently lost it (and
 * normalize() then pruned the orphaned plain-keyed override for good). The fix
 * copies each source override onto the fork's new key.
 */
import { describe, it, expect } from "vitest";
import { duplicatePack, getDefaultState } from "@/lib/storage";
import type { AppState, ProtocolPack } from "@/lib/types";

const pack = {
  id: "better-sleep",
  name: "Better Sleep",
  tagline: "",
  goal: "sleep",
  accent: "var(--sleep)",
  icon: "moon",
  source: "official",
  durationLabel: "Ongoing",
  behaviors: [
    {
      canonicalKey: "wind-down",
      title: "Wind-down",
      block: "evening",
      anchor: "bed",
      offsetMin: -30,
      rationale: "",
      icon: "wind",
      leverage: 2,
      kind: "action",
    },
  ],
} as unknown as ProtocolPack;

describe("duplicatePack preserves pre-fork per-behavior edits (#270)", () => {
  it("copies the author's override onto the fork's namespaced key", () => {
    const state: AppState = {
      ...getDefaultState(),
      installedPacks: ["better-sleep"],
      customPacks: [],
      behaviorOverrides: { "wind-down": { dose: "personalized" } },
    } as AppState;

    const forked = duplicatePack(state, pack);
    const newId = forked.customPacks[0].id;

    // The fork's behavior carries the author's edit…
    expect(forked.behaviorOverrides[`fork:${newId}:wind-down`]).toEqual({
      dose: "personalized",
    });
    // …and the original plain-keyed override is left intact (another installed
    // pack may share the key; normalize prunes it only if it's a true orphan).
    expect(forked.behaviorOverrides["wind-down"]).toEqual({
      dose: "personalized",
    });
  });
});
