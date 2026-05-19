/**
 * introspect.ts — read-only descriptors of the *live* intelligence.
 *
 * Until a CMS bundle is published the runtime knowledge is the built-in
 * catalog + engine constants. This makes that knowledge inspectable
 * (the whole point: no hidden rules), sourced from the REAL exported
 * constants where possible so it can't drift from what actually runs.
 */
import {
  RECOVERY_DEMOTE,
  RECOVERY_PROMOTE,
  RESTRAINT_KEYS,
  TRAINING_KEYS,
  CIRCADIAN,
} from "../engine";
import {
  AHA_DAYS,
  FREE_PACKS,
  FREE_BIOMARKERS,
  FREE_INSIGHT_DAYS,
} from "../entitlements";

export interface ModeDesc {
  mode: string;
  trigger: string;
  effect: string;
}

/** Faithful prose of adapt()/shapeTimeline as implemented. */
export const ADAPTIVE_MODES: ModeDesc[] = [
  {
    mode: "rebuild",
    trigger: "Away ≥ 2 days (gap since last active).",
    effect: "Trim to the 3 highest-leverage, block-diverse, keystone-first — restarting feels effortless.",
  },
  {
    mode: "recovery",
    trigger: "Recovery proxy < 45 (sleep 60% · energy 40%).",
    effect: "Mute demanding training; promote restoration; reorder recovery-critical first.",
  },
  {
    mode: "essentials",
    trigger: "7-day adherence < 35 with ≥ 3 tracked days.",
    effect: "Only leverage-3 behaviors stay; cap visible set so load truly drops.",
  },
  {
    mode: "lighter",
    trigger: "Last night's sleep rated ≤ 2, or a recovery biomarker in 'watch'.",
    effect: "Mute leverage-1 (easy-win) behaviors; lower the bar, protect tonight.",
  },
  {
    mode: "primed",
    trigger: "Recovery proxy ≥ 78.",
    effect: "No muting — a strong day to push hardest training and deep focus.",
  },
  {
    mode: "normal",
    trigger: "Default (incl. 'protect tonight' if evening slipped yesterday).",
    effect: "Full calm day, block by block; momentum over perfection.",
  },
];

export interface RuleSet {
  name: string;
  purpose: string;
  keys: string[];
}

export const RULE_SETS: RuleSet[] = [
  {
    name: "Recovery — demote",
    purpose: "Muted in recovery mode (too demanding when depleted).",
    keys: [...RECOVERY_DEMOTE],
  },
  {
    name: "Recovery — promote",
    purpose: "Surfaced first in recovery mode (restoration).",
    keys: [...RECOVERY_PROMOTE],
  },
  {
    name: "Restraint",
    purpose: "When active, hard training is auto-muted (no contradiction).",
    keys: [...RESTRAINT_KEYS],
  },
  {
    name: "Training",
    purpose: "Hard-effort behaviors a restraint will suppress.",
    keys: [...TRAINING_KEYS],
  },
  {
    name: "Circadian anchors",
    purpose: "Tagged 'circadian anchor' — timing-critical for sleep.",
    keys: [...CIRCADIAN],
  },
];

export interface ConfigRow {
  key: string;
  value: string;
  kind: "live constant" | "documented";
  note: string;
}

export const CONFIG_ROWS: ConfigRow[] = [
  {
    key: "AHA_DAYS",
    value: String(AHA_DAYS),
    kind: "live constant",
    note: "Engaged days before the trial stops auto-extending.",
  },
  {
    key: "FREE_PACKS",
    value: String(FREE_PACKS),
    kind: "live constant",
    note: "Official packs a free user may install.",
  },
  {
    key: "FREE_BIOMARKERS",
    value: String(FREE_BIOMARKERS),
    kind: "live constant",
    note: "Distinct biomarkers a free user may track.",
  },
  {
    key: "FREE_INSIGHT_DAYS",
    value: String(FREE_INSIGHT_DAYS),
    kind: "live constant",
    note: "Free insight window before the time-decayed peek.",
  },
  {
    key: "TRIAL_DAYS",
    value: "14",
    kind: "documented",
    note: "Reverse-trial length seeded at onboarding.",
  },
  {
    key: "MASTERY_STREAK / ADHERENCE",
    value: "21 days · ≥ 0.85",
    kind: "documented",
    note: "Periodization: graduate a behavior to maintenance.",
  },
  {
    key: "KEYSTONE d threshold",
    value: "0.35 + 0.05·log2(#behaviors)",
    kind: "documented",
    note: "Effect-size + multiple-comparison gate.",
  },
];

export interface IntelKind {
  name: string;
  does: string;
  gate: string;
}

export const INTEL_KINDS: IntelKind[] = [
  {
    name: "Keystone",
    does: "The behavior most predicting you keep everything else.",
    gate: "De-circularised, ≥8/≥3 sample, Cohen's d, multiple-comparison.",
  },
  {
    name: "Proven for you (outcome)",
    does: "Behaviors that track with your own energy/sleep check-ins.",
    gate: "Felt outcome (non-circular), ≥8/≥4, effect size, honest null.",
  },
  {
    name: "Weekly review",
    does: "Calm narrative + last week's focus continuity.",
    gate: "≥4 tracked days this week.",
  },
  {
    name: "Personal model / Identity",
    does: "Longitudinal traits + monthly 'who you've become'.",
    gate: "≥12 active days (model) · ≥21 / 12 active (identity).",
  },
  {
    name: "Suggestions",
    does: "Install / re-time / pause / progression — calm, dismissible.",
    gate: "Never pauses the keystone; re-time before pause.",
  },
];
