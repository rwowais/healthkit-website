import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./constants";
import { calculateDailyScore, calculateStreak } from "./scoring";
import type {
  AppState,
  BiomarkerEntry,
  DailyLog,
  ExerciseEntry,
  ItemCompletion,
  NutritionScorecard,
  Pillar,
  ProtocolItem,
  SleepItemCompletion,
  SleepLog,
  SupplementEntry,
  SupplementMeta,
  SupplementMetaMap,
  UserSettings,
} from "./types";

import { DEFAULT_INSTALLED } from "./packs";
import { compileTimeline } from "./engine";
import type { ProtocolPack, BehaviorOverride } from "./types";
import { defaultSleepProtocol } from "./defaults/sleep";
import { defaultExerciseProtocol } from "./defaults/exercise";
import { defaultNutritionProtocol } from "./defaults/nutrition";
import { defaultSupplementsProtocol } from "./defaults/supplements";

// ── Helpers ───────────────────────────────────────────────────────

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

function createEmptyNutritionScorecard(): NutritionScorecard {
  return {
    hitProteinTarget: null,
    ateFruitsVeggies: null,
    stayedHydrated: null,
    avoidedProcessedSugar: null,
    finishedEatingOnTime: null,
    minimizedAlcohol: null,
    customItems: [],
    note: "",
  };
}

function createEmptyDailyLog(
  date: string,
  protocols: Record<Pillar, ProtocolItem[]>
): DailyLog {
  const sleepCompletions: SleepItemCompletion[] = protocols.sleep
    .filter((item) => item.isEnabled)
    .map((item) => ({ itemId: item.id, completed: false }));

  const exerciseEntries: ExerciseEntry[] = protocols.exercise
    .filter((item) => item.isEnabled && item.itemType === "task")
    .map((item) => ({
      itemId: item.id,
      completed: false,
      durationMinutes: null,
      intensity: null,
      feeling: null,
      note: "",
    }));

  const supplementEntries: SupplementEntry[] = protocols.supplements
    .filter((item) => item.isEnabled)
    .map((item) => ({
      itemId: item.id,
      taken: false,
      skipped: false,
      skipReason: "",
    }));

  return {
    date,
    sleepCompletions,
    exerciseEntries,
    nutritionScorecard: createEmptyNutritionScorecard(),
    supplementEntries,
    completions: [], // legacy
    sleepLog: createEmptySleepLog(),
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: {},
  };
}

// ── Default state ─────────────────────────────────────────────────

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

export function getDefaultState(): AppState {
  return {
    version: 3,
    settings: getDefaultSettings(),
    protocols: {
      sleep: defaultSleepProtocol,
      exercise: defaultExerciseProtocol,
      nutrition: defaultNutritionProtocol,
      supplements: defaultSupplementsProtocol,
    },
    supplementMeta: buildDefaultSupplementMeta(defaultSupplementsProtocol),
    dailyLogs: [],
    biomarkers: [],
    insights: [],
    currentStreak: 0,
    installedPacks: [...DEFAULT_INSTALLED],
    customPacks: [],
    behaviorOverrides: {},
  };
}

/** Backfill any fields missing from older v3 saves (schema hardening). */
function normalize(s: AppState): AppState {
  const d = getDefaultState();
  return {
    ...s,
    settings: { ...d.settings, ...s.settings },
    protocols: s.protocols ?? d.protocols,
    supplementMeta: s.supplementMeta ?? d.supplementMeta,
    dailyLogs: Array.isArray(s.dailyLogs) ? s.dailyLogs : [],
    biomarkers: Array.isArray(s.biomarkers) ? s.biomarkers : [],
    insights: Array.isArray(s.insights) ? s.insights : [],
    currentStreak: s.currentStreak ?? 0,
    installedPacks:
      Array.isArray(s.installedPacks) && s.installedPacks.length
        ? s.installedPacks
        : [...DEFAULT_INSTALLED],
    customPacks: Array.isArray(s.customPacks) ? s.customPacks : [],
    behaviorOverrides:
      s.behaviorOverrides && typeof s.behaviorOverrides === "object"
        ? s.behaviorOverrides
        : {},
  };
}

