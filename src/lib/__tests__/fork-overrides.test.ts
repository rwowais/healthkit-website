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

  it("does NOT copy when another installed pack still supplies the key (round-2 regression)", () => {
    // strength ships in BOTH longevity-foundation and heart-health. Forking
    // heart-health must NOT freeze a fork-key copy of the strength override:
    // the plain key stays live through the merged row (longevity-foundation
    // still supplies it), and a frozen copy would permanently shadow every
    // future edit the user makes there.
    const heartHealth = {
      id: "heart-health",
      name: "Heart Health",
      tagline: "",
      goal: "recovery",
      accent: "var(--readiness)",
      icon: "heart",
      source: "official",
      durationLabel: "Ongoing",
      behaviors: [
        {
          canonicalKey: "strength",
          title: "Strength training",
          block: "afternoon",
          anchor: "wake",
          offsetMin: 360,
          rationale: "",
          icon: "dumbbell",
          leverage: 3,
          kind: "action",
        },
      ],
    } as unknown as ProtocolPack;
    const state: AppState = {
      ...getDefaultState(),
      installedPacks: ["longevity-foundation", "heart-health"],
      customPacks: [],
      behaviorOverrides: { strength: { dose: "5x5" } },
    } as AppState;

    const forked = duplicatePack(state, heartHealth);
    const newId = forked.customPacks[0].id;
    // No frozen copy — the live plain override keeps driving the merged row.
    expect(forked.behaviorOverrides[`fork:${newId}:strength`]).toBeUndefined();
    expect(forked.behaviorOverrides["strength"]).toEqual({ dose: "5x5" });
  });
});
