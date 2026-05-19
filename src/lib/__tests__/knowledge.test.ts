/**
 * The CMS seam must be provably lossless: a published bundle that
 * mirrors the built-in catalog has to round-trip to the SAME
 * ProtocolPack[] the app runs on today — the guarantee that turning the
 * CMS on changes nothing for users until a real edit is published.
 */
import { describe, it, expect } from "vitest";
import { PACKS } from "@/lib/packs";
import {
  builtinBundle,
  bundleChecksum,
  isValidBundle,
  applyPublishedBundle,
  activePacks,
  activeBundleVersion,
  resetKnowledge,
  BUNDLE_SCHEMA,
} from "@/lib/knowledge";

describe("knowledge bundle seam", () => {
  it("built-in bundle round-trips byte-identically to the shipped catalog", () => {
    const b = builtinBundle();
    const trip = JSON.parse(JSON.stringify(b));
    expect(isValidBundle(trip)).toBe(true);
    expect(trip.protocols).toEqual(PACKS); // zero user-facing change
  });

  it("checksum is stable and key-order independent", () => {
    const a = { protocols: PACKS, config: { x: 1, y: 2 } };
    const b = { protocols: PACKS, config: { y: 2, x: 1 } };
    expect(bundleChecksum(a)).toBe(bundleChecksum(b));
  });

  it("defaults to the built-in catalog (override-free)", () => {
    resetKnowledge();
    expect(activePacks()).toBe(PACKS);
    expect(activeBundleVersion()).toBe(0);
  });

  it("only a newer, valid bundle can replace the catalog", () => {
    resetKnowledge();
    // garbage rejected
    expect(applyPublishedBundle({ nope: true })).toBe(false);
    // wrong schema rejected
    expect(
      applyPublishedBundle({
        schema: 999,
        version: 5,
        protocols: [],
        config: {},
      })
    ).toBe(false);
    // valid + newer accepted
    const next = {
      schema: BUNDLE_SCHEMA,
      version: 1,
      generatedAt: "t",
      protocols: PACKS,
      config: { AHA_DAYS: 6 },
    };
    expect(applyPublishedBundle(next)).toBe(true);
    expect(activeBundleVersion()).toBe(1);
    // older/equal version ignored
    expect(applyPublishedBundle({ ...next, version: 1 })).toBe(false);
    resetKnowledge();
  });
});
