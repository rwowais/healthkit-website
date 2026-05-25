/**
 * help.ts — structured field help shown by the `<Hint>` component
 * across the admin. Each entry: a short prose summary + a concrete
 * example, so a non-developer can read it without context.
 *
 * Keep entries terse. The Hint popover is small.
 */

export interface HelpEntry {
  summary: string;
  example?: string;
}

export const HELP: Record<string, HelpEntry> = {
  // ── Behavior fields ───────────────────────────────────────────────
  "behavior.title": {
    summary: "Short name users see on the timeline. Use plain language.",
    example: "Magnesium glycinate",
  },
  "behavior.block": {
    summary: "Which part of the day this behavior lives in.",
    example: "morning · afternoon · evening · anytime",
  },
  "behavior.anchor": {
    summary: "What the timing is relative to.",
    example:
      "wake = N min after waking · bed = N min before bedtime · fixed = absolute clock time",
  },
  "behavior.offsetMin": {
    summary:
      "Minutes from the anchor. Negative = before. Typical range −240..240.",
    example: "−30 with anchor 'bed' = 30 min before bedtime",
  },
  "behavior.dose": {
    summary:
      "Amount with units when applicable; leave blank if there's no dose.",
    example: "300 mg",
  },
  "behavior.leverage": {
    summary:
      "How much this behavior moves the needle. 3 = keystone (highest impact), 1 = minor.",
    example: "Morning sunlight = 3 (keystone). A specific supplement = 2.",
  },
  "behavior.kind": {
    summary: "What kind of instruction this is.",
    example:
      "action = do this · avoid = don't do this · reminder = just a prompt",
  },
  "behavior.icon": {
    summary: "Small glyph that renders next to the title on the timeline.",
    example:
      "moon (sleep) · sun (morning) · pill (supplement) · sparkle (default)",
  },
  "behavior.rationale": {
    summary:
      "One calm sentence explaining why this helps. Shown to users on the behavior card.",
    example:
      "A low dose supports sleep onset without next-day grogginess.",
  },
  "behavior.status": {
    summary: "Lifecycle stage of this behavior row.",
    example:
      "draft = work in progress · published = ready · archived = excluded from publish",
  },

  // ── Protocol fields ───────────────────────────────────────────────
  "protocol.name": {
    summary: "Display name in the Library.",
    example: "Better Sleep",
  },
  "protocol.tagline": {
    summary: "One short line shown under the name. Calm, outcome-oriented.",
    example: "Protect deep recovery and circadian stability.",
  },
  "protocol.goal": {
    summary: "Slug describing the primary goal — used by adaptive logic.",
    example: "sleep · focus · recovery · metabolic",
  },
  "protocol.accent": {
    summary: "CSS variable for the card's accent color.",
    example: "var(--sleep) · var(--readiness) · var(--vitality)",
  },
  "protocol.icon": {
    summary: "Card glyph.",
    example: "moon (sleep) · sun (energy) · sparkle (custom)",
  },
  "protocol.status": {
    summary: "Lifecycle stage.",
    example:
      "draft = work in progress · published = ready · archived = excluded from publish",
  },

  // ── Evidence + explanation ────────────────────────────────────────
  "evidence.tier": {
    summary:
      "Strength of evidence. AI drafts cap at 'emerging' until a human verifies.",
    example: "strong > moderate > emerging > anecdotal",
  },
  "evidence.source": {
    summary: "Human-readable source label.",
    example: "Meta-analysis, 2021 · Neuroscience lab review",
  },
  "evidence.url": {
    summary: "Optional link to the source. Must be http(s).",
    example: "https://pubmed.ncbi.nlm.nih.gov/12345",
  },
  "evidence.summary": {
    summary: "One line on what the evidence actually shows.",
    example: "Reduces sleep onset latency by ~7 min vs placebo in adults.",
  },
  "explanation.why": {
    summary: "Why this behavior matters for the goal. 1–2 sentences.",
    example:
      "Magnesium supports GABA pathways involved in sleep onset and parasympathetic tone.",
  },
  "explanation.timing": {
    summary: "Why this time/anchor is the right slot.",
    example:
      "Peaks ~60 min after ingestion — aligns with the natural sleep-onset window.",
  },

  // ── Adaptation rules ──────────────────────────────────────────────
  "rule.name": {
    summary:
      "Display name — also shown in the audit log when this rule fires.",
    example: "soft-recovery · primed-bump",
  },
  "rule.priority": {
    summary:
      "Lower number wins. The hardcoded baseline behaves as priority 1000, so anything < 1000 can override it.",
    example: "30 fires before priority 50. Use 10–100 for normal use.",
  },
  "rule.trigger": {
    summary:
      "JSON describing when the rule fires. `all` = every condition must match. `any` = at least one. Empty trigger always matches.",
    example:
      '{"all":[{"metric":"recoveryProxy","op":"<","value":45},{"metric":"trackedDays","op":">=","value":3}]}',
  },
  "rule.effect": {
    summary:
      "JSON describing what the rule does. Can set mode, headline, tone, or append a reason.",
    example:
      '{"setMode":"recovery","headline":"Protect tonight","reason":"Recovery is low"}',
  },

  // ── Config overrides ──────────────────────────────────────────────
  "config.key": {
    summary:
      "Pick a known key for the override to take effect. Unknown keys are stored but the runtime won't read them.",
    example: "AHA_DAYS · FREE_PACKS · FREE_BIOMARKERS · FREE_INSIGHT_DAYS",
  },
  "config.value": {
    summary:
      "JSON value. Numbers, strings, booleans, or JSON objects — anything JSON.parse can handle.",
    example: '14   "evening"   true',
  },
  "config.description": {
    summary: "Free-text label for your own reference.",
    example: "Loosen trial extension for friends-and-family beta",
  },

  // ── Insight templates ─────────────────────────────────────────────
  "insightTpl.kind": {
    summary:
      "The template name the runtime looks up. Use a known kind for it to actually fire — see the datalist.",
    example:
      "keystone-slipping · weekly-headline-strong · install-better-sleep-title",
  },
  "insightTpl.template": {
    summary:
      "Template copy. Use {variable} placeholders where the runtime substitutes user data.",
    example:
      'On the days you do "{title}" you keep {delta} {pointWord} more.',
  },

  // ── Recommendation templates ──────────────────────────────────────
  "recTpl.context": {
    summary: "When this recommendation should fire — used by the engine.",
    example: "low-recovery-morning · evening-screens",
  },
  "recTpl.copy": {
    summary: "Template copy with optional {variable} placeholders.",
    example: "Try shifting screens off 30 min earlier tonight.",
  },

  // ── AI suggestion (Review form) ───────────────────────────────────
  "sug.entityType": {
    summary: "What you're proposing to change.",
    example:
      "protocol = name/tagline/etc. · behavior = title/rationale/dose/etc.",
  },
  "sug.field": {
    summary: "Which field on the target entity to update.",
    example:
      "tagline / name / accent (protocol) · title / rationale / dose (behavior)",
  },
  "sug.value": {
    summary: "The new value being proposed.",
    example: 'Better Sleep — protect recovery (a calmer tagline)',
  },
  "sug.rationale": {
    summary: "Why this change. Shown in the review queue.",
    example: "Original was too clinical; new one matches the calm voice.",
  },

  // ── Admin allowlist ───────────────────────────────────────────────
  "admin.userId": {
    summary:
      "Supabase user uuid. Find under Supabase → Authentication → Users → click the user → copy the `id` field.",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  },

  // ── Simulate ──────────────────────────────────────────────────────
  "simulate.source": {
    summary:
      "Which catalog to simulate against. Drafts is the most useful — preview unpublished edits before clicking Publish.",
    example:
      "Built-in = source binary · Drafts = current CMS · Live = published",
  },
  "simulate.sleep": {
    summary: "Last night's sleep quality (1-5).",
    example:
      "2 triggers 'lighter' mode in the baseline. 4-5 is unremarkable.",
  },
  "simulate.energy": {
    summary: "Energy level today (1-5).",
    example: "3 is average. Combined with sleep ≤ 2, drives 'lighter'.",
  },
  "simulate.gapDays": {
    summary: "Days since the last engaged day. 0 = active today.",
    example: "≥ 2 triggers 'rebuild' mode to ease the user back in.",
  },

  // ── Publish ───────────────────────────────────────────────────────
  "publish.note": {
    summary:
      "Short reason for this publish. Stored immutably in cms_publications.note and shown in the History list.",
    example: "add cold tolerance protocol · loosen trial extension to 5 days",
  },
};
