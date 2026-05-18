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
}