function buildDefaultSupplementMeta(
  items: ProtocolItem[]
): SupplementMetaMap {
  const map: SupplementMetaMap = {};
  for (const item of items) {
    map[item.id] = {
      reasonForTaking: item.description,
      dosage: "",
      brand: "",
      stopped: false,
      stoppedReason: "",
      stoppedDate: null,
    };
  }
  return map;
}

// ── Load / Save ───────────────────────────────────────────────────

function parseState(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 3) return normalize(parsed as AppState);
    if (parsed?.version === 2) return normalize(migrateV2toV3(parsed));
    return null;
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();

  // Current key
  const cur = localStorage.getItem(STORAGE_KEY);
  if (cur) {
    const s = parseState(cur);
    if (s) return s;
  }

  // Migrate from any legacy key, then persist under the current key
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const s = parseState(raw);
    if (s) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        /* storage full — non-fatal */
      }
      return s;
    }
  }

  return getDefaultState();
}

/** Wipe all Protocolize data across current + legacy keys. */
export function clearAllData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const k of LEGACY_STORAGE_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function migrateV2toV3(v2: Record<string, unknown>): AppState {
  const base = getDefaultState();
  const v2Settings = v2.settings as Record<string, unknown> | undefined;
  const v2Protocols = v2.protocols as Record<string, ProtocolItem[]> | undefined;

  if (v2Settings) {
    base.settings = { ...base.settings, ...(v2Settings as Partial<UserSettings>) };
  }

  // Migrate protocols — add itemType field
  if (v2Protocols) {
    const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];
    for (const pillar of pillars) {
      if (v2Protocols[pillar]) {
        base.protocols[pillar] = v2Protocols[pillar].map((item) => ({
          ...item,
          itemType: item.itemType || guessItemType(item),
        }));
      }
    }
  }

  base.supplementMeta = buildDefaultSupplementMeta(base.protocols.supplements);

  return base;
}

/** Guess whether a v2 item is a task or reminder based on its name */
function guessItemType(item: ProtocolItem): "task" | "reminder" {
  const reminderKeywords = [
    "cutoff", "no ", "limit", "minimize", "avoid", "no intense",
  ];
  const nameLower = item.name.toLowerCase();
  return reminderKeywords.some((kw) => nameLower.includes(kw))
    ? "reminder"
    : "task";
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

// ── Accessors ─────────────────────────────────────────────────────

function getAllEnabledItems(state: AppState): ProtocolItem[] {
  const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];
  return pillars.flatMap((p) =>
    state.protocols[p].filter((item) => item.isEnabled)
  );
}

export function getTodayLog(state: AppState): DailyLog {
  const today = getDateString();
  const existing = state.dailyLogs.find((log) => log.date === today);
  if (existing) return existing;
  return createEmptyDailyLog(today, state.protocols);
}

function getOrCreateLog(state: AppState, date: string): DailyLog {
  const existing = state.dailyLogs.find((log) => log.date === date);
  if (existing) return existing;
  return createEmptyDailyLog(date, state.protocols);
}

/** Public: read (or synthesize) the log for any date. */
export function getLogForDate(state: AppState, date: string): DailyLog {
  return getOrCreateLog(state, date);
}

// ── Protocol OS: behaviors & packs ────────────────────────────────

function isoDayIndex(dateStr: string): number {
  const j = new Date(dateStr + "T00:00:00").getDay();
  return j === 0 ? 6 : j - 1;
}

export function toggleBehavior(
  state: AppState,
  date: string,
  key: string
): AppState {
  const log = getOrCreateLog(state, date);
  const bc = { ...(log.behaviorCompletions ?? {}) };
  bc[key] = !bc[key];

  const items = compileTimeline(state, isoDayIndex(date));
  const total = items.length || 1;
  const done = items.filter((i) => bc[i.canonicalKey]).length;
  const score = Math.round((done / total) * 100);

  const updated: DailyLog = { ...log, behaviorCompletions: bc, score };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];

  return {
    ...state,
    dailyLogs,
    currentStreak: calculateStreak(dailyLogs),
  };
}

