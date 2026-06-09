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
  /** Optional do-not-disturb window for reminders, "HH:MM" 24h. A reminder
   *  whose time falls inside [start, end) — wrapping past midnight, e.g.
   *  22:00→07:00 — is never scheduled. */
  quietHours?: { start: string; end: string };
  /** Optional custom day-block start times ("HH:MM"). Defaults 05:00 /
   *  12:00 / 17:00. Only honored when strictly ascending (else defaults).
   *  Lets a shift worker / night owl define when their morning, afternoon,
   *  and evening begin so behaviors file under the right section. */
  blockBoundaries?: { morning: string; afternoon: string; evening: string };
  /** Optional custom display names for the day blocks (e.g. "Dawn",
   *  "Midday", "Wind-down"). Display-only — the engine's block model is
   *  unchanged; this just renames the section headers. Combined with
   *  blockBoundaries (when each begins), it lets a user reshape the day's
   *  sections to fit their life. Absent keys fall back to the defaults. */
  blockLabels?: { morning?: string; afternoon?: string; evening?: string; anytime?: string };
  weekStartsOn: 0 | 1;
  /** Target active days per week (1–7). Undefined/0 = no goal. Powers the
   *  Today weekly progress ring. */
  weeklyGoal?: number;
  /** Planned single rest days (YYYY-MM-DD). Each is transparent to streak
   *  math (like a vacation day) but explicit — a deliberate day off that
   *  earns streak protection without pausing the whole system. */
  restDays?: string[];
  /** Days (YYYY-MM-DD) the user spent a streak-freeze token to protect.
   *  Transparent to streak math (unioned into getVacationDates) — a frozen
   *  day bridges a gap without breaking or extending the streak. The bank is
   *  a rolling monthly allowance (see freezeStatus in scoring). */
  usedFreezeDates?: string[];
  /** When true, per-behavior reminders fire at the user's *learned* typical
   *  completion time (median of recent recorded completions, clamped to the
   *  behavior's block) once there's enough signal, instead of the scheduled
   *  clock time. Falls back to the scheduled time until ≥MIN samples exist. */
  smartReminders?: boolean;
  /** Outcome goals the user is tracking (biomarker target / streak / weekly
   *  active days). Progress is derived, never stored — see goals.ts. */
  outcomeGoals?: OutcomeGoal[];
  /** Self-experiments: a structured before/during test of one change against
   *  a chosen check-in metric. Readout is derived — see goals.ts. */
  experiments?: Experiment[];
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
   * On = Today is cleared (the engine early-returns an empty timeline) and the
   * streak is frozen; off = the full system returns with the streak picking up
   * where it left off (no zero-days inserted while paused). NOTE: this does NOT
   * touch pausedPacks — packs aren't individually paused, the day is just
   * cleared, so copy must not claim "packs stay paused".
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
   * Milestone moments already shown + dismissed (e.g. "streak-30",
   * "completions-100"). A milestone only surfaces on the day it's freshly
   * crossed; this list just stops it from re-appearing on reload that day.
   * Device-synced so the celebration doesn't repeat across devices.
   */
  celebratedMilestones?: string[];

  /**
   * Opt out of the home-screen app icon badge. When true, the badge
   * is cleared on every load and we never set it again — useful for
   * users who interpret the number as a notification count and find
   * it stressful, or whose OS doesn't show it cleanly. Default
   * (undefined) = badge on for installed PWAs.
   */
  disableAppBadge?: boolean;

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

  // Supplements explicitly skipped for this day (ids). "Skip today" on
  // a block's stack lets a day you're not taking supplements still
  // reach "Complete" without lying about having taken them. A
  // supplement counts as "handled" for completion if it's either taken
  // (supplementCompletions) or skipped here. Per-day — skipping today
  // never affects another day.
  supplementSkips?: string[];

  // Protocol-OS behavior tracking (canonicalKey -> done)
  behaviorCompletions?: Record<string, boolean>;

  /**
   * Clock time (minutes since local midnight) a behavior was first checked
   * off, keyed by canonicalKey. Recorded opportunistically when a behavior is
   * toggled complete; powers Smart reminder timing (learn the user's real
   * rhythm). Absent for older logs and for completions toggled before this
   * shipped — Smart timing simply has less to learn from until it fills in.
   */
  behaviorCompletionMinutes?: Record<string, number>;

  /**
   * Per-day workout swap: when the user planned to do behavior X but
   * actually did behavior Y (e.g., scheduled for strength, did yoga
   * because of joint soreness), we record the swap here rather than
   * lying about completion. Maps fromKey → toKey, scoped to this log.
   *
   * Engine reads this when compiling today's timeline:
   * - the original key is muted with a "swapped for Y" note
   * - the replacement is added to the timeline even if its daysActive
   *   doesn't include today
   * - completing the replacement also counts toward score
   *
   * Doesn't affect mastery (the user didn't actually do the original
   * behavior, and the replacement is a one-off — neither should
   * accumulate streak credit for the other).
   */
  swaps?: Record<string, string>;

  /**
   * Sidecar to `swaps`: for each fromKey, did the swap operation
   * also auto-complete the replacement (true) or was the
   * replacement already legitimately done before the swap (false)?
   *
   * Used by clearSwap to undo surgically: when the user reverses
   * a swap, we only delete the replacement's completion bit if WE
   * set it. A walk completed independently at 7am stays completed
   * after the user undoes a 5pm "strength → walk" swap.
   */
  swapAutoCompleted?: Record<string, boolean>;

  /**
   * One-off behaviors added for this day only (e.g. "sauna" after an
   * impromptu gym trip) without changing the installed protocol. Injected
   * into Today's timeline and completable like any behavior; they don't
   * accumulate streaks or affect the protocol.
   */
  oneOffs?: Array<{
    key: string;
    title: string;
    block: TimeBlock;
    icon?: string;
    dose?: string;
  }>;

  /**
   * Per-day snoozes (canonicalKey → mode): "later" pushes a behavior to the
   * evening block today; "tomorrow" hides it from today entirely (it returns
   * on its normal schedule). Scoped to this log.
   */
  snoozes?: Record<string, "later" | "tomorrow">;

  /**
   * ISO timestamp of the last time THIS day's log content was changed by a
   * user action (set at every mutation; travels with the log through cloud
   * sync). Lets cross-device merge resolve genuine conflicts by recency —
   * e.g. a behavior un-checked on a newer device stays un-checked instead of
   * being resurrected by a stale union. Optional + backward-compatible: older
   * logs (and logs written before this shipped) have it undefined, and the
   * merge falls back to the prior union/max semantics whenever either side
   * lacks a stamp — so existing data behaves exactly as before.
   */
  updatedAt?: string;
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

