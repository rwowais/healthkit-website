/**
 * aiSchema.ts — the contract + the safety clamp for AI-drafted behaviors.
 *
 * Pure (no SDK, no network) so the governance guarantees are unit-tested
 * directly. Shared by the server route (which calls the model) and the
 * tests. The clamp is the load-bearing safety boundary: whatever the
 * model returns, `clampDraft` forces it into a safe, draft-only shape.
 *
 * Health-safety invariants enforced here, not trusted from the model:
 *  - evidence tier can never exceed 'emerging' (caps confidence claims)
 *  - aiUnverified is always true (a human must clear it before publish)
 *  - status is always 'draft' (AI can never mint a published row)
 *  - every enum / number / url is whitelisted & bounded; unknown fields
 *    are dropped (the model cannot smuggle extra columns through)
 */

export const BLOCKS = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const;
export const ANCHORS = ["wake", "bed", "fixed"] as const;
export const KINDS = ["action", "avoid", "reminder"] as const;
/** Tiers, strongest → weakest. AI output is capped at 'emerging'. */
export const EVIDENCE_TIERS = [
  "strong",
  "moderate",
  "emerging",
  "anecdotal",
] as const;
/** The hard ceiling for anything the model proposes. */
export const AI_MAX_TIER = "emerging";

/** Closed icon set (mirrors IconName in components/ui/icons). */
export const ICONS = [
  "sun","snowflake","coffee","moon","screen","thermometer","pill",
  "wind","clock","utensils","footprints","pulse","dumbbell","stretch",
  "hand","balance","ban","droplet","leaf","fish","wine","cube",
  "protein","flask","shield","sparkle","check","chevron","plus",
  "info","lungs","bed","home","layers","compass","user","bulb",
  "flame","arrowRight",
] as const;

export type Block = (typeof BLOCKS)[number];
export type Anchor = (typeof ANCHORS)[number];
export type Kind = (typeof KINDS)[number];
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export interface AiEvidence {
  tier: EvidenceTier;
  sourceLabel: string;
  url: string | null;
  summary: string;
}
export interface AiExplanation {
  why: string;
  timing: string;
}
/** The fully-clamped, safe draft the editor renders. */
export interface AiBehaviorDraft {
  title: string;
  block: Block;
  anchor: Anchor;
  offsetMin: number;
  dose: string | null;
  leverage: 1 | 2 | 3;
  kind: Kind;
  icon: string;
  rationale: string;
  evidence: AiEvidence;
  explanation: AiExplanation;
  /** Always true after clamp. The human-cleared flag lives in the DB. */
  aiUnverified: true;
}

/**
 * JSON Schema handed to the model via `output_config.format`. This only
 * shapes the model's output — it is NOT trusted; `clampDraft` re-checks
 * every field. `additionalProperties:false` keeps the surface tight.
 */
export const OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title","block","anchor","offsetMin","dose","leverage","kind",
    "icon","rationale","evidence","explanation",
  ],
  properties: {
    title: { type: "string", description: "Short imperative behavior name, e.g. 'Magnesium glycinate'." },
    block: { type: "string", enum: [...BLOCKS] },
    anchor: { type: "string", enum: [...ANCHORS], description: "What the timing is relative to." },
    // Bounds are enforced by clampDraft on the server — Anthropic's
    // structured-outputs schema does not support minimum/maximum on
    // integer types, so don't put them here.
    offsetMin: { type: "integer", description: "Minutes from the anchor (negative = before; typical range -240..240)." },
    // Empty string when there's no dose. clampDraft turns "" into null.
    dose: { type: "string", description: "Dose/amount if applicable, e.g. '300 mg', else empty string." },
    leverage: { type: "integer", enum: [1, 2, 3], description: "Impact: 3 = keystone, 1 = minor." },
    kind: { type: "string", enum: [...KINDS] },
    icon: { type: "string", enum: [...ICONS] },
    rationale: { type: "string", description: "One calm sentence on why this helps." },
    evidence: {
      type: "object",
      additionalProperties: false,
      required: ["tier", "sourceLabel", "url", "summary"],
      properties: {
        tier: { type: "string", enum: [...EVIDENCE_TIERS], description: "Best-guess strength of evidence (will be capped at 'emerging')." },
        sourceLabel: { type: "string", description: "Human-readable source, e.g. 'Meta-analysis, 2021'." },
        // Empty string when no URL. safeUrl() in clampDraft validates
        // and returns null for empty/non-http(s).
        url: { type: "string", description: "Source URL, or empty string if none. Must be http(s)." },
        summary: { type: "string", description: "One line on what the evidence shows." },
      },
    },
    explanation: {
      type: "object",
      additionalProperties: false,
      required: ["why", "timing"],
      properties: {
        why: { type: "string", description: "Why this behavior matters for the goal." },
        timing: { type: "string", description: "Why this time/anchor is right." },
      },
    },
  },
};

/**
 * The stable system prompt — kept here so it never varies per request
 * (the route caches it). Volatile input (the user's description) goes in
 * the user turn, AFTER the cache breakpoint.
 */
