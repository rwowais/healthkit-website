export type Pillar = "sleep" | "exercise" | "nutrition" | "supplements";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type TimingAnchor = "wake" | "bed" | "fixed";
export type ItemSource = "default" | "custom";

/**
 * Whether a protocol item is an active task to check off,
 * or a passive reminder/guideline to keep in mind.
 */
export type ItemType = "task" | "reminder";

export interface ProtocolItem {
  id: string;
  pillar: Pillar;
  name: string;
  description: string;
  source: ItemSource;
  itemType: ItemType;
  timingAnchor: TimingAnchor;
  timingOffsetMinutes: number;
  fixedTime?: string;
  timeOfDay: TimeOfDay;
  daysActive: boolean[]; // [Mon..Sun] 7 elements
  sortOrder: number;
  isEnabled: boolean;
  icon: string; // emoji
  recommendedBy?: string[];
  evidenceNote?: string;
  createdAt: string;
}

// ── Supplement-specific fields ────────────────────────────────────

export interface SupplementMeta {
  /** Why the user is taking this supplement */
  reasonForTaking: string;
  /** Dosage info (e.g. "200mg") */
  dosage: string;
  /** Brand if tracked */
  brand: string;
  /** Whether the user has stopped taking this */
  stopped: boolean;
  /** Reason for stopping */
  stoppedReason: string;
  stoppedDate: string | null;
}

// ── Exercise mini-log ─────────────────────────────────────────────

export interface ExerciseEntry {
  itemId: string;
  completed: boolean;
  durationMinutes: number | null;
  intensity: 1 | 2 | 3 | null; // 1=light, 2=moderate, 3=hard
  feeling: 1 | 2 | 3 | 4 | 5 | null; // 1=terrible ... 5=great
  note: string;
}

// ── Nutrition scorecard ───────────────────────────────────────────

export type ScorecardAnswer = "yes" | "mostly" | "no" | null;

export interface NutritionScorecard {
  hitProteinTarget: ScorecardAnswer;
  ateFruitsVeggies: ScorecardAnswer;
  stayedHydrated: ScorecardAnswer;
  avoidedProcessedSugar: ScorecardAnswer;
  finishedEatingOnTime: ScorecardAnswer;
  minimizedAlcohol: ScorecardAnswer;
  /** Any custom scorecard items the user adds */
  customItems: { label: string; answer: ScorecardAnswer }[];
  note: string;
}

// ── Supplement daily tracking ─────────────────────────────────────

export interface SupplementEntry {
  itemId: string;
  taken: boolean;
  skipped: boolean;
  skipReason: string;
}

// ── Sleep item completion ─────────────────────────────────────────

export interface SleepItemCompletion {
  itemId: string;
  completed: boolean;
}

// ── Settings ──────────────────────────────────────────────────────

export interface UserSettings {
  name: string;
  bedtime: string; // HH:MM 24h
  wakeTime: string; // HH:MM 24h
  timezone: string;
  subscriptionStatus: "trial" | "active" | "expired" | "cancelled";
  trialStartDate: string;
  notificationsEnabled: boolean;
  weekStartsOn: 0 | 1;
  completedOnboarding: boolean;
  primaryGoal?: string;
  disclaimerAcknowledged?: boolean;

  // Onboarding 2.0 — drives personalization & adaptation
  recoveryPriority?: "low" | "medium" | "high";
  sleepBaseline?: "rough" | "ok" | "solid";
  overwhelm?: "calm" | "some" | "stretched";
  focusAreas?: string[];
  experience?: "new" | "some" | "deep";
  hasWearable?: boolean;

  /**
   * Calm safety gating — these flags suppress contraindicated atoms
   * from the merged timeline + auto-suggestions. Collected
   * non-clinically during onboarding (one optional step, skippable).
   * Empty/undefined = no gating applied (the default for everyone
   * who skips). Tone is "let us tailor this for you", not "medical
   * intake." Stored client-side AND synced; never auto-derived.
   *
   * Type forward-references SafetyFlag (defined further down in this
   * module — same-file interface forward refs are fine in TS).
   */
  safetyFlags?: Partial<Record<SafetyFlag, boolean>>;

  // Monetization (gating + Stripe wired in a later phase)
  tier?: "free" | "premium";
  /** ISO; reverse-trial: full Premium intelligence until this date. */
  premiumTrialEndsAt?: string;
  /**
   * ISO; stamped when the engagement-gated reverse-trial auto-extends.
   * Surface a one-time calm note on Today so the kindness is felt instead
   * of being silent (cleared once acknowledged).
   */
  trialExtendedAt?: string;

