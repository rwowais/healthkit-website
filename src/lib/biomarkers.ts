/**
 * biomarkers.ts — body-trend catalog.
 *
 * Body-level signals only: composition (weight, waist, body fat) and the
 * cardio/autonomic markers a wearable can feed (resting HR, HRV, blood
 * pressure, VO₂ max, grip strength). Self-tracking and educational —
 * not medical advice.
 *
 * Lab/bloodwork panels (lipids, glucose, A1c, hs-CRP, etc.) were
 * intentionally removed: they carry clinical-interpretation liability and
 * don't drive the daily adaptation loop (recovery reads HRV + resting
 * HR). The `category` field + "blood" union member are retained so the
 * panel can be reintroduced later without a type change if ever desired.
 */

export type BiomarkerCategory = "body" | "blood";
export type Direction = "lower" | "higher" | "range";

export interface BiomarkerDef {
  key: string;
  label: string;
  unit: string;
  category: BiomarkerCategory;
  direction: Direction;
  /** optimal band edge(s) */
  optimal: number; // for lower: <=optimal ; higher: >=optimal
  watch: number; // boundary into the "watch" zone
  /** for range type: [lowOptimal, highOptimal] uses optimal & optimal2 */
  optimal2?: number;
  why: string;
  step?: number;
  placeholder?: string;
}

export const BIOMARKERS: BiomarkerDef[] = [
  // ── Body ──
  {
    key: "weight",
    label: "Weight",
    unit: "kg",
    category: "body",
    direction: "range",
    optimal: 0,
    watch: 0,
    why: "Tracked for trend, not an absolute target. Stable weight with rising strength is the goal.",
    step: 0.1,
    placeholder: "72.5",
  },
  {
    key: "waist",
    label: "Waist",
    unit: "cm",
    category: "body",
    direction: "lower",
    optimal: 90,
    watch: 102,
    why: "Central adiposity is a stronger metabolic-risk signal than weight or BMI alone.",
    step: 0.5,
  },
  {
    key: "bodyFat",
    label: "Body Fat",
    unit: "%",
    category: "body",
    direction: "lower",
    optimal: 18,
    watch: 28,
    why: "Lower body-fat with preserved lean mass tracks with metabolic health.",
    step: 0.1,
  },
  {
    key: "restingHR",
    label: "Resting HR",
    unit: "bpm",
    category: "body",
    direction: "lower",
    optimal: 60,
    watch: 75,
    why: "A lower resting heart rate generally reflects better cardiovascular fitness and recovery.",
  },
  {
    key: "hrv",
    label: "HRV",
    unit: "ms",
    category: "body",
    direction: "higher",
    optimal: 65,
    watch: 40,
    why: "Higher heart-rate variability reflects stronger autonomic balance and recovery capacity.",
  },
  {
    key: "systolic",
    label: "Blood Pressure (Sys)",
    unit: "mmHg",
    category: "body",
    direction: "lower",
    optimal: 120,
    watch: 130,
    why: "Elevated systolic pressure is a leading modifiable driver of cardiovascular risk.",
  },
  {
    key: "diastolic",
    label: "Blood Pressure (Dia)",
    unit: "mmHg",
    category: "body",
    direction: "lower",
    optimal: 80,
    watch: 85,
    why: "Diastolic pressure complements systolic in assessing vascular load.",
  },
  {
    key: "vo2max",
    label: "VO₂ Max",
    unit: "ml/kg/min",
    category: "body",
    direction: "higher",
    optimal: 48,
    watch: 35,
    why: "Cardiorespiratory fitness is one of the strongest predictors of all-cause mortality.",
  },
  {
    key: "gripStrength",
    label: "Grip Strength",
    unit: "kg",
    category: "body",
    direction: "higher",
    optimal: 45,
    watch: 30,
    why: "Grip strength is a robust proxy for total-body strength and longevity.",
  },
];

export function biomarkerDef(key: string): BiomarkerDef | undefined {
  return BIOMARKERS.find((b) => b.key === key);
}

export interface Band {
  label: "Optimal" | "Good" | "Watch" | "Track";
  color: string;
}

export function biomarkerBand(def: BiomarkerDef, value: number): Band {
  if (def.direction === "range") {
    return { label: "Track", color: "var(--readiness)" };
  }
  const { direction, optimal, watch } = def;
  if (direction === "lower") {
    if (value <= optimal) return { label: "Optimal", color: "var(--vitality)" };
    if (value <= watch) return { label: "Good", color: "var(--readiness)" };
    return { label: "Watch", color: "var(--alert)" };
  }
  // higher is better
  if (value >= optimal) return { label: "Optimal", color: "var(--vitality)" };
  if (value >= watch) return { label: "Good", color: "var(--readiness)" };
  return { label: "Watch", color: "var(--alert)" };
}

export function targetText(def: BiomarkerDef): string {
  if (def.direction === "range") return "Trend";
  if (def.direction === "lower") return `Target ≤ ${def.optimal} ${def.unit}`;
  return `Target ≥ ${def.optimal} ${def.unit}`;
}