export function installPack(state: AppState, id: string): AppState {
  if (state.installedPacks.includes(id)) return state;
  return { ...state, installedPacks: [...state.installedPacks, id] };
}

export function uninstallPack(state: AppState, id: string): AppState {
  return {
    ...state,
    installedPacks: state.installedPacks.filter((p) => p !== id),
  };
}

export function setBehaviorOverride(
  state: AppState,
  key: string,
  ov: BehaviorOverride
): AppState {
  return {
    ...state,
    behaviorOverrides: { ...state.behaviorOverrides, [key]: ov },
  };
}

export function upsertCustomPack(
  state: AppState,
  pack: ProtocolPack
): AppState {
  const exists = state.customPacks.some((p) => p.id === pack.id);
  const customPacks = exists
    ? state.customPacks.map((p) => (p.id === pack.id ? pack : p))
    : [...state.customPacks, pack];
  const installedPacks = state.installedPacks.includes(pack.id)
    ? state.installedPacks
    : [...state.installedPacks, pack.id];
  return { ...state, customPacks, installedPacks };
}

export function deleteCustomPack(state: AppState, id: string): AppState {
  return {
    ...state,
    customPacks: state.customPacks.filter((p) => p.id !== id),
    installedPacks: state.installedPacks.filter((p) => p !== id),
  };
}

// ── Biomarkers ────────────────────────────────────────────────────

