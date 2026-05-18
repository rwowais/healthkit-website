import type { Pillar } from "./types";

export interface PillarMeta {
  key: Pillar;
  label: string;
  pluralLabel: string;
  icon: string;
  color: string;
  bgLight: string;
  description: string;
}

export const PILLAR_META: Record<Pillar, PillarMeta> = {
  sleep: {
    key: "sleep",
    label: "Sleep",
    pluralLabel: "Sleep Protocols",
    icon: "🌙",
    color: "#5e5ce6",
    bgLight: "rgba(94, 92, 230, 0.1)",
    description: "Optimize your sleep for recovery and cognitive performance",
  },
  exercise: {
    key: "exercise",
    label: "Exercise",
    pluralLabel: "Exercise Protocols",
    icon: "🏋️",
    color: "#ff453a",
    bgLight: "rgba(255, 69, 58, 0.1)",
    description: "Build strength, endurance, and metabolic health",
  },
  nutrition: {
    key: "nutrition",
    label: "Nutrition",
    pluralLabel: "Nutrition Protocols",
    icon: "🥗",
    color: "#30d158",
    bgLight: "rgba(48, 209, 88, 0.1)",
    description: "Fuel your body with evidence-based nutrition practices",
  },
  supplements: {
    key: "supplements",
    label: "Supplements",
    pluralLabel: "Supplement Protocols",
    icon: "💊",
    color: "#ff9f0a",
    bgLight: "rgba(255, 159, 10, 0.1)",
    description: "Targeted supplementation backed by research",
  },
};

export const PILLARS: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];

export const COLORS = {
  accent: "#0071e3",
  accentHover: "#0077ED",
  accentLight: "rgba(0, 113, 227, 0.1)",
  background: "#000000",
  surface: "#1c1c1e",
  surfaceElevated: "#2c2c2e",
  surfaceTertiary: "#3a3a3c",
  textPrimary: "#ffffff",
  textSecondary: "#8e8e93",
  textTertiary: "#636366",
  border: "#38383a",
  borderLight: "#2c2c2e",
  success: "#30d158",
  warning: "#ff9f0a",
  error: "#ff453a",
  info: "#5e5ce6",
} as const;

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
