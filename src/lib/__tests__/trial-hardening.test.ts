/**
 * Trial-lifecycle hardening (audit 2026-08-16, Tier 1).
 *
 * Pins the four exploit/bug fixes:
 *  1. Import clamp — a hand-edited backup with a far-future trial end no
 *     longer grants permanent premium (normalize caps at start + 28d).
 *  2. Clock guard — rolling the device clock back cannot resurrect a trial.
 *  3. Paid guard — maybeExtendTrial never fires for a server-paid customer
 *     (settings.tier stays "free" for cloud payers; guarding on tier alone
 *     would show them "we extended your trial").
 *  4. Merge — trialExtendedAt survives a device merge (earliest stamp wins),
 *     so the one-shot extension can't re-arm.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getAccess,
  maybeExtendTrial,
  setEntitlement,
  __resetClockGuard,
  type Entitlement,
} from "@/lib/entitlements";
import { getDefaultState, importState } from "@/lib/storage";
import { mergeStates } from "@/lib/datasource";
import type { AppState } from "@/lib/types";

const DAY = 86_400_000;

function trialState(over: Partial<AppState["settings"]> = {}): AppState {
  const base = getDefaultState();
  return {
    ...base,
    settings: {
      ...base.settings,
      tier: "free",
      trialStartDate: new Date().toISOString(),
      premiumTrialEndsAt: new Date(Date.now() + 14 * DAY).toISOString(),
      ...over,
    },
  };
}

afterEach(() => {
  setEntitlement(null);
  __resetClockGuard();
  vi.useRealTimers();
});

describe("import clamp (bug 6.6)", () => {
  it("a doctored far-future trial end is clamped to start + 28d", () => {
    const doctored = trialState({
      premiumTrialEndsAt: "2099-01-01T00:00:00.000Z",
    });
    const restored = importState(JSON.stringify(doctored))!;
    expect(restored).toBeTruthy();
    const end = Date.parse(restored.settings.premiumTrialEndsAt!);
    const start = Date.parse(restored.settings.trialStartDate);
    expect(end - start).toBeLessThanOrEqual(28 * DAY + 1000);
    // …and getAccess agrees this is a trial, not permanent premium.
    expect(getAccess(restored).paid).toBe(false);
  });

  it("a legitimate 14-day trial passes through untouched", () => {
    const legit = trialState();
    const restored = importState(JSON.stringify(legit))!;
    expect(restored.settings.premiumTrialEndsAt).toBe(
      legit.settings.premiumTrialEndsAt
    );
  });

  it("a garbled trial end is dropped rather than trusted", () => {
    const junk = trialState({ premiumTrialEndsAt: "not-a-date" });
    const restored = importState(JSON.stringify(junk))!;
    expect(restored.settings.premiumTrialEndsAt).toBeUndefined();
  });
});

describe("clock rollback guard (bug 6.1)", () => {
  it("rolling the clock back does not resurrect an observed-expired trial", () => {
    vi.useFakeTimers();
    const realNow = Date.now();
    vi.setSystemTime(realNow);
    // Trial ended two days ago; the app has SEEN the current time.
    const expired = trialState({
      trialStartDate: new Date(realNow - 16 * DAY).toISOString(),
      premiumTrialEndsAt: new Date(realNow - 2 * DAY).toISOString(),
    });
    expect(getAccess(expired).trialExpired).toBe(true);

    // Tamper: roll the device clock back a week.
    vi.setSystemTime(realNow - 7 * DAY);
    const after = getAccess(expired);
    expect(after.inTrial).toBe(false); // still expired — monotonic clock
    expect(after.trialExpired).toBe(true);
  });
});

describe("paid guard on the extension (bug 3.5)", () => {
  it("a server-paid customer never gets a trial extension", () => {
    const ent: Entitlement = {
      paidTier: "premium",
      status: "active",
      syncedAt: new Date().toISOString(),
    };
    setEntitlement(ent);
    // In the extension window with zero engagement — would extend if free.
    const nearEnd = trialState({
      premiumTrialEndsAt: new Date(Date.now() + 1 * DAY).toISOString(),
    });
    expect(nearEnd.settings.tier).toBe("free"); // cloud payer's local tier
    const out = maybeExtendTrial(nearEnd);
    expect(out).toBe(nearEnd); // untouched — no extension, no card stamp
    expect(out.settings.trialExtendedAt).toBeUndefined();
  });

  it("a genuinely free low-engagement user still gets the one-shot extension", () => {
    const nearEnd = trialState({
      premiumTrialEndsAt: new Date(Date.now() + 1 * DAY).toISOString(),
    });
    const out = maybeExtendTrial(nearEnd);
    expect(out.settings.trialExtendedAt).toBeTruthy();
  });
});

describe("merge keeps the one-shot guard (bug 6.9)", () => {
  it("trialExtendedAt survives when only one side has it", () => {
    const stamp = new Date(Date.now() - 2 * DAY).toISOString();
    const cloud = trialState({ trialExtendedAt: stamp });
    const local = trialState(); // never saw the extension
    expect(mergeStates(local, cloud).settings.trialExtendedAt).toBe(stamp);
    expect(mergeStates(cloud, local).settings.trialExtendedAt).toBe(stamp);
  });

  it("with both present, the EARLIEST stamp wins", () => {
    const early = new Date(Date.now() - 5 * DAY).toISOString();
    const late = new Date(Date.now() - 1 * DAY).toISOString();
    const a = trialState({ trialExtendedAt: early });
    const b = trialState({ trialExtendedAt: late });
    expect(mergeStates(a, b).settings.trialExtendedAt).toBe(early);
    expect(mergeStates(b, a).settings.trialExtendedAt).toBe(early);
  });
});
