/**
 * legal.ts — the acceptance machinery behind /terms and /privacy.
 *
 * Two problems this solves (2026-08-17):
 *
 * 1. Nothing ever RECORDED acceptance. The fields existed in types.ts but no
 *    code wrote them, so there was no evidence any user agreed to anything —
 *    which weakens every clause that depends on agreement (arbitration most
 *    of all). Onboarding now stamps acceptance at its consent moment, and
 *    LegalGate stamps it for everyone who predates the mechanism.
 *
 * 2. Both legal pages PROMISED a re-acceptance banner that did not exist.
 *    LegalGate is that banner. It is also the only sound path to expanding
 *    how data may be used later: change the policy, bump LEGAL_VERSION, and
 *    every user is asked again. Applying a broadened policy to data collected
 *    under the old one, without fresh consent, is the pattern regulators
 *    actually punish — so this banner is not polish, it is the mechanism that
 *    keeps future changes possible.
 */
import type { AppState } from "./types";
import { LEGAL_VERSION } from "./constants";

/**
 * Should this user be asked to (re-)accept the current legal docs?
 *
 * - Not onboarded yet → no. Onboarding's final step carries the consent line
 *   and stamps acceptance; showing a banner mid-setup would double-ask.
 * - Onboarded but never stamped → yes. These users predate the mechanism
 *   (every account before 2026-08-17); they get the banner exactly once.
 * - Stamped an older version → yes: the docs materially changed since.
 * - Stamped current (or somehow newer, e.g. state restored from a newer
 *   build) → no.
 */
export function needsLegalAcceptance(
  state: Pick<AppState, "settings"> | null | undefined
): boolean {
  const s = state?.settings;
  if (!s?.completedOnboarding) return false;
  return (s.legalAcceptedVersion ?? 0) < LEGAL_VERSION;
}

/**
 * The settings patch that records acceptance of the CURRENT version.
 * Lives in synced state on purpose: the stamp (version + timestamp) rides in
 * the user's own row, so the record survives device changes and is visible
 * to the user via export.
 */
export function acceptanceStamp(): {
  legalAcceptedVersion: number;
  legalAcceptedAt: string;
} {
  return {
    legalAcceptedVersion: LEGAL_VERSION,
    legalAcceptedAt: new Date().toISOString(),
  };
}
