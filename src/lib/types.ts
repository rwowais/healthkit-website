export type Category = "sleep" | "exercise" | "diet" | "supplements";
export type Difficulty = "easy" | "moderate" | "advanced";
export type PlanTier = "free" | "premium";

export interface Protocol {
  id: string;
  name: string;
  description: string;
  recommendedBy: string[];
  difficulty: Difficulty;
  category: Category;
  subcategory: string;
  frequency?: string;
  tier: PlanTier;
}

export interface Program {
  id: string;
  name: string;
  tagline: string;
  description: string;
  duration: string;
  weeks: number;
  difficulty: Difficulty;
  categories: Category[];
  tier: PlanTier;
  phases: ProgramPhase[];
}

export interface ProgramPhase {
  name: string;
  description: string;
  weekStart: number;
  weekEnd: number;
  dailyPlan: DailyPlan[];
}

export interface DailyPlan {
  day: string;
  focus: string;
  workouts?: WorkoutTemplate[];
  nutrition?: NutritionGuideline;
  protocols?: string[];
}

export interface WorkoutTemplate {
  name: string;
  type: "strength" | "cardio" | "hiit" | "recovery" | "flexibility";
  exercises: ExerciseTemplate[];
  duration: string;
  notes?: string;
}

export interface ExerciseTemplate {
  name: string;
  sets: number;
  reps: string;
  intensity?: string;
  rest?: string;
  notes?: string;
}

export interface NutritionGuideline {
  calories?: string;
  protein?: string;
  carbs?: string;
  fats?: string;
  fiber?: string;
  timing?: string;
  notes?: string;
}

export interface MealIdea {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner" | "snack" | "dessert";
  ingredients: string[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  tags: string[];
  tier: PlanTier;
}

// Workout Logger
export interface WorkoutLog {
  id: string;
  date: string;
  programId?: string;
  exercises: ExerciseLog[];
  duration: number;
  notes: string;
}

export interface ExerciseLog {
  name: string;
  sets: SetLog[];
}

export interface SetLog {
  weight: number;
  reps: number;
  type: "warmup" | "working" | "cooldown";
  rpe?: number;
}

// User & Tracking
export interface SelectedProtocol {
  protocolId: string;
  addedAt: string;
  weeklySchedule: boolean[];
  notes: string;
}

export interface DailyLog {
  date: string;
  completedProtocols: string[];
  mood: number;
  energy: number;
  sleepHours: number;
  notes: string;
}

export interface UserProfile {
  name: string;
  goal: string;
  experience: string;
  quizAnswers: Record<string, string>;
  recommendedProgram?: string;
  isPremium: boolean;
}

export interface UserRoutine {
  profile: UserProfile;
  selectedProtocols: SelectedProtocol[];
  activeProgram?: { programId: string; currentWeek: number; startDate: string };
  dailyLogs: DailyLog[];
  workoutLogs: WorkoutLog[];
  startDate: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: { value: string; label: string; description?: string }[];
}
