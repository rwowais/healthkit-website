export type Pillar = "sleep" | "exercise" | "nutrition" | "supplements";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type TimingAnchor = "wake" | "bed" | "fixed";
export type ItemSource = "default" | "custom";

export interface ProtocolItem {
  id: string;
  pillar: Pillar;
  name: string;
  description: string;
  source: ItemSource;
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
}

export interface ItemCompletion {
  itemId: string;
  completedAt: string | null;
  note: string;
  skipped: boolean;
}

export interface SleepLog {
  actualBedtime: string | null;
  actualWakeTime: string | null;
  sleepQuality: number | null; // 1-5
  sleepDurationMinutes: number | null;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  completions: ItemCompletion[];
  sleepLog: SleepLog;
  energyLevel: number | null; // 1-5
  moodLevel: number | null; // 1-5
  dayNote: string;
  score: number; // 0-100
}

export interface Insight {
  id: string;
  type: "streak" | "correlation" | "nudge" | "trend" | "achievement";
  title: string;
  body: string;
  pillar?: Pillar;
  createdAt: string;
  dismissed: boolean;
}

export interface AppState {
  version: 2;
  settings: UserSettings;
  protocols: Record<Pillar, ProtocolItem[]>;
  dailyLogs: DailyLog[];
  insights: Insight[];
  currentStreak: number;
}