/**
 * Behavior category — semantic group, orthogonal to `kind`.
 * `kind` says what the user does mechanically (act / avoid / be
 * reminded). `category` says what kind of *thing* it is, so the
 * engine can do category-aware UX without hard-coding canonical keys.
 *
 * "workout" enables the per-day workout-swap flow on Today: a user
 * scheduled for strength can swap to yoga for the day without lying
 * about completion. Add new categories sparingly — most behaviors
 * shouldn't need one.
 */
export type BehaviorCategory = "workout";

/**
 * Physiological intensity of a behavior — used by the engine to
 * detect "today is an easier day" when a user swaps a high-intensity
 * workout for a low-intensity one. Optional and only meaningful for
 * `category: "workout"` behaviors today, but the field is generic so
 * future categories (e.g. cold exposure) can carry it too.
 *
 * Calibration:
 *   - "high": strength, hiit, vo2max-intervals, tabata
 *   - "moderate": zone2
 *   - "low": walk, mobility, yoga, nsdr
 */
export type BehaviorIntensity = "high" | "moderate" | "low";

/** An atomic behavior. canonicalKey is the dedupe/merge identity. */
export interface BehaviorDef {
  canonicalKey: string;
  title: string;
  block: TimeBlock;
  anchor: TimingAnchor;
  offsetMin: number;
  /**
   * User-chosen exact clock time "HH:MM" that overrides the anchor +
   * offsetMin math (see effectiveMinutes). Custom behaviors authored
   * with a specific time carry it here; curated atoms leave it unset and
   * rely on anchor math. Mirrors BehaviorOverride.customTime so a
   * behavior's intrinsic time survives compileTimeline's merge.
   */
  customTime?: string;
  dose?: string;
  rationale: string;
  evidence?: string;
  recommendedBy?: string[];
  icon: string; // IconName from icon system
  leverage: 1 | 2 | 3; // 3 = highest leverage
  kind: BehaviorKind;
  /** Semantic category — optional, opt-in. See BehaviorCategory. */
  category?: BehaviorCategory;
  /** Physiological intensity — see BehaviorIntensity. Workout-only today. */
  intensity?: BehaviorIntensity;
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
  /**
   * Optional scheduling guardrail. The behavior's effective time must fall in
   * [anchorBase + min, anchorBase + max] minutes, where anchorBase is the
   * user's wake (or bed, if `anchor === "bed"`). Offsets are relative to the
   * SAME anchor the behavior already uses.
   *   • strict: true  → HARD. The engine clamps an out-of-window time back in
   *     and re-files the block from the clamped time (overriding any pin), and
   *     the editor won't let the user leave the window. For circadian/safety
   *     behaviors that are nonsensical out of place — e.g. morning light must
   *     stay within ~2h of waking; a pre-bed wind-down can't move to morning.
   *   • strict falsy  → SOFT. The time is allowed but the item is flagged
   *     (timingOff) so the UI can show a calm "a bit off" note.
   * Absent → unconstrained (freely placeable, the default for most behaviors).
   */
  timeWindow?: { min: number; max: number; strict?: boolean };
}