export const SYSTEM_PROMPT = `You are a careful longevity-protocol librarian for Protocolize.
From a short description, draft ONE atomic daily behavior with all of its
attributes. Be precise, calm, and conservative.

Rules:
- Never overstate evidence. Prefer 'emerging' or 'anecdotal' unless a
  behavior is genuinely backed by strong human RCT/meta-analytic data.
- Dosing must be a typical, conservative, general range — never a
  personalized medical instruction. Add the units.
- rationale: exactly one plain sentence, no hype.
- explanation.why: the mechanism/benefit in 1–2 sentences.
- explanation.timing: why this block/anchor/offset, 1 sentence.
- If a real citation isn't known, set evidence.url to "" and use a
  generic sourceLabel (e.g. "General physiology literature"). Never invent
  a specific URL.
- Set dose to "" when no dose applies (no amount/measurement).
- offsetMin is bounded server-side; keep it in the typical -240..240
  range (minutes from the anchor; negative = before).
- Output must satisfy the provided JSON schema exactly.`;

const clampStr = (v: unknown, max: number, fallback = ""): string => {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t ? t.slice(0, max) : fallback;
};

const inEnum = <T extends string>(
  v: unknown,
  list: readonly T[],
  fallback: T
): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

const clampInt = (
  v: unknown,
  lo: number,
  hi: number,
  fallback: number
): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** Keep only well-formed http(s) URLs — never javascript:, data:, etc. */
const safeUrl = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.toString().slice(0, 500)
      : null;
  } catch {
    return null;
  }
};

/**
 * Cap evidence at AI_MAX_TIER. 'strong'/'moderate' → 'emerging'; an
 * unknown/garbage value also lands at 'emerging' (never stronger).
 */
export function capTier(v: unknown): EvidenceTier {
  const t = inEnum(v, EVIDENCE_TIERS, AI_MAX_TIER);
  const ceilIdx = EVIDENCE_TIERS.indexOf(AI_MAX_TIER);
  const idx = EVIDENCE_TIERS.indexOf(t);
  return EVIDENCE_TIERS[Math.max(idx, ceilIdx)];
}

/**
 * THE safety boundary. Takes whatever the model produced (already
 * loosely shaped by the JSON schema, but never trusted) and returns a
 * guaranteed-safe, draft-only behavior. Total: never throws.
 */
export function clampDraft(raw: unknown): AiBehaviorDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const ev = (o.evidence && typeof o.evidence === "object"
    ? o.evidence
    : {}) as Record<string, unknown>;
  const ex = (o.explanation && typeof o.explanation === "object"
    ? o.explanation
    : {}) as Record<string, unknown>;

  const doseRaw = o.dose;
  const dose =
    typeof doseRaw === "string" && doseRaw.trim()
      ? doseRaw.trim().slice(0, 120)
      : null;

  return {
    title: clampStr(o.title, 120, "Untitled behavior"),
    block: inEnum(o.block, BLOCKS, "anytime"),
    anchor: inEnum(o.anchor, ANCHORS, "wake"),
    offsetMin: clampInt(o.offsetMin, -240, 240, 0),
    dose,
    leverage: clampInt(o.leverage, 1, 3, 2) as 1 | 2 | 3,
    kind: inEnum(o.kind, KINDS, "action"),
    icon: inEnum(o.icon, ICONS, "sparkle"),
    rationale: clampStr(o.rationale, 400, "Custom behavior (AI-drafted)."),
    evidence: {
      tier: capTier(ev.tier), // ← hard cap, never above 'emerging'
      sourceLabel: clampStr(
        ev.sourceLabel,
        160,
        "General physiology literature"
      ),
      url: safeUrl(ev.url),
      summary: clampStr(ev.summary, 400, ""),
    },
    explanation: {
      why: clampStr(ex.why, 600, ""),
      timing: clampStr(ex.timing, 400, ""),
    },
    aiUnverified: true, // ← always; the human clears it in the editor
  };
}

/** Plain-English help shown as field tooltips in the editor. */
export const FIELD_HELP: Record<string, string> = {
  title: "Short name users see on the timeline, e.g. 'Magnesium glycinate'.",
  block: "Which part of the day this lives in.",
  anchor:
    "What the time is measured from: wake-up, bedtime, or a fixed clock time.",
  offsetMin:
    "Minutes from the anchor. Negative = before it (e.g. -30 = 30 min before bed).",
  dose: "Amount/dose with units if relevant, e.g. '300 mg'. Leave blank if none.",
  leverage:
    "How much this moves the needle. 3 = keystone (highest impact), 1 = minor.",
  kind: "Action = do it · Avoid = don't do it · Reminder = a prompt only.",
  icon: "Small glyph shown next to the behavior.",
  rationale: "One calm sentence on why this helps — shown to users.",
  evidenceTier:
    "Strength of evidence. AI drafts are capped at 'emerging' until a human verifies the source.",
  evidenceSource: "Where the claim comes from, e.g. 'Meta-analysis, 2021'.",
  evidenceUrl: "Optional link to the source. Must be http(s).",
  evidenceSummary: "One line on what the evidence actually shows.",
  why: "The mechanism/benefit — why this behavior matters for the goal.",
  timing: "Why this time and anchor are the right slot.",
};
