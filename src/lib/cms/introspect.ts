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

/**
 * Config keys the runtime actually reads via getCfg*. Authoring a row
 * with a key NOT in this list is allowed (forward-compat) but has no
 * effect — the editor warns about it.
 */
export interface KnownConfigKey {
  key: string;
  type: "number";
  defaultValue: number;
  description: string;
}
export const KNOWN_CONFIG_KEYS: KnownConfigKey[] = [
  {
    key: "AHA_DAYS",
    type: "number",
    defaultValue: AHA_DAYS,
    description:
      "Engaged days before the reverse trial stops auto-extending.",
  },
  {
    key: "FREE_PACKS",
    type: "number",
    defaultValue: FREE_PACKS,
    description: "Official packs a free user may install.",
  },
  {
    key: "FREE_BIOMARKERS",
    type: "number",
    defaultValue: FREE_BIOMARKERS,
    description: "Distinct biomarkers a free user may track.",
  },
  {
    key: "FREE_INSIGHT_DAYS",
    type: "number",
    defaultValue: FREE_INSIGHT_DAYS,
    description: "Free insight window before the time-decayed peek.",
  },
];

/**
 * Insight template kinds the runtime actually reads via
 * getInsightTemplate. Authoring a row with a kind NOT in this list is
 * allowed but never fires — the editor warns about it.
 */
export interface KnownInsightKind {
  kind: string;
  defaultCopy: string;
  vars: string[];
  group: "suggestion" | "weekly";
}
export const KNOWN_INSIGHT_KINDS: KnownInsightKind[] = [
  { kind: "install-better-sleep-title", defaultCopy: "Your sleep keeps coming up short", vars: [], group: "suggestion" },
  { kind: "install-better-sleep-body", defaultCopy: "The Better Sleep protocol targets exactly this — light, temperature, and timing.", vars: [], group: "suggestion" },
  { kind: "install-better-sleep-cta", defaultCopy: "Install Better Sleep", vars: [], group: "suggestion" },
  { kind: "retime-title", defaultCopy: "“{title}” keeps slipping at its time", vars: ["title"], group: "suggestion" },
  { kind: "retime-body", defaultCopy: "Its scheduled slot isn't landing. Free it from the clock — do it whenever it fits, not on a schedule.", vars: [], group: "suggestion" },
  { kind: "retime-cta", defaultCopy: "Make it anytime", vars: [], group: "suggestion" },
  { kind: "pause-title", defaultCopy: "“{title}” isn't landing", vars: ["title"], group: "suggestion" },
  { kind: "pause-body", defaultCopy: "It's been skipped every recent day even unscheduled. Pausing it is not failure — it clears space for what works.", vars: [], group: "suggestion" },
  { kind: "pause-cta", defaultCopy: "Pause this behavior", vars: [], group: "suggestion" },
  { kind: "keystone-slipping-title", defaultCopy: "Your keystone is slipping", vars: [], group: "suggestion" },
  { kind: "keystone-slipping", defaultCopy: "On the days you do “{title}” you keep {delta} {pointWord} more of everything else — but it's been light lately. Re-anchor it tomorrow.", vars: ["title", "delta", "pointWord"], group: "suggestion" },
  { kind: "keystone-slipping-cta", defaultCopy: "Got it", vars: [], group: "suggestion" },
  { kind: "progression-title", defaultCopy: "You've earned a new layer", vars: [], group: "suggestion" },
  { kind: "progression-body", defaultCopy: "Your consistency is excellent. {name} stacks cleanly on your current system — overlaps merge automatically.", vars: ["name"], group: "suggestion" },
  { kind: "progression-cta", defaultCopy: "Explore {name}", vars: ["name"], group: "suggestion" },
  { kind: "weekly-headline-up", defaultCopy: "A stronger week — up {delta} points. Momentum is real.", vars: ["delta"], group: "weekly" },
  { kind: "weekly-headline-down", defaultCopy: "A lighter week, down {abs}. Not a setback — a signal to simplify.", vars: ["abs"], group: "weekly" },
  { kind: "weekly-headline-strong", defaultCopy: "A strong, steady week. This is what good looks like.", vars: [], group: "weekly" },
  { kind: "weekly-headline-steady", defaultCopy: "A solid week of showing up. That's the whole game.", vars: [], group: "weekly" },
  { kind: "weekly-wins-active", defaultCopy: "{count} of 7 days active", vars: ["count"], group: "weekly" },
  { kind: "weekly-wins-best", defaultCopy: "Best day was {dayName} at {score}", vars: ["dayName", "score"], group: "weekly" },
  { kind: "weekly-wins-kept", defaultCopy: "Kept “{title}” {count} days", vars: ["title", "count"], group: "weekly" },
  { kind: "weekly-focus-tighten", defaultCopy: "Next week, tighten one thing: “{title}”. It's your highest-leverage gap.", vars: ["title"], group: "weekly" },
  { kind: "weekly-focus-hold", defaultCopy: "Next week, hold the line. Consistency at this level compounds quietly.", vars: [], group: "weekly" },
  { kind: "continuity-holding", defaultCopy: "Last week we flagged “{title}” — you lifted it to {count} of {total} days. It's holding.", vars: ["title", "count", "total"], group: "weekly" },
  { kind: "continuity-light", defaultCopy: "Last week's focus was “{title}” — still light ({count} of {total}). One small re-anchor, not a verdict.", vars: ["title", "count", "total"], group: "weekly" },
];

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
