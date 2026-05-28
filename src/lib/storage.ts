import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./constants";
import { getTz, dayIndexOfKeyInTz, dateKeyInTz } from "./tz";
import {
  SUPPLEMENT_CANONICAL_KEYS,
  isSupplementBehavior,
} from "./supplements";
import { calculateStreak } from "./scoring";
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

import { DEFAULT_INSTALLED, PACKS } from "./packs";
import {
  compileTimeline,
  shapeTimeline,
  adapt,
  masteredKeys,
} from "./engine";
import { keystone } from "./intel";
import type {
  BehaviorDef,
  BehaviorOverride,
  Insight,
  ProtocolPack,
  Supplement,
} from "./types";
import { defaultSleepProtocol } from "./defaults/sleep";
import { defaultExerciseProtocol } from "./defaults/exercise";
import { defaultNutritionProtocol } from "./defaults/nutrition";
import { defaultSupplementsProtocol } from "./defaults/supplements";

// ── Helpers ───────────────────────────────────────────────────────

/**
 * YYYY-MM-DD for the user's local calendar day. Pass `tz` (from
 * getTz(state.settings)) to ensure logs belong to the user's local
 * day regardless of device clock; falls back to device tz when tz
 * isn't available (cold paths that don't have state).
 */
function getDateString(date?: Date, tz?: string): string {
  return dateKeyInTz(tz || (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return "UTC"; }
  })(), date ?? new Date());
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
    tier: "free",
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
    pausedPacks: [],
    customPacks: [],
    behaviorOverrides: {},
  };
}

const uniq = (xs: string[]): string[] => Array.from(new Set(xs));

