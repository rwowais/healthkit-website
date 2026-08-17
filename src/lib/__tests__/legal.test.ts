/**
 * legal.test.ts — who gets asked to accept, and what gets recorded.
 *
 * The stakes: the acceptance stamp is the evidence that a user agreed to the
 * Terms (arbitration clause included), and the banner is the only lawful path
 * to broadening data use later. A gating bug here either nags users forever
 * or silently collects no acceptances — both defeat the purpose.
 */
import { describe, it, expect } from "vitest";
import { needsLegalAcceptance, acceptanceStamp } from "../legal";
import { LEGAL_VERSION } from "../constants";

function state(settings: Record<string, unknown>) {
  return { settings } as unknown as Parameters<typeof needsLegalAcceptance>[0];
}

describe("needsLegalAcceptance", () => {
  it("never asks mid-onboarding — that flow has its own consent moment", () => {
    expect(needsLegalAcceptance(state({ completedOnboarding: false }))).toBe(
      false
    );
    expect(needsLegalAcceptance(state({}))).toBe(false);
  });

  it("asks an onboarded user who predates the mechanism (no stamp at all)", () => {
    // Every account created before 2026-08-17 looks like this: onboarded,
    // fields never written. They must see the banner exactly once.
    expect(needsLegalAcceptance(state({ completedOnboarding: true }))).toBe(
      true
    );
  });

  it("asks when the accepted version is older than current", () => {
    expect(
      needsLegalAcceptance(
        state({
          completedOnboarding: true,
          legalAcceptedVersion: LEGAL_VERSION - 1,
        })
      )
    ).toBe(true);
  });

  it("does not ask once the current version is accepted", () => {
    expect(
      needsLegalAcceptance(
        state({
          completedOnboarding: true,
          legalAcceptedVersion: LEGAL_VERSION,
        })
      )
    ).toBe(false);
  });

  it("does not ask when the stamp is NEWER than this build (downgrade safety)", () => {
    // State restored from a newer app version must not trigger a re-ask loop.
    expect(
      needsLegalAcceptance(
        state({
          completedOnboarding: true,
          legalAcceptedVersion: LEGAL_VERSION + 1,
        })
      )
    ).toBe(false);
  });

  it("handles null/undefined state without throwing", () => {
    expect(needsLegalAcceptance(null)).toBe(false);
    expect(needsLegalAcceptance(undefined)).toBe(false);
  });
});

describe("acceptanceStamp", () => {
  it("records the CURRENT version and a real timestamp", () => {
    const stamp = acceptanceStamp();
    expect(stamp.legalAcceptedVersion).toBe(LEGAL_VERSION);
    const t = Date.parse(stamp.legalAcceptedAt);
    expect(Number.isFinite(t)).toBe(true);
    expect(Math.abs(t - Date.now())).toBeLessThan(5_000);
  });

  it("a stamped state no longer needs acceptance — the loop closes", () => {
    const s = state({ completedOnboarding: true, ...acceptanceStamp() });
    expect(needsLegalAcceptance(s)).toBe(false);
  });
});
