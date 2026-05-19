/**
 * entitlements.ts — single source of truth for premium access.
 *
 * Reverse-trial: every new user gets full Premium until
 * settings.premiumTrialEndsAt. Engagement-gated: we never let the
 * trial lapse before the user has had a real chance at the aha
 * (>= AHA_DAYS tracked days) — if they're short, we quietly extend.
 */
import type { AppState } from "./types";

export const AHA_DAYS = 6;
export const FREE_PACKS = 3;
export const FREE_BIOMARKERS = 3;
export const FREE_INSIGHT_DAYS = 7;

export interface Access {
  premium: boolean; // full access (paid OR active trial)
  paid: boolean; // actually subscribed
  inTrial: boolean;
  trialDaysLeft: number; // 0 if none/expired
  trialExpired: boolean; // had a trial, now over, not paid
}

function trackedDays(state: AppState): number {
  return (state.dailyLogs ?? []).filter((l) => l.score > 0).length;
}

export function getAccess(state: AppState): Access {
  const paid = state.settings.tier === "premium";
  const endIso = state.settings.premiumTrialEndsAt;
  const now = Date.now();
  let inTrial = false;
  let trialDaysLeft = 0;
  let trialExpired = false;

  if (endIso) {
    const end = new Date(endIso).getTime();
    if (now < end) {
      inTrial = true;
      trialDaysLeft = Math.max(
        1,
        Math.ceil((end - now) / 86_400_000)
      );
    } else if (!paid) {
      trialExpired = true;
    }
  }

  return {
    premium: paid || inTrial,
    paid,
    inTrial: inTrial && !paid,
    trialDaysLeft,
    trialExpired,
  };
}

/**
 * One-shot, idempotent: if the trial is within 3 days of ending and the
 * user hasn't reached the aha threshold, push it out a week so we never
 * paywall someone before they've felt the value.
 */
export function maybeExtendTrial(state: AppState): AppState {
  const { tier, premiumTrialEndsAt } = state.settings;
  if (tier === "premium" || !premiumTrialEndsAt) return state;
  const end = new Date(premiumTrialEndsAt).getTime();
  const now = Date.now();
  const within3Days = end - now < 3 * 86_400_000 && end - now > -86_400_000;
  if (!within3Days) return state;
  if (trackedDays(state) >= AHA_DAYS) return state; // had their chance
  return {
    ...state,
    settings: {
      ...state.settings,
      premiumTrialEndsAt: new Date(now + 7 * 86_400_000).toISOString(),
    },
  };
}