/**
 * A typed relationship between two behaviors — the data-driven
 * generalization of the hardcoded CONFLICT_PAIRS in engine.ts. Authored
 * in the CMS (cms_interactions) and threaded through the published
 * KnowledgeBundle; the built-in conflict pairs stay the always-present
 * fallback, so the engine behaves identically with no published bundle.
 *
 *   conflict — doing both undermines a goal; severity "firm" mutes bKey
 *              (today's restraint→target behavior), "soft" only notes it.
 *   timing   — one should sit a certain distance from the other / sleep.
 *   ordering — sequence within a shared block matters (lift before Zone 2).
 *   synergy  — they reinforce each other (morning cold + evening sauna).
 *
 * aKey/bKey are canonicalKeys, matched at runtime via effectiveKey so
 * atom-library-derived behaviors participate like their curated origin.
 * Every record carries an evidence tier + source; a source is only
 * trusted once a human stamps sourceVerifiedBy/At — nothing ships as a
 * claim on an unchecked citation.
 */
export type InteractionType = "conflict" | "timing" | "ordering" | "synergy";
export type InteractionSeverity = "soft" | "firm";

export interface Interaction {
  /** canonicalKey of the first behavior. */
  aKey: string;
  /** canonicalKey of the second behavior. */
  bKey: string;
  type: InteractionType;
  /** "firm" mutes bKey (conflict only); "soft" surfaces a calm note. */
  severity: InteractionSeverity;
  /** Calm, one-line user-facing explanation. */
  nudge: string;
  /** For timing / ordering rules: desired separation in hours. */
  gapHours?: number;
  /** Optional structured window/bound, e.g. { windowMin: 360 }. */
  bound?: Record<string, number>;
  /** Optional gate, e.g. { goal: "muscle" } — only applies under condition. */
  condition?: Record<string, string>;
  /** "a_to_b" (default) or "mutual". */
  direction?: "a_to_b" | "mutual";
  evidenceTier?: BehaviorDef["evidenceTier"];
  /** Source URL. MUST be human-verified before an interaction is published. */
  source?: string;
  /** Stamped when a human opens the source and confirms it supports the claim. */
  sourceVerifiedBy?: string;
  sourceVerifiedAt?: string;
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
  /** When true, this behavior never schedules a reminder, even while global
   *  notifications are on. */
  reminderOff?: boolean;
  /** Manual order within its block (lower = earlier). Absent = follow the
   *  clock. Adjusted via "move earlier / later" in the behavior editor. */
  sortIndex?: number;
  /**
   * Habit stacking: the canonicalKey (or effectiveKey) of an anchor behavior
   * this one should follow ("after X, do Y"). When the anchor is present in
   * the day's timeline, the engine files this behavior in the anchor's block,
   * immediately after it. Cue-based chaining — anchoring a new habit to an
   * established one is what makes it stick. Ignored if the anchor isn't
   * scheduled today.
   */
  stackAfter?: string;
}

// ── Outcome goals & self-experiments ──────────────────────────────

/**
 * An outcome goal the user is steering toward — a target, not a daily
 * task. Three kinds, each mapping cleanly to data the app already has so
 * progress is honest and derived (never stored):
 *   "biomarker"    — reach a target value for a tracked body metric
 *                    (e.g. "Resting HR ≤ 55"). Direction comes from the
 *                    BiomarkerDef so "progress" means the right way.
 *   "streak"       — reach a streak of N consecutive active days.
 *   "weeklyActive" — sustain N active days within a rolling 7-day window.
 */
export interface OutcomeGoal {
  id: string;
  kind: "biomarker" | "streak" | "weeklyActive";
  /** User-facing label, e.g. "Resting HR under 55". */
  label: string;
  /** Target number: bpm/kg/etc for biomarker; days for streak/weeklyActive. */
  target: number;
  /** Biomarker metric key (BiomarkerDef.key) — biomarker goals only. */
  metric?: string;
  /** The metric value when the goal was set — biomarker goals only. Anchors
   *  the progress bar so "halfway there" means halfway from start→target. */
  startValue?: number;
  /** Optional target date (YYYY-MM-DD) — informational, never enforced. */
  targetDate?: string;
  createdAt: string; // ISO
  /** Stamped the first day the goal is met (so the celebration is one-time). */
  achievedAt?: string;
}

/**
 * A self-experiment: test one change (a hypothesis) against a chosen
 * check-in metric over a fixed window, measuring the metric's average
 * during the experiment vs a baseline window just before it. Honest by
 * construction — the readout (goals.ts) refuses a verdict until both
 * windows have enough data, and never claims causation.
 */
export interface Experiment {
  id: string;
  /** What you're testing, e.g. "Magnesium before bed improves my sleep". */
  hypothesis: string;
  /** The check-in dimension measured before vs during. */
  metric: "sleepQuality" | "energy" | "mood" | "sleepDuration";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (planned)
  /** Days immediately before startDate used as the baseline window. */
  baselineDays: number;
  createdAt: string; // ISO
  /** Stamped when the user concludes the experiment early/manually. */
  concludedAt?: string;
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