  /**
   * Whether to hide the Supplements tab from the bottom nav. Default
   * undefined = visible. Users who don't take supplements (or who
   * track them elsewhere) can hide the tab from Profile. The
   * `/supplements` route remains reachable via the Manage link
   * inside the SupplementBlockCard on Today, so toggling this off
   * never strands the user.
   */
  hideSupplementsTab?: boolean;

  /**
   * Vacation mode — a single toggle that pauses every pack at once,
   * empties the timeline, and freezes the streak math. For trips,
   * sick days, or any "I need a break" stretch where the user doesn't
   * want to be punished by an empty score or watch their streak die.
   * On = empty Today + Protocols stay paused; off = everything resumes
   * with the streak picking up where it left off (no zero-days
   * inserted while paused).
   */
  vacationMode?: boolean;
  /** ISO; stamped when the user toggled vacation mode on. */
  vacationStartedAt?: string;
  /**
   * Historical vacation periods. Each entry is a date range
   * (start..end inclusive, YYYY-MM-DD). When a vacation is active
   * the most-recent period has `end: null`. When it ends, the toggle
   * writes today's date as the end. Used by calculateStreak to walk
   * through vacation days transparently so a user's streak survives
   * a real break — the "your streak holds" promise in Profile copy
   * was previously a lie because no caller passed the vacation set.
   */
  vacationPeriods?: Array<{ start: string; end: string | null }>;

  /**
   * ISO; stamped when the user accepted Terms + Privacy. Required for
   * EU/UK/CA legal compliance. We don't gate the app on this — we
   * collect it on first run after the legal pages ship, and surface
   * a calm one-time banner asking returning users to acknowledge.
   */
  legalAcceptedAt?: string;
  /**
   * Version of the legal docs the user accepted. Bump LEGAL_VERSION in
   * lib/constants.ts when Terms or Privacy materially change to
   * re-prompt without forcing re-acceptance on minor edits.
   */
  legalAcceptedVersion?: number;
}

// ── Supplements (separated from behaviors) ────────────────────────
//
// Supplements are a distinct concept from behaviors:
//   - Behaviors are practices to build (training, meditation, wind-down).
//   - Supplements are items to take (pills, capsules, powders).
//
// Treating them the same conflated UX patterns that have different
// best forms. Behaviors deserve their own row, dose, time-anchored
// reminder, and progress streak. Supplements deserve a bundle ("take
// the morning stack"), inventory tracking, and a weekly grid view.
//
// The shape captures everything we need for both curated catalog
// items and user-created customs.

export interface SupplementInventory {
  /** Remaining doses (counts down on each completion). */
  count: number;
  /** Suggest refill when count falls below this threshold. */
  refillAt?: number;
  /** Last edited timestamp (ISO) for stale-value detection. */
  updatedAt?: string;
}

export interface Supplement {
  /**
   * Stable id. For curated supplements, the canonical key from the
   * legacy behavior atom (so existing completions migrate cleanly).
   * For user-created supplements, a generated id like `supp:<rand>`.
   */
  id: string;
  /** User-facing name (e.g. "Magnesium glycinate"). */
  name: string;
  /** Dose label (e.g. "200–400 mg" or "1 capsule"). */
  dose?: string;
  /** Block the supplement belongs to. */
  block: TimeBlock;
  /**
   * Optional friendly timing hint shown beneath the dose (e.g.
   * "with breakfast" or "before bed"). NOT used for clock-time
   * sorting — supplements are bundle-and-do.
   */
  timing?: string;
  /** Optional brand or product name. */
  brand?: string;
  /** Optional user notes (e.g. "out of stock at Costco"). */
  notes?: string;
  /**
   * Days of week active. Mon=0..Sun=6, undefined = every day.
   * Used by cycle-on/cycle-off supplements like creatine.
   */
  daysActive?: boolean[];
  /** Optional inventory + refill tracking. */
  inventory?: SupplementInventory;
  /**
   * Pointer to the curated atom this was derived from (atom-library
   * pick or migration). Lets the system surface curated metadata
   * (rationale, contraindications, evidence tier) on a user's custom
   * row without freezing them into the curated values.
   */
  derivedFrom?: string;
  /** Safety flags this supplement is contraindicated for. */
  contraindications?: SafetyFlag[];
  /** Long-form evidence/explanation text. */
  evidence?: string;
  evidenceTier?: "established" | "emerging" | "exploratory";
  /** Short rationale ("why take it") shown in the detail sheet. */
  rationale?: string;
  /** Provenance. */
  source: "curated" | "custom";
  /** Pack id this was installed from (curated only). Cleanup hint. */
  installedFromPack?: string;
}

// ── Legacy completion (kept for migration) ────────────────────────

export interface ItemCompletion {
  itemId: string;
  completedAt: string | null;
  note: string;
  skipped: boolean;
}

// ── Sleep log ─────────────────────────────────────────────────────

