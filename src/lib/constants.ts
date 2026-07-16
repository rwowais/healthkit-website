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
export const LEGAL_VERSION = 1;

export const TRIAL_DURATION_DAYS = 7;

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
