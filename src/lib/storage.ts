import { STORAGE_KEY } from "./constants";
import { calculateDailyScore, calculateStreak } from "./scoring";
import type {
  AppState,
  DailyLog,
  ItemCompletion,
  Pillar,
  ProtocolItem,
  SleepLog,
  UserSettings,
} from "./types";

import { defaultSleepProtocol } from "./defaults/sleep";
import { defaultExerciseProtocol } from "./defaults/exercise";
import { defaultNutritionProtocol } from "./defaults/nutrition";
import { defaultSupplementsProtocol } from "./defaults/supplements";

function getDateString(date?: Date): string {
  const d = date ?? new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createEmptySleepLog(): SleepLog {
  return {
    actualBedtime: null,
    actualWakeTime: null,
    sleepQuality: null,
    sleepDurationMinutes: null,
  };
}

function createEmptyDailyLog(date: string, items: ProtocolItem[]): DailyLog {
  const completions: ItemCompletion[] = items
    .filter((item) => item.isEnabled)
    .map((item) => ({
      itemId: item.id,
      completedAt: null,
      note: "",
      skipped: false,
    }));

  return {
    date,
    completions,
    sleepLog: createEmptySleepLog(),
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
  };
}

function getDefaultSettings(): UserSettings {
  return {
    name: "",
    bedtime: "22:30",
    wakeTime: "06:30",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    subscriptionStatus: "trial",
    trialStartDate: new Date().toISOString(),
    notificationsEnabled: false,
    weekStartsOn: 1,
    completedOnboarding: false,
  };
}

/**
 * Build a fresh default state with sleep protocols pre-loaded.
 */
export function getDefaultState(): AppState {
  return {
    version: 2,
    settings: getDefaultSettings(),
    protocols: {
      sleep: defaultSleepProtocol,
      exercise: defaultExerciseProtocol,
      nutrition: defaultNutritionProtocol,
      supplements: defaultSupplementsProtocol,
    },
    dailyLogs: [],
    insights: [],
    currentStreak: 0,
  };
}

/**
 * Load state from localStorage. Returns default state if nothing is stored
 * or if the stored data is invalid.
 */
export function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();

    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 2) return getDefaultState();

    return parsed;
  } catch {
    return getDefaultState();
  }
}

/**
 * Persist state to localStorage.
 */
export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable -- fail silently
  }
}

/**
 * Get all enabled protocol items across all pillars.
 */
function getAllEnabledItems(state: AppState): ProtocolItem[] {
  const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];
  return pillars.flatMap((p) =>
    state.protocols[p].filter((item) => item.isEnabled)
  );
}

/**
 * Get today's log from state, creating a new one if it doesn't exist.
 */
export function getTodayLog(state: AppState): DailyLog {
  const today = getDateString();
  const existing = state.dailyLogs.find((log) => log.date === today);
  if (existing) return existing;

  const enabledItems = getAllEnabledItems(state);
  return createEmptyDailyLog(today, enabledItems);
}

/**
 * Get or create a log for a specific date.
 */
function getOrCreateLog(state: AppState, date: string): DailyLog {
  const existing = state.dailyLogs.find((log) => log.date === date);
  if (existing) return existing;

  const enabledItems = getAllEnabledItems(state);
  return createEmptyDailyLog(date, enabledItems);
}

/**
 * Recalculate score for a log and update streak on state.
 */
function recalculate(state: AppState, log: DailyLog): DailyLog {
  const enabledItems = getAllEnabledItems(state);
  const score = calculateDailyScore(log, enabledItems, state.settings);
  return { ...log, score };
}

/**
 * Upsert a daily log into state.
 */
export function saveDailyLog(state: AppState, log: DailyLog): AppState {
  const updatedLog = recalculate(state, log);
  const existingIndex = state.dailyLogs.findIndex((l) => l.date === log.date);

  const dailyLogs =
    existingIndex >= 0
      ? state.dailyLogs.map((l, i) => (i === existingIndex ? updatedLog : l))
      : [...state.dailyLogs, updatedLog];

  const currentStreak = calculateStreak(dailyLogs);

  return { ...state, dailyLogs, currentStreak };
}

/**
 * Toggle the completion status of a protocol item for a given date.
 */
export function toggleCompletion(
  state: AppState,
  date: string,
  itemId: string
): AppState {
  const log = getOrCreateLog(state, date);
  const completionIndex = log.completions.findIndex(
    (c) => c.itemId === itemId
  );

  let updatedCompletions: ItemCompletion[];

  if (completionIndex >= 0) {
    updatedCompletions = log.completions.map((c, i) => {
      if (i !== completionIndex) return c;
      return {
        ...c,
        completedAt: c.completedAt === null ? new Date().toISOString() : null,
        skipped: false,
      };
    });
  } else {
    updatedCompletions = [
      ...log.completions,
      {
        itemId,
        completedAt: new Date().toISOString(),
        note: "",
        skipped: false,
      },
    ];
  }

  const updatedLog = { ...log, completions: updatedCompletions };
  return saveDailyLog(state, updatedLog);
}

/**
 * Update the note for a specific item completion on a given date.
 */
export function updateItemNote(
  state: AppState,
  date: string,
  itemId: string,
  note: string
): AppState {
  const log = getOrCreateLog(state, date);
  const completionIndex = log.completions.findIndex(
    (c) => c.itemId === itemId
  );

  let updatedCompletions: ItemCompletion[];

  if (completionIndex >= 0) {
    updatedCompletions = log.completions.map((c, i) =>
      i === completionIndex ? { ...c, note } : c
    );
  } else {
    updatedCompletions = [
      ...log.completions,
      { itemId, completedAt: null, note, skipped: false },
    ];
  }

  const updatedLog = { ...log, completions: updatedCompletions };
  return saveDailyLog(state, updatedLog);
}

/**
 * Update sleep log fields for a given date.
 */
export function updateSleepLog(
  state: AppState,
  date: string,
  sleepLogUpdate: Partial<SleepLog>
): AppState {
  const log = getOrCreateLog(state, date);
  const updatedLog = {
    ...log,
    sleepLog: { ...log.sleepLog, ...sleepLogUpdate },
  };
  return saveDailyLog(state, updatedLog);
}

/**
 * Update energy and/or mood ratings for a given date.
 */
export function updateDailyRatings(
  state: AppState,
  date: string,
  updates: { energy?: number; mood?: number }
): AppState {
  const log = getOrCreateLog(state, date);
  const updatedLog = {
    ...log,
    ...(updates.energy !== undefined && { energyLevel: updates.energy }),
    ...(updates.mood !== undefined && { moodLevel: updates.mood }),
  };
  return saveDailyLog(state, updatedLog);
}
