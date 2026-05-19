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

  // Monetization (gating + Stripe wired in a later phase)
  tier?: "free" | "premium";
  /** ISO; reverse-trial: full Premium intelligence until this date. */
  premiumTrialEndsAt?: string;
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
}

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
}
