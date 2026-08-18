import type { Pillar } from "./types";

// NOTE: the pre-v4 hardcoded hex palettes (COLORS, PILLAR_META) were removed
// 2026-07-16 (audit UI-15) — dead code, zero importers, superseded by the CSS
// design-token system in globals.css. Do not reintroduce hardcoded colors here.

export const PILLARS: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  "4xl": "2.5rem",
} as const;

export const STORAGE_KEY = "protocolize-v3";
/** Older keys we migrate from / clear on reset. */
export const LEGACY_STORAGE_KEYS = ["protocolize-v2", "protocolize-v1"];

/**
 * Legal document version. Bump this when Terms or Privacy change
 * materially — the app will then re-prompt accepted users to confirm
 * the new docs (minor copy fixes don't justify a bump).
 */
// v3 (2026-08-17): privacy reserves de-identified/aggregated use; terms add
// the service-evolution clause; the acceptance banner (LegalGate) now actually
// exists. Nobody ever recorded acceptance of v1/v2 (the mechanism didn't
// exist), so every existing account sees the banner once.
// v4 (2026-08-17, same day): the documents now NAME the contracting party —
// RO Group LLC. Naming the counterparty is material (it's who the arbitration
// clause binds users to), so it re-asks; at bump time exactly one account had
// accepted v3 (the owner), so the cost was one banner tap.
// v5 (2026-08-17): clauses adopted from a Built With Science benchmark —
// indemnification, conspicuous AS-IS block, feedback license (load-bearing
// for the new Request-a-feature), business-transfer/assignment (without it an
// acquisition could not lawfully take the database along), fine-print block,
// GPC line. Indemnification + business transfer are material -> re-ask.
// v8 (2026-08-18): owner asked for maximum defensibility. Added a health
// representation + release, broadened indemnity to use-of-Services, a 1-year
// contractual limitations period, an explicit jury-trial waiver, no-refunds-
// by-default (discretionary exceptions retained), no refund on for-cause
// termination, third-party content disclaimer, and a survival clause.
// Governing law moved from the USER's state to the company's. All of these
// REDUCE user rights -> unambiguous re-ask. Owner had accepted v7.
// Verified before bumping: zero accounts had accepted v4.
// v6 (2026-08-18): the intelligence-layer clause — personalized suggestions
// are algorithmic educational starting points, no professional relationship,
// supplement doses are published ranges not prescriptions (DSHEA line, also
// rendered on /supplements where the claims appear), and an explicit
// assumption of risk. Material (a new user acknowledgment) -> re-ask; the
// owner had accepted v5, so cost = one more tap by the owner.
// v7 (2026-08-18): promises recast from "never" (eternal, un-walk-backable
// for already-collected data) to PRESENT TENSE + changes-apply-after-you-
// accept — the owner wants ads/monetization options open. Kept strong on
// purpose: health-data ad targeting still requires separate explicit opt-in
// (law effectively mandates it — WA MHMD, state sensitive-data consent, FTC
// GoodRx/BetterHelp), no-re-identification, and the technical facts
// (passwords, card numbers). WEAKENING promises is the clearest re-ask case
// there is; the owner had accepted v6.
// v9 (2026-08-18): the app is now Diurna Health (was Protocolize). Renaming
// the service is a change to WHAT the user agreed to use, so the documents
// naming it must be re-accepted — cheap here, since only the owner had
// accepted v8. RO Group LLC (the contracting party) is unchanged.
export const LEGAL_VERSION = 9;

/**
 * Formation state of RO Group LLC. Owner has not confirmed it yet, so the
 * legal docs fall back to entity-relative phrasing ("the state in which RO
 * Group LLC is organized") — valid, just less precise. Set this string and
 * both documents sharpen automatically.
 */
export const ENTITY_STATE: string | null = null;
export const ENTITY_NAME = "RO Group LLC";

// Trial length is NOT here — it is entitlements.TRIAL_DAYS (7), the single
// source of truth that onboarding, terms and the import clamp all derive from.
// (A dead TRIAL_DURATION_DAYS lived here until 2026-08-16; it read 7 while the
// shipped trial was 14, so it was deleted as "wrong" — and 7 then turned out
// to be the intended value. Keep the number in one place so they can't
// disagree again.)

export const SCORE_WEIGHTS = {
  completionBase: 80,
  sleepLogBonus: 5,
  morningCompleteBonus: 5,
  eveningCompleteBonus: 5,
  noteBonus: 5,
} as const;

export const TIME_OF_DAY_RANGES = {
  morning: { start: 5, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 5 },
} as const;

export const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const QUALITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};
