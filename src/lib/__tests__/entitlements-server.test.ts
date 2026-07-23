/**
 * SEC-1 (audit 2026-07-16): `paid` must be server-authoritative. When an
 * entitlement is present (cloud mode), a forged local settings.tier can no
 * longer buy premium — only the entitlements table (webhook / manual grant)
 * can. With no entitlement (local-only mode) getAccess still trusts
 * settings.tier so nothing changes off-cloud. Trial is untouched throughout.
 *
 * Separate file so vitest's per-file module isolation keeps these
 * setEntitlement() calls from leaking into entitlements.test.ts.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  getAccess,
  setEntitlement,
  getEntitlement,
  type Entitlement,
} from "@/lib/entitlements";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

const NOW = "2026-07-16T00:00:00.000Z";
function ent(paidTier: Entitlement["paidTier"]): Entitlement {
  return { paidTier, status: paidTier === "premium" ? "active" : "none", syncedAt: NOW };
}
function stateWithTier(tier: "free" | "premium"): AppState {
  const base = getDefaultState();
  // No trial → isolate the paid flag from trial-driven premium.
  return {
    ...base,
    settings: { ...base.settings, tier, premiumTrialEndsAt: undefined },
  };
}

afterEach(() => setEntitlement(null));

describe("getAccess — server-authoritative paid (SEC-1)", () => {
  it("local-only (no entitlement) still trusts settings.tier", () => {
    expect(getEntitlement()).toBeNull();
    expect(getAccess(stateWithTier("premium")).paid).toBe(true);
    expect(getAccess(stateWithTier("free")).paid).toBe(false);
  });

  it("a premium entitlement grants paid even if local tier says free", () => {
    setEntitlement(ent("premium"));
    expect(getAccess(stateWithTier("free")).paid).toBe(true);
    expect(getAccess(stateWithTier("free")).premium).toBe(true);
  });

  it("a free entitlement BLOCKS a forged local premium tier", () => {
    setEntitlement(ent("free"));
    const a = getAccess(stateWithTier("premium"));
    expect(a.paid).toBe(false);
    expect(a.premium).toBe(false); // no trial either → fully locked
  });

  it("clearing the entitlement reverts to the local fallback", () => {
    setEntitlement(ent("free"));
    expect(getAccess(stateWithTier("premium")).paid).toBe(false);
    setEntitlement(null);
    expect(getAccess(stateWithTier("premium")).paid).toBe(true);
  });

  it("a free entitlement does NOT cancel an active trial (trial stays client-side)", () => {
    setEntitlement(ent("free"));
    const base = getDefaultState();
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const trialing: AppState = {
      ...base,
      settings: { ...base.settings, tier: "free", premiumTrialEndsAt: future },
    };
    const a = getAccess(trialing);
    expect(a.paid).toBe(false); // not paid
    expect(a.inTrial).toBe(true); // but still in trial
    expect(a.premium).toBe(true); // → premium via trial
  });
});