/** Backfill any fields missing from older v3 saves (schema hardening). */
function normalize(s: AppState): AppState {
  const d = getDefaultState();

  // Honor an EXPLICIT list even when empty — a user who removed every
  // protocol must keep zero, not have the defaults silently resurrected
  // on the next load/sync. Only seed defaults when the field is missing
  // or corrupt (older schema / bad payload).
  const installedPacks = Array.isArray(s.installedPacks)
    ? uniq(s.installedPacks)
    : [...DEFAULT_INSTALLED];
  const pausedPacks = Array.isArray(s.pausedPacks)
    ? uniq(s.pausedPacks)
    : [];
  // Heal forks created before the de-namespace fix: strip a leading
  // `custom-<digits>:` prefix off custom-pack behavior keys so an
  // existing "(yours)" pack merges with the original instead of
  // duplicating every behavior. Idempotent (no prefix → unchanged).
  //
  // P0 GOVERNANCE GUARD: After the legacy heal, FORCE every customPack
  // behavior into the `custom:` namespace. Without this, a user can
  // import an AppState JSON with `canonicalKey: "morning-sunlight"`
  // inside a customPack, and the engine's trustTier classifier
  // (which keys off the canonical key shape) will report "curated"
  // for a row whose body is entirely user-authored. That's the
  // ontology pollution the governance contract is supposed to
  // prevent. We rewrite to `custom:<packId>:<base>-<rand>` so:
  //   - trustTier classifies it as "custom" (or "derived" if
  //     derivedFrom is set)
  //   - the recommendation gates in intel.ts catch it
  //   - the engine never claims authority over user content
  // Behaviors already namespaced (custom:, fork:) pass through.
  // Set of all curated canonicalKeys — used to distinguish legacy forks
  // (bare key that matches a real curated atom) from free-text customs
  // (bare key that doesn't). Legacy forks transition to fork: namespace
  // with derivedFrom pointing at the curated original. Free-text
  // customs get rewritten into the custom: namespace.
  const curatedKeySet = new Set<string>();
  for (const pack of PACKS) {
    for (const b of pack.behaviors) curatedKeySet.add(b.canonicalKey);
  }
  const customPacks = (
    Array.isArray(s.customPacks) ? s.customPacks : []
  ).map((p) => ({
    ...p,
    behaviors: (p.behaviors ?? []).map((b) => {
      // Strip legacy `custom-<digits>:` first (idempotent)
      const dehealed = b.canonicalKey.replace(/^custom-\d+:/, "");
      // Already in a reserved namespace? Trust it.
      if (
        dehealed.startsWith("custom:") ||
        dehealed.startsWith("fork:")
      ) {
        return { ...b, canonicalKey: dehealed };
      }
      // Legacy fork: the bare key matches a curated atom AND the prefix
      // strip changed something (so we know the original was a legacy
      // fork format). Convert to the new fork: namespace with
      // derivedFrom set to the curated original — the fork still
      // merges with the curated via effectiveKey, but the namespace
      // makes the trust tier classify it as "derived" (not
      // ontologically polluting "curated").
      const wasLegacyFork = b.canonicalKey !== dehealed;
      if (wasLegacyFork && curatedKeySet.has(dehealed)) {
        return {
          ...b,
          canonicalKey: `fork:${p.id}:${dehealed}`,
          derivedFrom: b.derivedFrom ?? dehealed,
        };
      }
      // Bare key inside a customPack — force into custom namespace.
      // Use the pack id (deterministic) + a derived slug + a short
      // stable suffix so two different packs with the same bare key
      // don't collide on the way in. The suffix is derived from the
      // bare key itself so the rewrite is stable across reloads —
      // we want the same input to namespace to the same output.
      const slug = dehealed
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "item";
      const stableSuffix = Math.abs(
        Array.from(dehealed).reduce(
          (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
          0
        )
      )
        .toString(36)
        .slice(0, 4);
      return {
        ...b,
        canonicalKey: `custom:${p.id}:${slug}-${stableSuffix}`,
      };
    }),
  }));

  // Prune behaviorOverrides that no longer belong to any installed pack —
  // uninstalling/deleting a pack must not leave orphaned overrides behind.
  const installedSet = new Set(installedPacks);
  const validKeys = new Set<string>();
  for (const pack of [...PACKS, ...customPacks]) {
    if (!installedSet.has(pack.id)) continue;
    for (const b of pack.behaviors) validKeys.add(b.canonicalKey);
  }
  const rawOverrides =
    s.behaviorOverrides && typeof s.behaviorOverrides === "object"
      ? s.behaviorOverrides
      : {};
  const behaviorOverrides: Record<string, BehaviorOverride> = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    if (!validKeys.has(k)) continue;
    // Healing pass: a behaviorOverride with daysActive set to all-false
    // is semantically "disabled on every day" — but the timeline filter
    // honors daysActive[dayIndex] strictly, so this leaves the behavior
    // permanently muted with no UI indication. Convert to an explicit
    // `disabled: true` override so the user sees it correctly as paused
    // (and can re-enable from the BehaviorSheet).
    const ov = v as BehaviorOverride;
    if (
      Array.isArray(ov.daysActive) &&
      ov.daysActive.length === 7 &&
      ov.daysActive.every((d) => d === false)
    ) {
      behaviorOverrides[k] = {
        ...ov,
        daysActive: undefined,
        disabled: true,
      };
      continue;
    }
    behaviorOverrides[k] = ov;
  }

  // ── Supplement separation (one-time migration + sync) ─────────────
  // First load after this schema lands: existing users have supplement
  // behaviors mixed into installed packs and behaviorCompletions. We
  // pull those into a separate `supplements` array + per-day
  // supplementCompletions, then mark the migration done so it never
  // runs again. On every subsequent load we also SYNC any newly-
  // installed-pack supplements that haven't yet been added (so a
  // user who installs Daily Essentials post-migration gets its
  // supplements auto-populated). See lib/supplements.ts for the
  // canonical-key set + helpers.
  const installedSetSupp = new Set(installedPacks);
  // Build the set of curated supplement keys CURRENTLY available to
  // this user (i.e., they belong to an installed pack or appear as
  // a standalone — note: standalones aren't auto-added unless the
  // user explicitly picks them via the library, so we only sync
  // pack-bound supplements automatically).
  const installedSupplementKeys = new Set<string>();
  const packForSupplementKey = new Map<string, string>();
  for (const p of PACKS) {
    if (!installedSetSupp.has(p.id)) continue;
    for (const b of p.behaviors) {
      // Use the broad detector so CMS-renamed titles + icon=pill
      // entries that escaped the canonical-key registry still get
      // extracted into state.supplements. Keys not in the strict
      // registry are still tracked by their canonicalKey.
      if (isSupplementBehavior(b)) {
        installedSupplementKeys.add(b.canonicalKey);
        if (!packForSupplementKey.has(b.canonicalKey))
          packForSupplementKey.set(b.canonicalKey, p.id);
      }
    }
  }
  // Preserve any existing supplements the user has (including their
  // overrides, brand notes, inventory tracking).
  const priorSupplements: Supplement[] = Array.isArray(s.supplements)
    ? s.supplements
    : [];
  const priorSuppById = new Map(priorSupplements.map((x) => [x.id, x]));
  const nextSupplements: Supplement[] = [];
  // 1. Existing user customs / previously-migrated rows survive as-is.
  for (const sp of priorSupplements) {
    // Curated supplement from a pack the user has since uninstalled?
    // Drop it — its presence is now stale. Customs always survive.
    if (
      sp.source === "curated" &&
      sp.installedFromPack &&
      !installedSetSupp.has(sp.installedFromPack)
    ) {
      continue;
    }
    nextSupplements.push(sp);
  }
  // 2. New pack-installed supplements that aren't yet in state get
  //    auto-added with their curated defaults.
  for (const key of installedSupplementKeys) {
    if (priorSuppById.has(key)) continue;
    const packId = packForSupplementKey.get(key);
    // Find the behavior def in the catalog (deduped across packs).
    let def: BehaviorDef | undefined;
    for (const p of PACKS) {
      def = p.behaviors.find((b) => b.canonicalKey === key);
      if (def) break;
    }
    if (!def) continue;
    nextSupplements.push({
      id: def.canonicalKey,
      name: def.title,
      dose: def.dose,
      block: def.block,
      timing: def.timingReason,
      daysActive: def.daysActive,
      derivedFrom: def.canonicalKey,
      contraindications: def.contraindications,
      evidence: def.evidence,
      evidenceTier: def.evidenceTier,
      rationale: def.rationale,
      source: "curated",
      installedFromPack: packId,
    });
  }

  // Migrate completions: walk every daily log; for each
  // behaviorCompletions key that's a supplement, copy it into
  // supplementCompletions. Only runs the first time (gated on
  // supplementsMigratedAt) so we don't keep rewriting logs forever.
  const SUPPLEMENT_MIGRATION_VERSION = 1;
  const alreadyMigrated =
    (s.supplementsMigratedAt ?? 0) >= SUPPLEMENT_MIGRATION_VERSION;
  const rawLogs: DailyLog[] = Array.isArray(s.dailyLogs) ? s.dailyLogs : [];
  const migratedLogs: DailyLog[] = alreadyMigrated
    ? rawLogs
    : rawLogs.map((l) => {
        const bc = l.behaviorCompletions ?? {};
        const existingSuppDone = l.supplementCompletions ?? {};
        const nextSuppDone: Record<string, boolean> = { ...existingSuppDone };
        for (const [key, done] of Object.entries(bc)) {
          if (!done) continue;
          if (SUPPLEMENT_CANONICAL_KEYS.has(key)) {
            nextSuppDone[key] = true;
          }
        }
        return { ...l, supplementCompletions: nextSuppDone };
      });

  return {
    ...s,
    settings: { ...d.settings, ...s.settings },
    protocols: s.protocols ?? d.protocols,
    supplementMeta: s.supplementMeta ?? d.supplementMeta,
    dailyLogs: migratedLogs,
    biomarkers: Array.isArray(s.biomarkers) ? s.biomarkers : [],
    insights: Array.isArray(s.insights) ? s.insights : [],
    currentStreak: s.currentStreak ?? 0,
    installedPacks,
    pausedPacks,
    customPacks,
    behaviorOverrides,
    supplements: nextSupplements,
    supplementsMigratedAt: SUPPLEMENT_MIGRATION_VERSION,
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

  base.supplementMeta = {
    ...buildDefaultSupplementMeta(base.protocols.supplements),
    ...(v2.supplementMeta && typeof v2.supplementMeta === "object"
      ? (v2.supplementMeta as SupplementMetaMap)
      : {}),
  };

  // Carry forward the user's actual history — losing this on migration
  // would silently wipe streaks, tracking and biomarkers.
  if (Array.isArray(v2.dailyLogs)) base.dailyLogs = v2.dailyLogs as DailyLog[];
  if (Array.isArray(v2.biomarkers))
    base.biomarkers = v2.biomarkers as BiomarkerEntry[];
  if (Array.isArray(v2.insights)) base.insights = v2.insights as Insight[];
  if (typeof v2.currentStreak === "number")
    base.currentStreak = v2.currentStreak;

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

/** Event other components listen to in order to surface save failures. */
export const SAVE_ERROR_EVENT = "pz:save-error";

export function saveState(state: AppState): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Quota exceeded / storage unavailable — don't fail silently, the
    // user needs to know their data isn't being saved on this device.
    window.dispatchEvent(
      new CustomEvent(SAVE_ERROR_EVENT, { detail: "local" })
    );
    return false;
  }
}

