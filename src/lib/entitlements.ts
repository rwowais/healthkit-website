/**
 * entitlements.ts — single source of truth for premium access.
 *
 * Reverse-trial: every new user gets full Premium until
 * settings.premiumTrialEndsAt. Engagement-gated: we never let the
 * trial lapse before the user has had a real chance at the aha
 * (>= AHA_DAYS tracked days) — if they're short, we quietly extend.
 */
import type { AppState } from "./types";
import { getCfgNumber } from "./knowledge";

/**
 * Source-of-truth defaults. Kept exported so the introspect surface and
 * the Engine → Config inspector display the code defaults; ALL
 * runtime gates now go through the `getX()` accessors below so a CMS
 * Publish that overrides any of these takes effect without redeploying.
 */
export const AHA_DAYS = 6;
export const FREE_PACKS = 3;
export const FREE_BIOMARKERS = 3;
/** Free-tier insight DELAY in days: free users see full history but lagged this
 *  many days behind today; Premium is real-time. This is the actual shipped
 *  gate (insights/page.tsx reads getFreeInsightDays()), so changing it in CMS
 *  Config genuinely moves the delay — it is not a dead knob. */
export const FREE_INSIGHT_DAYS = 3;

/** Runtime accessors: the published bundle wins; code default is the fallback. */
export const getAhaDays = (): number => getCfgNumber("AHA_DAYS", AHA_DAYS);
export const getFreePacks = (): number =>
  getCfgNumber("FREE_PACKS", FREE_PACKS);
export const getFreeBiomarkers = (): number =>
  getCfgNumber("FREE_BIOMARKERS", FREE_BIOMARKERS);
export const getFreeInsightDays = (): number =>
  getCfgNumber("FREE_INSIGHT_DAYS", FREE_INSIGHT_DAYS);

export interface Access {
  premium: boolean; // full access (paid OR active trial)
  paid: boolean; // actually subscribed
  inTrial: boolean;
  trialDaysLeft: number; // 0 if none/expired
  trialExpired: boolean; // had a trial, now over, not paid
}

/**
 * Server-authoritative paid entitlement (audit SEC-1, 2026-07-16). Sourced from
 * the `protocolize_entitlements` table, whose ONLY writer is a service-role call
 * (the Stripe webhook / a manual admin grant) — a user cannot write it. This is
 * what makes `paid` un-forgeable: a hand-edited local `settings.tier` no longer
 * buys premium, because in cloud mode getAccess() reads THIS instead.
 */
export interface Entitlement {
  paidTier: "free" | "premium";
  status:
    | "none"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "expired";
  plan?: "monthly" | "annual" | "lifetime" | null;
  currentPeriodEnd?: string | null;
  /** ISO stamp of when this was fetched/synthesized (for staleness/debug). */
  syncedAt: string;
}

// The entitlement is DELIBERATELY kept out of AppState (and therefore out of the
// synced protocolize-v3 blob / protocolize_state row) so it can never round-trip
// as user-writable data. It lives here as a module value, hydrated from a
// dedicated cache key, and is (re)set on every cloud load() from the server row.
const ENTITLEMENT_CACHE_KEY = "pz:entitlement";
let runtimeEntitlement: Entitlement | null = null;

/**
 * Set the current server-authoritative entitlement (called by the cloud
 * datasource after reading the entitlements table; pass null to clear). In
 * cloud mode this is always set — to the real row, or a synthesized `free`
 * when the signed-in user (or a guest) has no row. In local-only mode it is
 * never set, so getAccess() falls back to settings.tier (no monetization).
 */
export function setEntitlement(e: Entitlement | null): void {
  runtimeEntitlement = e;
  if (typeof window === "undefined") return;
  try {
    if (e) localStorage.setItem(ENTITLEMENT_CACHE_KEY, JSON.stringify(e));
    else localStorage.removeItem(ENTITLEMENT_CACHE_KEY);
  } catch {
    /* quota / unavailable — the in-memory value still governs this session */
  }
}

/** The current entitlement: the live value, else the last-cached one (offline). */
export function getEntitlement(): Entitlement | null {
  if (runtimeEntitlement) return runtimeEntitlement;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENTITLEMENT_CACHE_KEY);
    if (raw) {
      runtimeEntitlement = JSON.parse(raw) as Entitlement;
      return runtimeEntitlement;
    }
  } catch {
    /* corrupt cache — treat as absent */
  }
  return null;
}

/**
 * "Engaged" days, not just scored days: a check-in (sleep/energy) or any
 * behavior completion counts. Scoring alone (`score > 0`) under-counts a
 * user who shows up and reflects but completes nothing — they've still
 * had a real chance at the aha, and we shouldn't paywall them early.
 */
function engagedDays(state: AppState): number {
  return (state.dailyLogs ?? []).filter(
    (l) =>
      l.score > 0 ||
      l.sleepLog?.sleepQuality != null ||
      l.energyLevel != null ||
      Object.values(l.behaviorCompletions ?? {}).some(Boolean) ||
      // Live supplement model — a perfectly-adherent supplement-only user was
      // counted as "under-engaged" and silently granted the pity trial extend
      // (the last of the parallel activity definitions; audit round 2).
      Object.values(l.supplementCompletions ?? {}).some(Boolean) ||
      (l.supplementSkips?.length ?? 0) > 0
  ).length;
}

export function getAccess(state: AppState): Access {
  // SEC-1: `paid` is server-authoritative when we have an entitlement (cloud
  // mode). A forged local settings.tier is ignored there — only the entitlements
  // table (webhook/manual grant) can set premium. Local-only mode (no cloud,
  // no monetization) still trusts settings.tier. Trial is unchanged: it's
  // time-boxed and self-limiting, so it stays client-side.
  const ent = getEntitlement();
  const paid = ent
    ? ent.paidTier === "premium"
    : state.settings.tier === "premium";
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
  const { tier, premiumTrialEndsAt, trialExtendedAt } = state.settings;
  if (tier === "premium" || !premiumTrialEndsAt) return state;
  // Genuinely one-shot: once we've extended, never extend again. Without this
  // guard the extension renewed every time an under-engaged user re-entered the
  // 3-day window (~weekly), indefinitely deferring the paywall — contradicting
  // this function's "one-shot, idempotent" contract.
  if (trialExtendedAt) return state;
  const end = new Date(premiumTrialEndsAt).getTime();
  const now = Date.now();
  // Forgiving window: from 3 days before expiry up to a week *after* —
  // a returning user who hasn't had their aha still gets a fair runway
  // rather than a hard paywall the moment they come back.
  const inWindow =
    end - now < 3 * 86_400_000 && end - now > -7 * 86_400_000;
  if (!inWindow) return state;
  if (engagedDays(state) >= getAhaDays()) return state; // had their chance
  return {
    ...state,
    settings: {
      ...state.settings,
      premiumTrialEndsAt: new Date(now + 7 * 86_400_000).toISOString(),
      // Stamp the extension so Today can surface a calm one-time note —
      // a silent extension feels invisible; a *seen* one feels generous.
      trialExtendedAt: new Date(now).toISOString(),
    },
  };
}
