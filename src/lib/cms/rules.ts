/**
 * rules.ts — the CMS adaptation-rule interpreter.
 *
 * Pure: no I/O, no Supabase, no engine reads. Takes a context object
 * (the daily signals computed by getSignals) and a list of rules, and
 * returns the first matching rule by priority. adapt() in engine.ts
 * threads its baseline through pickMatchingRule and the effect can
 * override mode / headline / tone — nothing else.
 *
 * Trigger language (tight on purpose):
 *  - A condition is { metric, op, value }.
 *  - A trigger is { all: [...] }, { any: [...] }, or both.
 *    - both → all conditions in `all` must match AND any one in `any`.
 *    - empty/missing trigger → always matches.
 *
 * Available metrics live in RULE_METRICS so the editor can show the
 * admin the contract instead of forcing them to guess.
 */

export type RuleOp = "<" | "<=" | ">" | ">=" | "==" | "!=";

export interface RuleCondition {
  metric: string;
  op: RuleOp;
  value: number | string | boolean;
}

export interface RuleTrigger {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export type AdaptMode =
  | "rebuild"
  | "recovery"
  | "essentials"
  | "lighter"
  | "primed"
  | "normal";

export interface RuleEffect {
  /** Replace the mode chosen by the hardcoded adapt() baseline. */
  setMode?: AdaptMode;
  /** Optional headline override (passes through renderTemplate vars). */
  headline?: string;
  /** Optional calm-tone copy override. */
  tone?: string;
  /** Optional reason string appended to reasons[]. */
  reason?: string;
}

export interface AdaptationRule {
  /** Stable display name (also used in the audit trail). */
  name: string;
  /** Lower number wins. The hardcoded baseline behaves as priority 1000. */
  priority: number;
  /** Stored as jsonb in cms_adaptation_rules — evalTrigger handles any
   *  shape, treating garbage as a non-match. */
  trigger: unknown;
  /** Same: sanitizeEffect whitelists what an effect can actually do. */
  effect: unknown;
}

/** What's safe to reference in a trigger. The editor shows this. */
export interface MetricMeta {
  name: string;
  type: "number" | "boolean" | "string";
  description: string;
}
export const RULE_METRICS: MetricMeta[] = [
  {
    name: "gapDays",
    type: "number",
    description: "Days since the last engaged day (0 = active today).",
  },
  {
    name: "recoveryProxy",
    type: "number",
    description:
      "0-100 recovery score: 60% sleep + 40% energy, or wearable readiness when present.",
  },
  {
    name: "adherence7",
    type: "number",
    description: "Average score % over the last 7 tracked days (0-100).",
  },
  {
    name: "sleepQuality",
    type: "number",
    description: "Last logged sleep rating (1-5).",
  },
  {
    name: "energy",
    type: "number",
    description: "Last logged energy rating (1-5).",
  },
  {
    name: "trackedDays",
    type: "number",
    description: "Tracked days in the last 7 (used to gate small-sample rules).",
  },
  {
    name: "eveningMissedYesterday",
    type: "boolean",
    description: "True if the evening wind-down slipped yesterday.",
  },
  {
    name: "bioRecoveryFlag",
    type: "boolean",
    description: "True if any biomarker is currently in a 'watch' band.",
  },
];
const VALID_METRICS = new Set(RULE_METRICS.map((m) => m.name));
const VALID_OPS: RuleOp[] = ["<", "<=", ">", ">=", "==", "!="];

/** Evaluate one condition. Unknown metric or null value → false. */
export function evalCondition(
  c: RuleCondition,
  ctx: Record<string, unknown>
): boolean {
  if (!c || typeof c !== "object") return false;
  if (!VALID_METRICS.has(c.metric)) return false;
  if (!VALID_OPS.includes(c.op)) return false;
  const lhs = ctx[c.metric];
  if (lhs == null) return false; // null/undefined never matches
  const rhs = c.value;
  switch (c.op) {
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (typeof lhs !== "number" || typeof rhs !== "number") return false;
      switch (c.op) {
        case "<":
          return lhs < rhs;
        case "<=":
          return lhs <= rhs;
        case ">":
          return lhs > rhs;
        case ">=":
          return lhs >= rhs;
      }
    }
  }
}

/** Evaluate a trigger. Missing/empty trigger matches by definition. */
export function evalTrigger(
  t: unknown,
  ctx: Record<string, unknown>
): boolean {
  if (!t || typeof t !== "object") return true;
  const obj = t as RuleTrigger;
  const all = Array.isArray(obj.all) ? obj.all : [];
  const any = Array.isArray(obj.any) ? obj.any : [];
  if (all.length === 0 && any.length === 0) return true;
  const allOk = all.every((c) => evalCondition(c, ctx));
  const anyOk = any.length === 0 || any.some((c) => evalCondition(c, ctx));
  return allOk && anyOk;
}

/**
 * Pick the first matching rule by ascending priority. Ties broken by
 * insertion order (stable). Returns null if none match.
 */
export function pickMatchingRule(
  rules: AdaptationRule[],
  ctx: Record<string, unknown>
): AdaptationRule | null {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const matching = rules
    .filter((r) => r && typeof r === "object" && evalTrigger(r.trigger, ctx))
    .sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));
  return matching[0] ?? null;
}

const VALID_MODES = new Set<AdaptMode>([
  "rebuild",
  "recovery",
  "essentials",
  "lighter",
  "primed",
  "normal",
]);

/** Whitelist what an effect can do — keeps the interpreter narrow. */
export function sanitizeEffect(e: unknown): RuleEffect {
  if (!e || typeof e !== "object") return {};
  const o = e as Record<string, unknown>;
  const out: RuleEffect = {};
  if (
    typeof o.setMode === "string" &&
    VALID_MODES.has(o.setMode as AdaptMode)
  )
    out.setMode = o.setMode as AdaptMode;
  if (typeof o.headline === "string") out.headline = o.headline.slice(0, 120);
  if (typeof o.tone === "string") out.tone = o.tone.slice(0, 400);
  if (typeof o.reason === "string") out.reason = o.reason.slice(0, 160);
  return out;
}