// ── Accessors ─────────────────────────────────────────────────────

export function getTodayLog(state: AppState): DailyLog {
  const today = getDateString(undefined, getTz(state.settings));
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

/**
 * Map a stored YYYY-MM-DD key to Mon=0..Sun=6 in the user's timezone.
 * Was: device-clock based; now: timezone-aware via dayIndexOfKeyInTz.
 * `state` is passed in so we use the same tz the engine used when the
 * key was minted.
 */
function isoDayIndex(state: AppState, dateStr: string): number {
  return dayIndexOfKeyInTz(getTz(state.settings), dateStr);
}

/**
 * The single source of truth for a day's score: % of the *shaped*
 * (non-muted) behavior timeline completed. Both the behavior toggle and
 * the legacy recalculate path use this so the check-in (or any other
 * mutation) can never overwrite it with the dead pillar model.
 * Past days render unshaped (mode "normal").
 */
export function computeBehaviorScore(
  state: AppState,
  date: string,
  behaviorCompletions: Record<string, boolean>
): number {
  const tz = getTz(state.settings);
  const isToday = date === getDateString(undefined, tz);
  const compiled = compileTimeline(state, isoDayIndex(state, date));
  const shaped = shapeTimeline(
    compiled,
    isToday ? adapt(state).mode : "normal",
    {
      keystoneKey: keystone(state)?.key,
      mastered: masteredKeys(state, date),
    }
  );
  const active = shaped.filter((i) => !i.muted);
  if (active.length === 0) return 0;
  const done = active.filter((i) => behaviorCompletions[i.canonicalKey])
    .length;
  return Math.round((done / active.length) * 100);
}

export function toggleBehavior(
  state: AppState,
  date: string,
  key: string
): AppState {
  const log = getOrCreateLog(state, date);
  const bc = { ...(log.behaviorCompletions ?? {}) };
  bc[key] = !bc[key];

  const score = computeBehaviorScore(state, date, bc);

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

// ── Supplement actions ────────────────────────────────────────────
//
// Supplements live in state.supplements, with per-day completion
// tracked in dailyLog.supplementCompletions. These mirror the
// behavior actions but operate on the supplement-specific surfaces.

/** Toggle a single supplement's completion for a given day. */
export function toggleSupplement(
  state: AppState,
  date: string,
  id: string
): AppState {
  const log = getOrCreateLog(state, date);
  const sc = { ...(log.supplementCompletions ?? {}) };
  sc[id] = !sc[id];
  // Inventory: if the supplement has inventory tracking enabled,
  // decrement (or restore) by 1 on this toggle. Only affects the
  // count when the toggle goes 0→1; un-checking restores +1 so
  // accidental taps don't desync the count.
  const wasDone = (log.supplementCompletions ?? {})[id] === true;
  const isDone = sc[id] === true;
  let supplements = state.supplements;
  if (supplements?.some((s) => s.id === id && s.inventory)) {
    supplements = supplements.map((s) => {
      if (s.id !== id || !s.inventory) return s;
      const delta = wasDone === isDone ? 0 : isDone ? -1 : +1;
      if (delta === 0) return s;
      return {
        ...s,
        inventory: {
          ...s.inventory,
          count: Math.max(0, s.inventory.count + delta),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }
  const updated: DailyLog = { ...log, supplementCompletions: sc };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];
  return { ...state, dailyLogs, supplements };
}

/**
 * Bulk-check every supplement in a block for the given day. The
 * "take stack" affordance — one tap to confirm the morning bundle.
 * Returns state unchanged if the supplement list is empty.
 */
export function bulkCheckSupplements(
  state: AppState,
  date: string,
  ids: string[]
): AppState {
  if (ids.length === 0) return state;
  const log = getOrCreateLog(state, date);
  const sc = { ...(log.supplementCompletions ?? {}) };
  const newlyDone = new Set<string>();
  for (const id of ids) {
    if (!sc[id]) newlyDone.add(id);
    sc[id] = true;
  }
  // Inventory decrement for each newly-completed supplement.
  let supplements = state.supplements;
  if (supplements && newlyDone.size > 0) {
    supplements = supplements.map((s) => {
      if (!newlyDone.has(s.id) || !s.inventory) return s;
      return {
        ...s,
        inventory: {
          ...s.inventory,
          count: Math.max(0, s.inventory.count - 1),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }
  const updated: DailyLog = { ...log, supplementCompletions: sc };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];
  return { ...state, dailyLogs, supplements };
}

/** Add a new supplement (custom or curated catalog pick). */
export function addSupplement(
  state: AppState,
  supp: Supplement
): AppState {
  const list = state.supplements ?? [];
  if (list.some((s) => s.id === supp.id)) return state;
  return { ...state, supplements: [...list, supp] };
}

/** Update an existing supplement by id (partial patch). */
export function updateSupplement(
  state: AppState,
  id: string,
  patch: Partial<Supplement>
): AppState {
  const list = state.supplements ?? [];
  return {
    ...state,
    supplements: list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

/** Remove a supplement by id. Removes its completion history too. */
export function removeSupplement(state: AppState, id: string): AppState {
  const list = state.supplements ?? [];
  return {
    ...state,
    supplements: list.filter((s) => s.id !== id),
    // Clean up completion data so deleting + re-adding doesn't
    // resurrect old check states.
    dailyLogs: state.dailyLogs.map((l) => {
      if (!l.supplementCompletions || !l.supplementCompletions[id]) return l;
      const sc = { ...l.supplementCompletions };
      delete sc[id];
      return { ...l, supplementCompletions: sc };
    }),
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

/** Reversibly pause / resume an installed pack (non-destructive). */
export function setPackPaused(
  state: AppState,
  id: string,
  paused: boolean
): AppState {
  const cur = state.pausedPacks ?? [];
  const pausedPacks = paused
    ? cur.includes(id)
      ? cur
      : [...cur, id]
    : cur.filter((p) => p !== id);
  return { ...state, pausedPacks };
}

/** Fork a pack into an editable custom copy (installed; original removed). */
export function duplicatePack(
  state: AppState,
  source: ProtocolPack
): AppState {
  const newId = `custom-${Date.now()}`;
  // Forked behaviors now use a fork-namespaced canonicalKey AND a
  // `derivedFrom` pointer back to the curated original. Why both:
  //   - Namespaced key isolates the fork's behaviorOverrides, mastery
  //     streak, and keystone continuity from the curated row. Editing
  //     "Magnesium (yours)" no longer mutates the canonical magnesium-pm
  //     state shared by every other pack.
  //   - `derivedFrom` keeps the intelligence layer working: the engine's
  //     CONFLICT_PAIRS / RECOVERY_DEMOTE / CIRCADIAN / KEY_MESSAGE
  //     lookups go through effectiveKey() so a fork of "no-intense"
  //     still mutes strength training, a fork of "morning-sunlight"
  //     still gets the circadian-anchor tag, etc.
  // Net: the fork is a true independent copy that still participates
  // in the cross-pack adaptive intelligence.
  const copy: ProtocolPack = {
    ...source,
    id: newId,
    name: `${source.name} (yours)`,
    source: "custom",
    behaviors: source.behaviors.map((b) => ({
      ...b,
      canonicalKey: `fork:${newId}:${b.canonicalKey}`,
      derivedFrom: b.derivedFrom ?? b.canonicalKey,
    })),
  };
  const customPacks = [...state.customPacks, copy];
  const installedPacks = [
    ...state.installedPacks.filter((p) => p !== source.id),
    copy.id,
  ];
  return { ...state, customPacks, installedPacks };
}

// ── Biomarkers ────────────────────────────────────────────────────

export function addBiomarker(
  state: AppState,
  entry: Omit<BiomarkerEntry, "id">
): AppState {
  // A future-dated reading would sort as "latest" forever and poison
  // every band/insight that reads the most recent value — clamp it.
  const today = getDateString(undefined, getTz(state.settings));
  const e: BiomarkerEntry = {
    ...entry,
    date: entry.date && entry.date <= today ? entry.date : today,
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
  // Unified score: the behavior timeline is the product. The legacy
  // pillar model (calculateDailyScore) is retained only for the
  // pillarScores breakdown; it must never drive `score` or a check-in
  // would zero out a completed day.
  const score = computeBehaviorScore(
    state,
    log.date,
    log.behaviorCompletions ?? {}
  );

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
