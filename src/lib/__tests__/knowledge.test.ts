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
  getCfgNumber,
  getCfgString,
  getCfgBool,
  activeInsightTemplates,
  getInsightTemplate,
  renderTemplate,
  BUNDLE_SCHEMA,
} from "@/lib/knowledge";
import {
  getAhaDays,
  getFreePacks,
  AHA_DAYS,
} from "@/lib/entitlements";

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

  it("getCfg* falls through to defaults until a bundle overrides", () => {
    resetKnowledge();
    expect(getCfgNumber("AHA_DAYS", 6)).toBe(6);
    expect(getCfgString("MISSING", "x")).toBe("x");
    expect(getCfgBool("MISSING", false)).toBe(false);
    // Stringified numbers should coerce; non-coercible stays default.
    applyPublishedBundle({
      schema: BUNDLE_SCHEMA,
      version: 1,
      generatedAt: "t",
      protocols: PACKS,
      config: {
        AHA_DAYS: 21,
        FREE_PACKS: "5",
        FLAG: true,
        BAD: "nope",
      },
    });
    expect(getCfgNumber("AHA_DAYS", 6)).toBe(21);
    expect(getCfgNumber("FREE_PACKS", 3)).toBe(5);
    expect(getCfgBool("FLAG", false)).toBe(true);
    expect(getCfgNumber("BAD", 7)).toBe(7);
    // Entitlement getters now reflect the override.
    expect(getAhaDays()).toBe(21);
    expect(getFreePacks()).toBe(5);
    resetKnowledge();
    // After reset, getters revert to code defaults.
    expect(getAhaDays()).toBe(AHA_DAYS);
  });

  it("getInsightTemplate falls back to the default copy when no row exists", () => {
    resetKnowledge();
    expect(activeInsightTemplates()).toEqual([]);
    expect(
      getInsightTemplate("keystone-slipping", "default-copy")
    ).toBe("default-copy");
    applyPublishedBundle({
      schema: BUNDLE_SCHEMA,
      version: 2,
      generatedAt: "t",
      protocols: PACKS,
      config: {},
      insightTemplates: [
        {
          kind: "keystone-slipping",
          template: "custom: {title} keeps {delta} more.",
        },
      ],
    });
    expect(
      getInsightTemplate("keystone-slipping", "default-copy")
    ).toBe("custom: {title} keeps {delta} more.");
    resetKnowledge();
  });

  it("renderTemplate substitutes known vars and blanks unknowns", () => {
    expect(
      renderTemplate("{title} kept {delta} {pointWord}.", {
        title: "Magnesium",
        delta: 3,
        pointWord: "points",
      })
    ).toBe("Magnesium kept 3 points.");
    expect(renderTemplate("hi {missing}", {})).toBe("hi ");
  });

  it("bundleChecksum changes only when insightTemplates actually have content", () => {
    const empty = { protocols: PACKS, config: { x: 1 } };
    // Adding an EMPTY insightTemplates array is a no-op for the checksum
    // (backward compatible — every bundle published before Wave D had
    // no field at all; we must not break their stored checksums).
    expect(
      bundleChecksum({ ...empty, insightTemplates: [] })
    ).toBe(bundleChecksum(empty));
    // Adding NON-empty templates does change the checksum.
    expect(
      bundleChecksum({
        ...empty,
        insightTemplates: [{ kind: "k", template: "t" }],
      })
    ).not.toBe(bundleChecksum(empty));
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
