/**
 * biomarkers.ts — generic, evidence-informed biomarker catalog.
 *
 * Ranges reflect commonly cited optimal vs. standard reference targets for
 * healthspan. Educational only — not medical advice, not branded to any
 * individual. Always interpret labs with a clinician.
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

  // ── Bloodwork ──
  {
    key: "apoB",
    label: "ApoB",
    unit: "mg/dL",
    category: "blood",
    direction: "lower",
    optimal: 80,
    watch: 100,
    why: "ApoB counts atherogenic particles directly — a sharper cardiovascular risk marker than LDL-C alone.",
  },
  {
    key: "ldlC",
    label: "LDL-C",
    unit: "mg/dL",
    category: "blood",
    direction: "lower",
    optimal: 100,
    watch: 130,
    why: "Lower LDL cholesterol over a lifetime lowers atherosclerotic burden.",
  },
  {
    key: "hdlC",
    label: "HDL-C",
    unit: "mg/dL",
    category: "blood",
    direction: "higher",
    optimal: 55,
    watch: 40,
    why: "Context-dependent, but very low HDL often accompanies metabolic dysfunction.",
  },
  {
    key: "triglycerides",
    label: "Triglycerides",
    unit: "mg/dL",
    category: "blood",
    direction: "lower",
    optimal: 90,
    watch: 150,
    why: "Elevated triglycerides signal insulin resistance and metabolic strain.",
  },
  {
    key: "fastingGlucose",
    label: "Fasting Glucose",
    unit: "mg/dL",
    category: "blood",
    direction: "lower",
    optimal: 90,
    watch: 100,
    why: "Rising fasting glucose is an early signal on the path to insulin resistance.",
  },
  {
    key: "fastingInsulin",
    label: "Fasting Insulin",
    unit: "µIU/mL",
    category: "blood",
    direction: "lower",
    optimal: 5,
    watch: 9,
    why: "One of the earliest detectable markers of metabolic dysfunction — often years before glucose moves.",
  },
  {
    key: "hba1c",
    label: "HbA1c",
    unit: "%",
    category: "blood",
    direction: "lower",
    optimal: 5.3,
    watch: 5.7,
    why: "Reflects average glucose over ~3 months; lower is generally better within normal range.",
    step: 0.1,
  },
  {
    key: "hsCRP",
    label: "hs-CRP",
    unit: "mg/L",
    category: "blood",
    direction: "lower",
    optimal: 1,
    watch: 3,
    why: "A sensitive marker of systemic inflammation linked to cardiovascular and metabolic risk.",
    step: 0.1,
  },
  {
    key: "lpa",
    label: "Lp(a)",
    unit: "nmol/L",
    category: "blood",
    direction: "lower",
    optimal: 75,
    watch: 125,
    why: "Largely genetic; a high value meaningfully raises cardiovascular risk and is worth knowing once.",
  },
  {
    key: "omega3Index",
    label: "Omega-3 Index",
    unit: "%",
    category: "blood",
    direction: "higher",
    optimal: 8,
    watch: 4,
    why: "Higher omega-3 red-cell content is associated with lower cardiovascular and all-cause risk.",
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