export interface SleepLog {
  actualBedtime: string | null;
  actualWakeTime: string | null;
  sleepQuality: number | null; // 1-5
  sleepDurationMinutes: number | null;
}

// ── Daily Log (v3 — pillar-specific tracking) ─────────────────────

export interface DailyLog {
  date: string; // YYYY-MM-DD

  // Per-pillar tracking
  sleepCompletions: SleepItemCompletion[];
  exerciseEntries: ExerciseEntry[];
  nutritionScorecard: NutritionScorecard;
  supplementEntries: SupplementEntry[];

  // Legacy (kept for backward compat)
  completions: ItemCompletion[];

  // Wellness
  sleepLog: SleepLog;
  energyLevel: number | null; // 1-5
  moodLevel: number | null; // 1-5
  dayNote: string;

  // Scoring
  score: number; // 0-100
  pillarScores: Record<Pillar, number>; // per-pillar 0-100

  // Supplement tracking (id -> done). Kept in its own field, not
  // co-mingled with behaviorCompletions, since supplements are a
  // distinct concept (see Supplement type). Empty by default so
  // older logs without it parse cleanly.
  supplementCompletions?: Record<string, boolean>;

  // Protocol-OS behavior tracking (canonicalKey -> done)
  behaviorCompletions?: Record<string, boolean>;
}

// ── Insights ──────────────────────────────────────────────────────

export interface Insight {
  id: string;
  type: "streak" | "correlation" | "nudge" | "trend" | "achievement";
  title: string;
  body: string;
  pillar?: Pillar;
  createdAt: string;
  dismissed: boolean;
}

// ── Supplement metadata store ─────────────────────────────────────

export type SupplementMetaMap = Record<string, SupplementMeta>;

// ── Protocol OS: packs & behaviors ────────────────────────────────

export type TimeBlock = "morning" | "afternoon" | "evening" | "anytime";
export type BehaviorKind = "action" | "avoid" | "reminder";

/** An atomic behavior. canonicalKey is the dedupe/merge identity. */
export interface BehaviorDef {
  canonicalKey: string;
  title: string;
  block: TimeBlock;
  anchor: TimingAnchor;
  offsetMin: number;
  dose?: string;
  rationale: string;
  evidence?: string;
  recommendedBy?: string[];
  icon: string; // IconName from icon system
  leverage: 1 | 2 | 3; // 3 = highest leverage
  kind: BehaviorKind;
  daysActive?: boolean[]; // optional per-behavior schedule
  /** Why this slot was recommended — calm, specific, one line. */
  timingReason?: string;
  /**
   * Identity link to a curated atom. When the user creates a custom
   * behavior by picking from the atom library, the new behavior gets
   * a fresh user-namespaced `canonicalKey` (so dose / time / days can
   * differ without contaminating the canonical row) AND a `derivedFrom`
   * pointer back to the original. The engine uses `derivedFrom` for
   * intelligence purposes — conflict pairs, recovery demotion, mastery
   * graduation transfer, "is this strength training?" classification —
   * so user-derived behaviors participate in the intelligence layer
   * exactly like the curated atom they're based on. Pure-free-text
   * customs (escape hatch) have no derivedFrom and skip those layers.
   */
  derivedFrom?: string;
  /**
   * For `kind: "avoid"` behaviors that reference a specific target
   * (e.g., "no cold within 6h post-lift" references the strength
   * behavior), this lists the canonicalKeys of the related behaviors.
   * Used by the Today timeline to surface a visible link between the
   * avoid-card and its target — the user sees "this rule is about
   * THAT row" without an engine deciding for them.
   */
  targets?: string[];
  /**
   * Evidence tier. Set explicitly on atoms making non-trivial scientific
   * claims so the surface can frame them with appropriate humility:
   *   "established"  — well-replicated, mainstream consensus (sleep
   *                    duration, protein for muscle, hydration)
   *   "emerging"     — meaningful evidence, still being characterized
   *                    in humans (cold exposure, sauna, time-restricted
   *                    eating, NSDR)
   *   "exploratory"  — mechanistic / observational / animal-heavy basis
   *                    with thin or null human RCT data (NMN, resveratrol,
   *                    spermidine, red light, grounding)
   * Absent = "no claim being made" (e.g., simple lifestyle atoms like
   * "go for a walk"). Surfaces as a small badge in BehaviorSheet and
   * tightens the copy in rationale / evidence fields.
   */
  evidenceTier?: "established" | "emerging" | "exploratory";
  /**
   * Safety flags this atom is contraindicated for. The engine SUPPRESSES
   * the atom (drops it from the merged timeline AND keeps it out of
   * auto-suggestions) when the user's settings carry any matching flag.
   * Calm + quiet: the user never sees a clinical warning; the atom
   * simply doesn't appear. Library picker still shows the atom with
   * an "Not recommended for {flag}" hint so a curious user can still
   * inspect it but has to consciously override.
   *
   * Values map to keys in UserSettings.safetyFlags. Adding a new flag
   * here is the only change needed to wire it through.
   */
  contraindications?: SafetyFlag[];
}