export function addBiomarker(
  state: AppState,
  entry: Omit<BiomarkerEntry, "id">
): AppState {
  const e: BiomarkerEntry = {
    ...entry,
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  return { ...state, biomarkers: [...state.biomarkers, e] };
}

export function deleteBiomarker(state: AppState, id: string): AppState {
  return {
    ...state,
    biomarkers: state.biomarkers.filter((b) => b.id !== id),
  };
}

export function latestBiomarker(
  state: AppState,
  metric: string
): BiomarkerEntry | undefined {
  return state.biomarkers
    .filter((b) => b.metric === metric)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Public: full-state export / import for backup. */
export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(raw: string): AppState | null {
  return parseState(raw);
}

// ── Recalculate ───────────────────────────────────────────────────

function recalculate(state: AppState, log: DailyLog): DailyLog {
  const enabledItems = getAllEnabledItems(state);
  const score = calculateDailyScore(log, enabledItems, state.settings);

  // Calculate per-pillar scores
  const pillarScores = {
    sleep: calculateSleepScore(log),
    exercise: calculateExerciseScore(log),
    nutrition: calculateNutritionScore(log),
    supplements: calculateSupplementScore(log),
  };

  return { ...log, score, pillarScores };
}

function calculateSleepScore(log: DailyLog): number {
  const items = log.sleepCompletions;
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

function calculateExerciseScore(log: DailyLog): number {
  const items = log.exerciseEntries;
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

function calculateNutritionScore(log: DailyLog): number {
  const sc = log.nutritionScorecard;
  const fields = [
    sc.hitProteinTarget,
    sc.ateFruitsVeggies,
    sc.stayedHydrated,
    sc.avoidedProcessedSugar,
    sc.finishedEatingOnTime,
    sc.minimizedAlcohol,
  ];
  const customAnswers = sc.customItems.map((i) => i.answer);
  const all = [...fields, ...customAnswers];
  const answered = all.filter((a) => a !== null);
  if (answered.length === 0) return 0;

  let points = 0;
  for (const a of answered) {
    if (a === "yes") points += 1;
    else if (a === "mostly") points += 0.6;
  }
  return Math.round((points / answered.length) * 100);
}

function calculateSupplementScore(log: DailyLog): number {
  const items = log.supplementEntries;
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.taken).length;
  return Math.round((done / items.length) * 100);
}

// ── Upsert ────────────────────────────────────────────────────────

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

// ── Sleep tracking ────────────────────────────────────────────────

export function toggleSleepItem(
  state: AppState,
  date: string,
  itemId: string
): AppState {
  const log = getOrCreateLog(state, date);
  const idx = log.sleepCompletions.findIndex((c) => c.itemId === itemId);

  let sleepCompletions: SleepItemCompletion[];
  if (idx >= 0) {
    sleepCompletions = log.sleepCompletions.map((c, i) =>
      i === idx ? { ...c, completed: !c.completed } : c
    );
  } else {
    sleepCompletions = [
      ...log.sleepCompletions,
      { itemId, completed: true },
    ];
  }

  return saveDailyLog(state, { ...log, sleepCompletions });
}

// ── Exercise tracking ─────────────────────────────────────────────

export function updateExerciseEntry(
  state: AppState,
  date: string,
  itemId: string,
  updates: Partial<ExerciseEntry>
): AppState {
  const log = getOrCreateLog(state, date);
  const idx = log.exerciseEntries.findIndex((e) => e.itemId === itemId);

  let exerciseEntries: ExerciseEntry[];
  if (idx >= 0) {
    exerciseEntries = log.exerciseEntries.map((e, i) =>
      i === idx ? { ...e, ...updates } : e
    );
  } else {
    exerciseEntries = [
      ...log.exerciseEntries,
      {
        itemId,
        completed: false,
        durationMinutes: null,
        intensity: null,
        feeling: null,
        note: "",
        ...updates,
      },
    ];
  }

  return saveDailyLog(state, { ...log, exerciseEntries });
}

// ── Nutrition tracking ────────────────────────────────────────────

export function updateNutritionScorecard(
  state: AppState,
  date: string,
  updates: Partial<NutritionScorecard>
): AppState {
  const log = getOrCreateLog(state, date);
  const nutritionScorecard = { ...log.nutritionScorecard, ...updates };
  return saveDailyLog(state, { ...log, nutritionScorecard });
}

// ── Supplement tracking ───────────────────────────────────────────

export function updateSupplementEntry(
  state: AppState,
  date: string,
  itemId: string,
  updates: Partial<SupplementEntry>
): AppState {
  const log = getOrCreateLog(state, date);
  const idx = log.supplementEntries.findIndex((s) => s.itemId === itemId);

  let supplementEntries: SupplementEntry[];
  if (idx >= 0) {
    supplementEntries = log.supplementEntries.map((s, i) =>
      i === idx ? { ...s, ...updates } : s
    );
  } else {
    supplementEntries = [
      ...log.supplementEntries,
      { itemId, taken: false, skipped: false, skipReason: "", ...updates },
    ];
  }

  return saveDailyLog(state, { ...log, supplementEntries });
}

// ── Supplement meta ───────────────────────────────────────────────

export function updateSupplementMeta(
  state: AppState,
  itemId: string,
  updates: Partial<SupplementMeta>
): AppState {
  const current = state.supplementMeta[itemId] || {
    reasonForTaking: "",
    dosage: "",
    brand: "",
    stopped: false,
    stoppedReason: "",
    stoppedDate: null,
  };
  return {
    ...state,
    supplementMeta: {
      ...state.supplementMeta,
      [itemId]: { ...current, ...updates },
    },
  };
}

// ── Legacy compatibility ──────────────────────────────────────────

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

export function updateItemNote(
  state: AppState,
  date: string,
  itemId: string,
  note: string
): AppState {
  const log = getOrCreateLog(state, date);
  const idx = log.completions.findIndex((c) => c.itemId === itemId);

  let updatedCompletions: ItemCompletion[];
  if (idx >= 0) {
    updatedCompletions = log.completions.map((c, i) =>
      i === idx ? { ...c, note } : c
    );
  } else {
    updatedCompletions = [
      ...log.completions,
      { itemId, completedAt: null, note, skipped: false },
    ];
  }

  return saveDailyLog(state, { ...log, completions: updatedCompletions });
}

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
