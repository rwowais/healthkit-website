/**
 * entitlements.test.ts — gating + trial-extension logic.
 *
 * Bugs here silently lock paying users out OR give free Premium to
 * everyone. Both are catastrophic. This file pins the trial edge cases
 * the original implementation was hand-tuned to handle.
 */
import { describe, it, expect } from "vitest";
import { getAccess, maybeExtendTrial, AHA_DAYS } from "@/lib/entitlements";
import { getDefaultState } from "@/lib/storage";
import type { AppState, DailyLog } from "@/lib/types";

function withSettings(over: Partial<AppState["settings"]>): AppState {
  const base = getDefaultState();
  return { ...base, settings: { ...base.settings, ...over } };
}

function withLogs(state: AppState, count: number, score = 70): AppState {
  const logs: DailyLog[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    logs.push({
      date,
      score,
      sleepCompletions: [],
      exerciseEntries: [],
      nutritionScorecard: { customItems: [], note: "" },
      supplementEntries: [],
      completions: [],
      sleepLog: {},
      energyLevel: null,
      moodLevel: null,
      dayNote: "",
      pillarScores: {},
      behaviorCompletions: {},
    } as unknown as DailyLog);
  }
  return { ...state, dailyLogs: logs };
}

describe("getAccess", () => {
  it("paid user is premium", () => {
    const a = getAccess(withSettings({ tier: "premium" }));
    expect(a.paid).toBe(true);
    expect(a.premium).toBe(true);
    expect(a.inTrial).toBe(false);
  });

  it("user with future trial end is in trial (premium = true)", () => {
    const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString();
    const a = getAccess(withSettings({ premiumTrialEndsAt: inTwoDays }));
    expect(a.inTrial).toBe(true);
    expect(a.premium).toBe(true);
    expect(a.paid).toBe(false);
    expect(a.trialDaysLeft).toBeGreaterThanOrEqual(1);
  });

  it("user with past trial end + no paid tier shows trialExpired", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const a = getAccess(withSettings({ premiumTrialEndsAt: past }));
    expect(a.trialExpired).toBe(true);
    expect(a.premium).toBe(false);
    expect(a.paid).toBe(false);
  });

  it("paid + past trial → still premium (paid wins)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const a = getAccess(
      withSettings({ tier: "premium", premiumTrialEndsAt: past })
    );
    expect(a.premium).toBe(true);
    expect(a.paid).toBe(true);
    expect(a.trialExpired).toBe(false);
  });

  it("user with no trial date + no paid tier is free (premium = false)", () => {
    const a = getAccess(withSettings({}));
    expect(a.premium).toBe(false);
    expect(a.paid).toBe(false);
    expect(a.inTrial).toBe(false);
    expect(a.trialExpired).toBe(false);
  });

  it("trialDaysLeft rounds up so a 1.5-day-left trial shows 2 days", () => {
    const inOneAndHalf = new Date(
      Date.now() + 1.5 * 86400000
    ).toISOString();
    const a = getAccess(withSettings({ premiumTrialEndsAt: inOneAndHalf }));
    expect(a.trialDaysLeft).toBe(2);
  });
});

describe("maybeExtendTrial — engagement-gated", () => {
  it("paid users never get an extension", () => {
    const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString();
    const state = withSettings({
      tier: "premium",
      premiumTrialEndsAt: inTwoDays,
    });
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).toBe(inTwoDays);
    expect(r.settings.trialExtendedAt).toBeUndefined();
  });

  it("returns state unchanged when no trial date exists", () => {
    const state = withSettings({});
    expect(maybeExtendTrial(state)).toBe(state);
  });

  it("trial outside the extension window is left alone (>3 days remaining)", () => {
    const farFuture = new Date(Date.now() + 30 * 86400000).toISOString();
    const state = withSettings({ premiumTrialEndsAt: farFuture });
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).toBe(farFuture);
  });

  it("trial within 3 days + insufficient engagement → extends", () => {
    const inOneDay = new Date(Date.now() + 86400000).toISOString();
    // Engagement: 0 days tracked → well below AHA_DAYS.
    const state = withSettings({ premiumTrialEndsAt: inOneDay });
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).not.toBe(inOneDay);
    expect(r.settings.trialExtendedAt).toBeDefined();
  });

  it("trial within 3 days + sufficient engagement → not extended", () => {
    const inOneDay = new Date(Date.now() + 86400000).toISOString();
    let state = withSettings({ premiumTrialEndsAt: inOneDay });
    state = withLogs(state, AHA_DAYS + 2, 80);
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).toBe(inOneDay);
    expect(r.settings.trialExtendedAt).toBeUndefined();
  });

  it("trial just expired (within 7 days) + low engagement → extends (forgiving)", () => {
    const justExpired = new Date(Date.now() - 86400000).toISOString();
    const state = withSettings({ premiumTrialEndsAt: justExpired });
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).not.toBe(justExpired);
  });

  it("trial expired > 7 days ago → does NOT extend", () => {
    const longExpired = new Date(Date.now() - 30 * 86400000).toISOString();
    const state = withSettings({ premiumTrialEndsAt: longExpired });
    const r = maybeExtendTrial(state);
    expect(r.settings.premiumTrialEndsAt).toBe(longExpired);
    expect(r.settings.trialExtendedAt).toBeUndefined();
  });

  it("is one-shot — won't extend twice once trialExtendedAt is set (audit 2026-06-09)", () => {
    // In-window + low engagement (would otherwise extend), but already extended:
    // must be left exactly as-is so the trial can't renew indefinitely.
    const inOneDay = new Date(Date.now() + 86400000).toISOString();
    const state = withSettings({
      premiumTrialEndsAt: inOneDay,
      trialExtendedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    });
    expect(maybeExtendTrial(state)).toBe(state);
  });
});
