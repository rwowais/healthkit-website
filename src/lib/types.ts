export type Category = "sleep" | "exercise" | "diet" | "supplements";

export type Difficulty = "easy" | "moderate" | "advanced";

export interface Protocol {
  id: string;
  name: string;
  description: string;
  recommendedBy: string[];
  difficulty: Difficulty;
  category: Category;
  subcategory: string;
  frequency?: string;
}

export interface SelectedProtocol {
  protocolId: string;
  addedAt: string;
  weeklySchedule: boolean[]; // 7 booleans for Mon-Sun
  notes: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  completedProtocols: string[]; // protocol IDs
  mood: number; // 1-5
  energy: number; // 1-5
  sleepHours: number;
  notes: string;
}

export interface UserRoutine {
  selectedProtocols: SelectedProtocol[];
  dailyLogs: DailyLog[];
  startDate: string;
  planWeeks: number;
}