/**
 * Trust tier — the *governance class* of a behavior. The system uses
 * this internally to decide what role a behavior plays in the
 * intelligence layer. Users never see these labels directly; the
 * consequences (system recommendations, keystone eligibility, evidence
 * surfacing) are felt as natural product behavior.
 *
 *   "curated"  — Shipped in the official PACKS or STANDALONE_ATOMS
 *                library. Reviewed by us. Carries evidenceTier,
 *                contraindications, rationale, timingReason. Full
 *                participation in recommendations, keystone analysis,
 *                CONFLICT_PAIRS, adaptive shaping, mastery, etc.
 *
 *   "derived"  — User picked a curated atom from the library and
 *                customized it (different dose / time / days). Has a
 *                `derivedFrom` pointer to the canonical atom. Inherits
 *                the curated atom's governance metadata (contraindications,
 *                evidenceTier, conflict pairs via effectiveKey). Counted
 *                as the curated behavior for cross-pack merge + analysis.
 *
 *   "custom"   — User free-typed a behavior the catalog doesn't
 *                cover. No `derivedFrom`, no curated lineage. The
 *                engine MUST NOT treat this as authoritative — it
 *                does not auto-recommend, doesn't become a keystone,
 *                doesn't propagate as scientific knowledge. The user's
 *                own outcome data still flows (it's their behavior),
 *                but the system never *claims* it works.
 *
 * Classification is derived (not stored) from canonicalKey + derivedFrom
 * presence so it can't drift out of sync with the data.
 */
export type TrustTier = "curated" | "derived" | "custom";

/**
 * Safety flag identifiers. Kept narrow on purpose — this is calm
 * gating, not clinical intake. New flags require an explicit data-
 * model + onboarding decision.
 */
export type SafetyFlag =
  | "pregnant"
  | "breastfeeding"
  | "under-18"
  | "anticoagulants" // warfarin / DOACs / antiplatelets
  | "diabetes-meds" // metformin / sulfonylureas / insulin
  | "thyroid-meds" // levothyroxine
  | "ssri" // SSRIs / SNRIs
  | "eating-disorder-history"
  | "cardiac-arrhythmia";

export interface ProtocolPack {
  id: string;
  name: string;
  tagline: string;
  goal: string;
  accent: string; // css var token
  icon: string;
  behaviors: BehaviorDef[];
  source: "official" | "custom";
  durationLabel?: string; // e.g. "Ongoing", "4 weeks"
}

/** Per-behavior user override, keyed by canonicalKey. */
export interface BehaviorOverride {
  disabled?: boolean;
  daysActive?: boolean[];
  /** User-chosen time block (overrides the recommended block). */
  block?: TimeBlock;
  /** User-chosen exact clock time "HH:MM" (overrides anchor math). */
  customTime?: string;
  /** User-edited dose / target text. */
  dose?: string;
  /** Personal note ("my why"). */
  note?: string;
}

// ── Biomarkers ────────────────────────────────────────────────────

/** A single dated reading for one biomarker metric. */
export interface BiomarkerEntry {
  id: string;
  metric: string; // BiomarkerDef.key
  value: number;
  date: string; // YYYY-MM-DD
  note?: string;
}

// ── App State ─────────────────────────────────────────────────────

export interface AppState {
  version: 3;
  settings: UserSettings;
  protocols: Record<Pillar, ProtocolItem[]>;
  supplementMeta: SupplementMetaMap;
  dailyLogs: DailyLog[];
  biomarkers: BiomarkerEntry[];
  insights: Insight[];
  currentStreak: number;

  // Protocol OS
  installedPacks: string[];
  /** Installed but temporarily paused (reversible, non-destructive). */
  pausedPacks: string[];
  customPacks: ProtocolPack[];
  behaviorOverrides: Record<string, BehaviorOverride>;

  // Supplements (separated from behaviors — see Supplement type).
  // Default empty; populated either by the v3.5 migration (existing
  // supplement behaviors get extracted into Supplement entries) or
  // by user adds via the Supplements surface.
  supplements?: Supplement[];
  /**
   * One-time supplement-extraction marker. Set to the LEGAL_VERSION
   * equivalent for supplements (a single integer that we bump if we
   * need to re-run extraction for some reason). Prevents the
   * migration from running twice and double-creating supplement
   * entries when a user re-loads.
   */
  supplementsMigratedAt?: number;
}
