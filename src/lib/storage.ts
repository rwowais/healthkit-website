import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./constants";
import { getTz, dayIndexOfKeyInTz, dateKeyInTz, nowMinutesInTz } from "./tz";
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
  getAccess,
  getFreeBiomarkers,
  getFreePacks,
} from "./entitlements";
import { resolveBehaviorByKey } from "./workouts";
import { activePacks } from "./knowledge";
import {
  applySwaps,
  injectOneOffs,
  applySnoozes,
  compileTimeline,
  shapeTimeline,
  adapt,
  masteredKeys,
} from "./engine";
import { keystone } from "./intel";
import type {
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
  // Walk activePacks() (which honors a published CMS bundle) so the
  // valid-key set matches what the engine actually compiles. Walking
  // PACKS alone would prune overrides keyed by bundle-only atoms.
  const installedSet = new Set(installedPacks);
  const validKeys = new Set<string>();
  for (const pack of [...activePacks(), ...customPacks]) {
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

  // ── Supplement separation ────────────────────────────────────────
  // Architectural decision: supplements are NEVER auto-installed by a
  // protocol pack. The user manages their stack manually via the
  // Supplements tab (Browse / Add custom). This protects the user
  // from us implicitly recommending specific compounds and keeps the
  // stack as a deliberate, user-curated set rather than a side-effect
  // of installing a behavioral pack. The pack still ships its
  // supplement atoms (they just stay hidden from the timeline via
  // engine.ts's isSupplementBehavior filter); they're available in
  // the Browse catalog the user can pull from when they want.
  //
  // Below: one-time legacy migration of `behaviorCompletions[supp-key]`
  // into `supplementCompletions[supp-key]` for users predating this
  // schema. After that runs, state.supplements is user-owned and we
  // make no further automatic edits to it here.
  const installedSetSupp = new Set(installedPacks);
  const activeForSync = activePacks();
  // Preserve every supplement the user has chosen — curated or custom.
  // Notably: we do NOT drop curated supplements whose origin pack is
  // uninstalled. If the user explicitly picked Magnesium from Browse,
  // it stays even if they later uninstall the sleep pack that first
  // surfaced it. Their stack, their rules.
  const priorSupplements: Supplement[] = Array.isArray(s.supplements)
    ? s.supplements
    : [];
  const nextSupplements: Supplement[] = [...priorSupplements];

  // Migrate completions: walk every daily log; for each
  // behaviorCompletions key that's a supplement, copy it into
  // supplementCompletions. Only runs the first time (gated on
  // supplementsMigratedAt) so we don't keep rewriting logs forever.
  const SUPPLEMENT_MIGRATION_VERSION = 1;
  const alreadyMigrated =
    (s.supplementsMigratedAt ?? 0) >= SUPPLEMENT_MIGRATION_VERSION;
  const rawLogs: DailyLog[] = Array.isArray(s.dailyLogs) ? s.dailyLogs : [];
  // Build a broader set of "supplement keys" that includes
  // CMS-renamed pills that escape the strict canonical-key registry.
  // We walk every installed pack's behaviors and flag any behavior
  // detected as a supplement by isSupplementBehavior (canonical key
  // + derivedFrom + icon + title regex). This way a published bundle
  // that ships `coq10` as `mag-supp` doesn't silently lose the
  // user's completion history when we migrate.
  const allSupplementKeysForMigration = new Set<string>(SUPPLEMENT_CANONICAL_KEYS);
  for (const p of activeForSync) {
    if (!installedSetSupp.has(p.id)) continue;
    for (const b of p.behaviors) {
      if (isSupplementBehavior(b)) allSupplementKeysForMigration.add(b.canonicalKey);
    }
  }
  const migratedLogs: DailyLog[] = alreadyMigrated
    ? rawLogs
    : rawLogs.map((l) => {
        const bc = l.behaviorCompletions ?? {};
        const existingSuppDone = l.supplementCompletions ?? {};
        const nextSuppDone: Record<string, boolean> = { ...existingSuppDone };
        for (const [key, done] of Object.entries(bc)) {
          if (!done) continue;
          if (allSupplementKeysForMigration.has(key)) {
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
    // NOTE: the persisted streak is kept verbatim here (recomputing it in
    // normalize() perturbs cloud-sync state comparison). Display surfaces
    // recompute a fresh value at render (Today + Insights) so a returning
    // user never SEES a stale streak.
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
  // Apply the day's workout swaps BEFORE shaping, so the scored active
  // set matches exactly what Today shows (a swap mutes the original and
  // counts the replacement). Without this, the stored score — which
  // feeds streak, weeklyReview, adapt and insights — disagreed with the
  // on-screen "Day complete" for any swapped day.
  const dayLog = state.dailyLogs.find((l) => l.date === date);
  const compiled = applySwaps(
    compileTimeline(state, isoDayIndex(state, date)),
    dayLog
  );
  const shaped = shapeTimeline(
    compiled,
    isToday ? adapt(state).mode : "normal",
    {
      keystoneKey: keystone(state)?.key,
      mastered: masteredKeys(state, date),
    }
  );
  // Match the EXACT list Today renders: inject one-offs and apply snoozes
  // after shaping, so the stored score (which feeds streak/weeklyReview/
  // adapt/insights) can't disagree with the on-screen "Day complete". A
  // one-off the user completed now counts; a behavior snoozed to tomorrow
  // leaves the denominator instead of dragging the score down.
  const planned = applySnoozes(injectOneOffs(shaped, dayLog), dayLog);
  const active = planned.filter((i) => !i.muted);
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

  // Smart-reminder learning: when a behavior is checked ON for *today*,
  // stamp the clock time so reminders can learn the user's real rhythm.
  // Only for today (a past-day toggle has no meaningful "now"); cleared on
  // un-check. Additive + lossless for older logs without the field.
  const tz = getTz(state.settings);
  let bcm = log.behaviorCompletionMinutes;
  if (date === dateKeyInTz(tz)) {
    bcm = { ...(log.behaviorCompletionMinutes ?? {}) };
    if (bc[key]) bcm[key] = Math.round(nowMinutesInTz(tz));
    else delete bcm[key];
  }

  const updated: DailyLog = {
    ...log,
    behaviorCompletions: bc,
    behaviorCompletionMinutes: bcm,
    score,
  };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];

  return {
    ...state,
    dailyLogs,
    // Pass vacation dates so the streak walks through them
    // transparently — matches the "your streak holds" Profile copy.
    currentStreak: calculateStreak(
      dailyLogs,
      getVacationDates(state),
      state.settings
    ),
  };
}

/**
 * Record a per-day behavior swap (e.g. user planned strength, did
 * yoga instead). The replacement (toKey) is auto-marked complete
 * in the same op so the user doesn't have to tap twice — the whole
 * point of swap is "I already did this." The original (fromKey) is
 * left in the log but the engine will render it as muted/replaced.
 *
 * Both keys flow through behaviorCompletions for accurate scoring:
 * the swap pair counts as one done item on the timeline (engine
 * removes the original from the timeline view, leaving only the
 * replacement). Mastery math ignores swapped items by design — a
 * one-off replacement shouldn't accumulate a streak it didn't earn.
 */
export function swapBehavior(
  state: AppState,
  date: string,
  fromKey: string,
  toKey: string
): AppState {
  if (fromKey === toKey) return state;
  // Validate both keys resolve to real behaviors. Without this,
  // calling swapBehavior(s, today, "zone2", "nonexistent-key-xyz")
  // would write the swap + auto-complete the phantom key, which
  // leaks into score and mastery downstream.
  if (!resolveBehaviorByKey(toKey)) return state;
  if (!resolveBehaviorByKey(fromKey)) return state;
  const log = getOrCreateLog(state, date);
  const swaps = { ...(log.swaps ?? {}), [fromKey]: toKey };
  const bc = { ...(log.behaviorCompletions ?? {}) };
  // Preserve any LEGITIMATE pre-existing completion of the
  // replacement (e.g. user did extended-walk at 7am normally, then
  // swapped strength → extended-walk at 5pm). The auto-complete is
  // only persisted if the replacement wasn't already done — and
  // clearSwap below mirrors this so undo doesn't erase the legit one.
  const replacementWasAlreadyDone = !!bc[toKey];
  bc[toKey] = true;
  // The original is no longer something they did/skipped — it's
  // replaced. Clear its completion bit so a previously-toggled
  // strength doesn't ghost as "done" while showing as muted.
  delete bc[fromKey];
  const score = computeBehaviorScore(state, date, bc);
  const updated: DailyLog = {
    ...log,
    swaps,
    behaviorCompletions: bc,
    score,
    // Track which keys were auto-completed by THIS swap (so
    // clearSwap can roll back surgically without erasing legit
    // completions). Encoded as a sidecar field on the log.
    swapAutoCompleted: {
      ...(log.swapAutoCompleted ?? {}),
      [fromKey]: replacementWasAlreadyDone ? false : true,
    },
  };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];
  return {
    ...state,
    dailyLogs,
    currentStreak: calculateStreak(
      dailyLogs,
      getVacationDates(state),
      state.settings
    ),
  };
}

/**
 * Undo a per-day swap. Removes the swap mapping AND the
 * auto-completed replacement (so the user isn't credited for a
 * workout they undid). The original behavior returns to the
 * timeline in its normal un-completed state.
 */
export function clearSwap(
  state: AppState,
  date: string,
  fromKey: string
): AppState {
  const log = state.dailyLogs.find((l) => l.date === date);
  if (!log || !log.swaps?.[fromKey]) return state;
  const toKey = log.swaps[fromKey];
  const swaps = { ...log.swaps };
  delete swaps[fromKey];
  const bc = { ...(log.behaviorCompletions ?? {}) };
  // Only delete the replacement's completion if THIS swap set it.
  // The swapAutoCompleted sidecar records that intent. If the
  // replacement was already legitimately completed before the swap
  // (e.g. user walked at 7am, then swapped strength→walk at 5pm),
  // leave the completion intact.
  const autoCompleted = log.swapAutoCompleted?.[fromKey] === true;
  if (autoCompleted) {
    delete bc[toKey];
  }
  const swapAutoCompleted = { ...(log.swapAutoCompleted ?? {}) };
  delete swapAutoCompleted[fromKey];
  const score = computeBehaviorScore(state, date, bc);
  const updated: DailyLog = {
    ...log,
    swaps: Object.keys(swaps).length > 0 ? swaps : undefined,
    behaviorCompletions: bc,
    score,
    swapAutoCompleted:
      Object.keys(swapAutoCompleted).length > 0
        ? swapAutoCompleted
        : undefined,
  };
  const dailyLogs = state.dailyLogs.map((l) =>
    l.date === date ? updated : l
  );
  return {
    ...state,
    dailyLogs,
    currentStreak: calculateStreak(
      dailyLogs,
      getVacationDates(state),
      state.settings
    ),
  };
}

// ── Per-day plan: one-offs + snoozes ──────────────────────────────

/** Add a behavior for TODAY only — not the installed protocol. */
export function addOneOff(
  state: AppState,
  date: string,
  def: NonNullable<DailyLog["oneOffs"]>[number]
): AppState {
  const log = getOrCreateLog(state, date);
  const oneOffs = [...(log.oneOffs ?? [])];
  if (oneOffs.some((o) => o.key === def.key)) return state; // dedupe
  oneOffs.push(def);
  return saveDailyLog(state, { ...log, oneOffs });
}

/** Remove a one-off and clear any completion bit it carried. */
export function removeOneOff(
  state: AppState,
  date: string,
  key: string
): AppState {
  const log = getOrCreateLog(state, date);
  if (!log.oneOffs?.length) return state;
  const oneOffs = log.oneOffs.filter((o) => o.key !== key);
  const bc = { ...(log.behaviorCompletions ?? {}) };
  delete bc[key];
  return saveDailyLog(state, {
    ...log,
    oneOffs: oneOffs.length ? oneOffs : undefined,
    behaviorCompletions: bc,
  });
}

/**
 * Snooze a behavior for today: "later" pushes it to the evening block,
 * "tomorrow" hides it from today (returns on its normal schedule). Pass
 * null to un-snooze.
 */
export function setSnooze(
  state: AppState,
  date: string,
  key: string,
  mode: "later" | "tomorrow" | null
): AppState {
  const log = getOrCreateLog(state, date);
  const snoozes = { ...(log.snoozes ?? {}) };
  if (mode == null) delete snoozes[key];
  else snoozes[key] = mode;
  return saveDailyLog(state, {
    ...log,
    snoozes: Object.keys(snoozes).length ? snoozes : undefined,
  });
}

// ── Vacation periods ──────────────────────────────────────────────

/**
 * Compute the full set of date keys (YYYY-MM-DD) the user has been
 * in vacation mode for. Walks settings.vacationPeriods, emitting
 * every day in each range (start..end inclusive). For an active
 * vacation (end === null), uses today (in the user's tz) as the
 * end. Used by every caller of calculateStreak so vacation days
 * are transparent in streak math.
 *
 * Returns a Set so consumers get O(1) membership checks during
 * the streak walk.
 */
export function getVacationDates(state: AppState): Set<string> {
  const out = new Set<string>();
  const periods = state.settings?.vacationPeriods ?? [];
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  for (const p of periods) {
    if (!p?.start) continue;
    const end = p.end ?? today;
    if (end < p.start) continue;
    let cursor = p.start;
    let safety = 0;
    while (cursor <= end && safety < 10_000) {
      out.add(cursor);
      // Step day-by-day using a tz-stable add. Could be slow for a
      // multi-year vacation but realistic ones are <30 days.
      const [y, m, d] = cursor.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      next.setUTCDate(next.getUTCDate() + 1);
      const yy = next.getUTCFullYear();
      const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(next.getUTCDate()).padStart(2, "0");
      cursor = `${yy}-${mm}-${dd}`;
      safety++;
    }
  }
  // Planned single rest days are transparent to the streak too — the user
  // deliberately took the day off, so a miss that day shouldn't break it.
  for (const day of state.settings?.restDays ?? []) {
    if (day) out.add(day);
  }
  // Streak-freeze tokens the user spent: transparent like a rest day, but
  // reactive ("protect today") rather than planned. Bridges a gap so the
  // streak survives a genuinely off day.
  for (const day of state.settings?.usedFreezeDates ?? []) {
    if (day) out.add(day);
  }
  return out;
}

/**
 * Spend a streak-freeze token to protect `dateKey` (idempotent — a day
 * already frozen is a no-op). The caller is responsible for checking
 * availability via freezeStatus(); this just records the spend. The frozen
 * day flows into getVacationDates, so the streak walks through it.
 */
export function useStreakFreeze(state: AppState, dateKey: string): AppState {
  const used = state.settings.usedFreezeDates ?? [];
  if (used.includes(dateKey)) return state;
  return {
    ...state,
    settings: { ...state.settings, usedFreezeDates: [...used, dateKey] },
  };
}

/**
 * Toggle vacation mode. On = pushes a new period with end=null;
 * off = sets end on the most-recent open period. Mutates the
 * settings + vacationStartedAt fields so existing surfaces that
 * read those still work.
 */
export function setVacationMode(state: AppState, on: boolean): AppState {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const periods = [...(state.settings.vacationPeriods ?? [])];
  if (on) {
    // Reuse an open period if one already exists (idempotent).
    const last = periods[periods.length - 1];
    if (!last || last.end !== null) {
      periods.push({ start: today, end: null });
    }
  } else {
    // Close the most recent open period.
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].end === null) {
        periods[i] = { ...periods[i], end: today };
        break;
      }
    }
  }
  return {
    ...state,
    settings: {
      ...state.settings,
      vacationMode: on,
      vacationStartedAt: on ? state.settings.vacationStartedAt ?? new Date().toISOString() : undefined,
      vacationPeriods: periods,
    },
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
      // Phantom-restock guard: never let an un-check increment the
      // count above what was decremented. If the count is already
      // 0 (depleted), an un-check shouldn't manufacture phantom
      // inventory. Only restore on un-check if the supplement was
      // ALSO just decremented from this toggle's predecessor (i.e.
      // count had headroom to grow back).
      const nextCount = Math.max(0, s.inventory.count + delta);
      // If we'd be restoring +1 but the current count is already at
      // or above what it would have been pre-decrement, no-op.
      // (Concretely: count=0 + delta=+1 → would become 1, but that
      // 1 is phantom because we never decremented from 1. Skip.)
      if (delta > 0 && s.inventory.count === 0) return s;
      return {
        ...s,
        inventory: {
          ...s.inventory,
          count: nextCount,
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

/**
 * Mark a set of supplements skipped (or un-skipped) for a given day.
 * Powers the "skip today" affordance on a block's stack so a day you're
 * deliberately not taking supplements can still close cleanly — without
 * recording them as taken. No inventory effect (a skip consumes
 * nothing). Idempotent and order-independent.
 */
export function setSupplementsSkipped(
  state: AppState,
  date: string,
  ids: string[],
  skipped: boolean
): AppState {
  if (ids.length === 0) return state;
  const log = getOrCreateLog(state, date);
  const next = new Set(log.supplementSkips ?? []);
  for (const id of ids) {
    if (skipped) next.add(id);
    else next.delete(id);
  }
  const updated: DailyLog = { ...log, supplementSkips: [...next] };
  const idx = state.dailyLogs.findIndex((l) => l.date === date);
  const dailyLogs =
    idx >= 0
      ? state.dailyLogs.map((l, i) => (i === idx ? updated : l))
      : [...state.dailyLogs, updated];
  return { ...state, dailyLogs };
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

/**
 * Remove a supplement by id. Preserves its completion history so
 * adherence stats (rate %, Insights signals, Adherence grid) stay
 * honest after the user pauses an item. Re-adding the same id will
 * surface the past data again — that's intentional. If you genuinely
 * want a clean slate, use the "reset data" flow in Profile.
 */
export function removeSupplement(state: AppState, id: string): AppState {
  const list = state.supplements ?? [];
  return {
    ...state,
    supplements: list.filter((s) => s.id !== id),
  };
}

export function installPack(state: AppState, id: string): AppState {
  if (state.installedPacks.includes(id)) return state;
  // Free-tier cap: max getFreePacks() OFFICIAL packs. Custom packs
  // don't count (they're user-authored, not a feature of the
  // catalog), so this matches the gate the Library UI applies.
  // Without this check, any non-UI code path (cloud sync, import,
  // future API) could bypass the cap.
  if (!getAccess(state).premium) {
    const pack = PACKS.find((p) => p.id === id);
    const isOfficial = pack?.source === "official";
    if (isOfficial) {
      const officialInstalled = state.installedPacks.filter((pid) =>
        PACKS.some((p) => p.id === pid && p.source === "official")
      ).length;
      if (officialInstalled >= getFreePacks()) return state;
    }
  }
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
  // Free-tier cap: getFreeBiomarkers() distinct metrics. Re-adding a
  // reading for a metric already tracked is fine (it's just another
  // data point on an existing metric); adding a NEW distinct metric
  // above the cap is the case the UI blocks. Enforce it here too so
  // non-UI code paths (cloud sync, import, future API) can't bypass.
  if (!getAccess(state).premium) {
    const distinctMetrics = new Set(
      (state.biomarkers ?? []).map((b) => b.metric)
    );
    if (
      !distinctMetrics.has(entry.metric) &&
      distinctMetrics.size >= getFreeBiomarkers()
    ) {
      return state;
    }
  }
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

  const currentStreak = calculateStreak(
    dailyLogs,
    getVacationDates(state),
    state.settings
  );
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
  updates: { energy?: number; mood?: number; note?: string }
): AppState {
  const log = getOrCreateLog(state, date);
  const updatedLog = {
    ...log,
    ...(updates.energy !== undefined && { energyLevel: updates.energy }),
    ...(updates.mood !== undefined && { moodLevel: updates.mood }),
    ...(updates.note !== undefined && { dayNote: updates.note }),
  };
  return saveDailyLog(state, updatedLog);
}
