/**
 * datasource.ts — persistence abstraction.
 *
 * The app talks to a DataSource, never to localStorage directly. This makes
 * the entire app Supabase-ready: when a Supabase project exists, implement
 * SupabaseDataSource (auth + row sync) and swap `activeDataSource` — no
 * screen or hook changes required.
 */
import type { AppState, DailyLog } from "./types";
import {
  loadState,
  saveState,
  SAVE_ERROR_EVENT,
  captureResetEpoch,
  resetEpochMoved,
  deletionKey,
  TOMBSTONE_TTL_MS,
} from "./storage";
import { DEFAULT_INSTALLED } from "./packs";
import {
  markSaveStarted,
  markSaveSuccess,
  markSaveDeferred,
  markSaveError,
  setRetryHandler,
} from "./sync";
import { STORAGE_KEY } from "./constants";
import {
  getSupabase,
  supabaseEnabled,
  STATE_TABLE,
  LOGS_TABLE,
  ENTITLEMENTS_TABLE,
  getUserId,
} from "./supabase";
import { setEntitlement, getEntitlement, type Entitlement } from "./entitlements";

export interface DataSource {
  readonly kind: "local" | "supabase";
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  /** Wipe the off-device copy (no-op for local). */
  /** Remove the user's cloud copy. Returns true if the cloud row is confirmed
   *  gone (or there is nothing to clear); false if the remote delete failed, so
   *  the caller must NOT wipe local + claim success (the data would resurrect). */
  clearRemote(): Promise<boolean>;
  /**
   * Re-pull the server-authoritative entitlement WITHOUT a full state load.
   *
   * Exists for the post-checkout wait: the user returns from Stripe possibly
   * before the fulfillment webhook has written their row, so the UI polls this
   * until Premium appears. A full load() would work but re-downloads the whole
   * state document every two seconds and races the save path — this reads one
   * narrow row. Returns the fresh entitlement, or null when there is nothing
   * server-side to read (local mode).
   */
  refreshEntitlement(): Promise<Entitlement | null>;
  /** True when this source persists off-device. */
  readonly isCloud: boolean;
}

class LocalDataSource implements DataSource {
  readonly kind = "local" as const;
  readonly isCloud = false;
  async load(): Promise<AppState> {
    captureResetEpoch();
    return loadState();
  }
  async save(state: AppState): Promise<void> {
    // Reset-epoch fence: a wipe in another tab since we loaded → reload onto
    // fresh state rather than re-persisting this stale copy.
    if (resetEpochMoved()) {
      if (typeof window !== "undefined") {
        try {
          window.location.reload();
        } catch {
          /* test env */
        }
      }
      return;
    }
    saveState(state);
    // Notify other live hook instances (e.g. Today while Protocols saves)
    // so the app reacts immediately to protocol changes.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pz:state"));
    }
  }
  async clearRemote(): Promise<boolean> {
    /* nothing off-device — treat as already cleared */
    return true;
  }
  async refreshEntitlement(): Promise<Entitlement | null> {
    /* no server to ask — local mode can never be paid */
    return null;
  }
}

/** Event name other instances listen to for live state propagation. */
export const STATE_EVENT = "pz:state";

/** Fired when first sign-in finds both local data and a populated cloud row. */
export const CONFLICT_EVENT = "pz:sync-conflict";

let pendingConflict: { local: AppState; cloud: AppState } | null = null;
let conflictHandled = false;
/**
 * The conflict prompt is a *first-sign-in* event, not a per-load check.
 * `load()` runs on every focus/visibility/save resync, and local is
 * normally ahead of cloud in an offline-first app — that is NOT a
 * conflict. We evaluate it at most once per session and, durably, at
 * most once per (device, account) via a localStorage marker.
 */
let conflictEvaluated = false;
/** updated_at we last observed — used for optimistic concurrency. */
let lastCloudUpdatedAt: string | null = null;
/**
 * Most recent state attempted-to-save-to-cloud. When a save fails
 * (offline, transient 500, etc.) we leave the latest state here so
 * the retry handler (wired through lib/sync.ts on network-returns)
 * can re-attempt without needing the UI to fire another mutation.
 * Cleared on successful save.
 */
let pendingCloudState: AppState | null = null;
/** True once the retry handler has been registered (idempotent guard). */
let retryHandlerRegistered = false;

/**
 * Cloud-write serialization (audit REL-4, 2026-07-16).
 *
 * Nothing used to stop two saves being in flight at once: on a slow link the
 * debounce could flush save(v2) while save(v1) was still travelling, both would
 * pass the concurrency check, and the two upserts could land OUT OF ORDER —
 * leaving the cloud row holding v1 while local held v2. Because v2's save had
 * already reported success and cleared the dirty flag, the next clean load was
 * cloud-wins and silently REVERTED the user's newer edits.
 *
 * Every cloud write now queues on this chain, so at most one is in flight and
 * they land in the order they were made. `queuedSeq` additionally lets a save
 * that was superseded while waiting skip its upload entirely — the newer state
 * is a strict superset, so writing the older one first would be pure waste.
 */
let cloudChain: Promise<void> = Promise.resolve();
let queuedSeq = 0;

function reconKey(uid: string) {
  return `pz:recon:${uid}`;
}
function isReconciled(uid: string): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(reconKey(uid)) === "1"
    );
  } catch {
    return false;
  }
}
function markReconciled(uid: string): void {
  try {
    if (typeof window !== "undefined")
      localStorage.setItem(reconKey(uid), "1");
  } catch {
    /* non-fatal */
  }
}

/**
 * Persisted "local has edits not yet confirmed in the cloud STATE row" flag.
 * Set when a save writes locally; cleared only once the cloud upsert succeeds.
 * Survives reloads (unlike the in-memory `pendingCloudState`), so a load that
 * happens after an offline edit + reopen knows local is ahead and MERGES
 * local into cloud instead of letting cloud-wins silently discard the
 * un-pushed edits to non-log slices (settings / packs / overrides / …).
 * When clean (the normal case) load stays cloud-wins, so cross-device
 * deletions still propagate.
 */
const PENDING_SYNC_KEY = "pz:pending-sync";
function markPendingSync(): void {
  try {
    if (typeof window !== "undefined")
      localStorage.setItem(PENDING_SYNC_KEY, "1");
  } catch {
    /* non-fatal */
  }
}
function clearPendingSync(): void {
  try {
    if (typeof window !== "undefined")
      localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    /* non-fatal */
  }
}
function hasPendingSync(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(PENDING_SYNC_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/**
 * On any auth identity change (sign-out, or a *different* user signing
 * in on this device) the per-session sync singletons must reset, or the
 * conflict prompt can't re-evaluate for the new account and a stale
 * `updated_at` could clobber the new user's data. Subscribed once.
 */
let lastSeenUid: string | null = null;
let authResetBound = false;
function bindAuthReset() {
  if (authResetBound) return;
  const sb = getSupabase();
  if (!sb) return;
  authResetBound = true;
  sb.auth.onAuthStateChange((_e, session) => {
    const uid = session?.user?.id ?? null;
    if (uid !== lastSeenUid) {
      lastSeenUid = uid;
      conflictHandled = false;
      conflictEvaluated = false;
      pendingConflict = null;
      lastCloudUpdatedAt = null;
      // SEC-1: drop the previous user's paid entitlement on any auth switch /
      // sign-out so it can't linger onto a guest or a different account. The
      // following load() re-syncs it for whoever is now signed in.
      setEntitlement(null);
      // NOTE: deliberately do NOT clear the pending-sync flag here. This fires
      // on the initial null→uid transition for the SAME user on every page
      // load — clearing it would defeat the persisted flag before load() can
      // read it. A genuine different-user switch is already protected from
      // cross-account merges by the first-sign-in conflict gate + per-uid
      // reconciled marker below.
    }
  });
}

export function getPendingConflict() {
  return pendingConflict;
}

export function hasMeaningfulData(s: AppState): boolean {
  // installedPacks divergence from the pristine default seed IS meaningful
  // guest data: a guest who curated their packs (the core onboarding action,
  // or any Library install/remove) and then signs into a pre-existing account
  // must reach the conflict prompt instead of silently losing their pack set.
  // slicesDiffer() already compares installedPacks; without this the gate's
  // first operand (hasMeaningfulData) short-circuits false for a packs-only
  // guest and cloud silently wins (sweep 2026-06-09 HIGH #3).
  const packsCustomized =
    JSON.stringify([...(s.installedPacks ?? [])].sort()) !==
    JSON.stringify([...DEFAULT_INSTALLED].sort());
  return (
    (s.dailyLogs?.length ?? 0) > 0 ||
    (s.biomarkers?.length ?? 0) > 0 ||
    (s.customPacks?.length ?? 0) > 0 ||
    (s.supplements?.length ?? 0) > 0 ||
    Object.keys(s.behaviorOverrides ?? {}).length > 0 ||
    packsCustomized
  );
}

export function slicesDiffer(a: AppState, b: AppState): boolean {
  const j = (v: unknown) => JSON.stringify(v ?? null);
  return (
    j(a.dailyLogs ?? []) !== j(b.dailyLogs ?? []) ||
    j(a.biomarkers ?? []) !== j(b.biomarkers ?? []) ||
    j([...(a.installedPacks ?? [])].sort()) !==
      j([...(b.installedPacks ?? [])].sort()) ||
    // Config a guest may have customized that a silent cloud-wins would
    // otherwise discard on first sign-in (audit 2026-06-09 data-loss finding):
    // custom packs, their supplement stack, and per-behavior overrides. Any
    // divergence here now raises the conflict prompt instead of overwriting.
    j(a.customPacks ?? []) !== j(b.customPacks ?? []) ||
    j(a.supplements ?? []) !== j(b.supplements ?? []) ||
    j(a.behaviorOverrides ?? {}) !== j(b.behaviorOverrides ?? {})
  );
}

/** Non-destructive union of two states (keeps the most-progressed day). */
/**
 * Field-level merge of two logs for the SAME day (e.g. behaviors checked on
 * the phone + a reflection written on the desktop, both offline). The old
 * whole-object "higher completion count wins" pick discarded the loser's
 * fields entirely; this unions/keeps the richer value per field so nothing a
 * user recorded is lost. `b` is the more-recent-intent side (local).
 */
function mergeDailyLog(
  a: AppState["dailyLogs"][number],
  b: AppState["dailyLogs"][number]
): AppState["dailyLogs"][number] {
  const keys = (o?: Record<string, boolean>) => Object.keys(o ?? {});
  // Recency for GENUINE conflicts (same key true on one side, false on the
  // other): resolve by `updatedAt` only when BOTH logs carry a stamp; else
  // fall back to union (the proven legacy behavior). This is what lets a
  // behavior un-checked on a newer device stay un-checked instead of being
  // resurrected — without changing how existing un-stamped logs merge.
  const aT = a.updatedAt;
  const bT = b.updatedAt;
  const newer: "a" | "b" | null = aT && bT ? (bT >= aT ? "b" : "a") : null;
  const mergeCompletions = (
    x?: Record<string, boolean>,
    y?: Record<string, boolean>
  ): Record<string, boolean> => {
    const out: Record<string, boolean> = {};
    for (const k of new Set([...keys(x), ...keys(y)])) {
      const xv = x?.[k];
      const yv = y?.[k];
      if (xv === undefined) out[k] = !!yv; // only on the y side
      else if (yv === undefined) out[k] = !!xv; // only on the x side
      else if (newer === null)
        out[k] = !!(xv || yv); // no recency → union (legacy)
      else out[k] = newer === "b" ? !!yv : !!xv; // conflict → newer wins
    }
    return out;
  };
  // Merge two arrays of {itemId} entries BY id, so an entry the user recorded
  // on one device is never dropped because the other device's array happened
  // to have more "completed" rows (the old whole-array pick lost the loser's
  // distinct entries — e.g. a logged workout, a skip reason). Colliding ids
  // are reconciled by `combine`; a's order is preserved, b-only ids append.
  const mergeByItemId = <T extends { itemId: string }>(
    x: T[] | undefined,
    y: T[] | undefined,
    combine: (ax: T, by: T) => T
  ): T[] => {
    const out = new Map<string, T>();
    for (const e of x ?? []) out.set(e.itemId, e);
    for (const e of y ?? []) {
      const prev = out.get(e.itemId);
      out.set(e.itemId, prev ? combine(prev, e) : e);
    }
    return [...out.values()];
  };
  type ExEntry = AppState["dailyLogs"][number]["exerciseEntries"][number];
  type SupEntry = AppState["dailyLogs"][number]["supplementEntries"][number];
  type SleepC = AppState["dailyLogs"][number]["sleepCompletions"][number];
  type Scorecard = AppState["dailyLogs"][number]["nutritionScorecard"];
  // Exercise-entry richness: a completed entry dominates; ties break on how
  // much detail (duration / intensity / feeling / note) was filled in.
  const exRich = (e: ExEntry) =>
    (e.completed ? 8 : 0) +
    (e.durationMinutes != null ? 1 : 0) +
    (e.intensity != null ? 1 : 0) +
    (e.feeling != null ? 1 : 0) +
    (e.note && e.note.trim() ? 1 : 0);
  // Per-question field-merge of the nutrition scorecard (prefer the answered
  // side, prefer b/local on a tie) so two devices answering DIFFERENT
  // questions don't clobber each other; union custom items by label; keep a
  // written note rather than an empty one.
  const mergeScorecard = (ax?: Scorecard, by?: Scorecard): Scorecard => {
    if (!ax) return by as Scorecard;
    if (!by) return ax;
    const pick = <V,>(p: V, q: V): V => (q != null ? q : p);
    const custom = new Map<string, Scorecard["customItems"][number]>();
    for (const c of ax.customItems ?? []) custom.set(c.label, c);
    for (const c of by.customItems ?? []) {
      const prev = custom.get(c.label);
      custom.set(
        c.label,
        prev ? { label: c.label, answer: c.answer ?? prev.answer } : c
      );
    }
    return {
      hitProteinTarget: pick(ax.hitProteinTarget, by.hitProteinTarget),
      ateFruitsVeggies: pick(ax.ateFruitsVeggies, by.ateFruitsVeggies),
      stayedHydrated: pick(ax.stayedHydrated, by.stayedHydrated),
      avoidedProcessedSugar: pick(
        ax.avoidedProcessedSugar,
        by.avoidedProcessedSugar
      ),
      finishedEatingOnTime: pick(
        ax.finishedEatingOnTime,
        by.finishedEatingOnTime
      ),
      minimizedAlcohol: pick(ax.minimizedAlcohol, by.minimizedAlcohol),
      customItems: [...custom.values()],
      note: by.note && by.note.trim() ? by.note : ax.note,
    };
  };
  return {
    ...b,
    date: a.date,
    behaviorCompletions: mergeCompletions(
      a.behaviorCompletions,
      b.behaviorCompletions
    ),
    behaviorCompletionMinutes: {
      ...(a.behaviorCompletionMinutes ?? {}),
      ...(b.behaviorCompletionMinutes ?? {}),
    },
    supplementCompletions: mergeCompletions(
      a.supplementCompletions,
      b.supplementCompletions
    ),
    supplementSkips: Array.from(
      new Set([...(a.supplementSkips ?? []), ...(b.supplementSkips ?? [])])
    ),
    exerciseEntries: mergeByItemId<ExEntry>(
      a.exerciseEntries,
      b.exerciseEntries,
      (ax, by) => (exRich(by) >= exRich(ax) ? by : ax)
    ),
    sleepCompletions: mergeByItemId<SleepC>(
      a.sleepCompletions,
      b.sleepCompletions,
      (ax, by) => ({ itemId: ax.itemId, completed: !!(ax.completed || by.completed) })
    ),
    supplementEntries: mergeByItemId<SupEntry>(
      a.supplementEntries,
      b.supplementEntries,
      (ax, by) => {
        const taken = !!(ax.taken || by.taken);
        return {
          itemId: ax.itemId,
          taken,
          // taking it wins over a skip; only "skipped" when neither took it
          skipped: !taken && !!(ax.skipped || by.skipped),
          skipReason:
            by.skipReason && by.skipReason.trim()
              ? by.skipReason
              : ax.skipReason,
        };
      }
    ),
    nutritionScorecard: mergeScorecard(a.nutritionScorecard, b.nutritionScorecard),
    sleepLog: {
      actualBedtime: b.sleepLog?.actualBedtime ?? a.sleepLog?.actualBedtime ?? null,
      actualWakeTime: b.sleepLog?.actualWakeTime ?? a.sleepLog?.actualWakeTime ?? null,
      sleepQuality: b.sleepLog?.sleepQuality ?? a.sleepLog?.sleepQuality ?? null,
      sleepDurationMinutes:
        b.sleepLog?.sleepDurationMinutes ?? a.sleepLog?.sleepDurationMinutes ?? null,
    },
    energyLevel: b.energyLevel ?? a.energyLevel ?? null,
    moodLevel: b.moodLevel ?? a.moodLevel ?? null,
    // Free-text can't auto-merge cleanly; never silently drop typed content.
    // Two distinct non-empty notes (offline on both devices) → keep both
    // (local first); otherwise keep whichever side actually wrote something.
    dayNote: (() => {
      const an = a.dayNote?.trim() ?? "";
      const bn = b.dayNote?.trim() ?? "";
      if (an && bn && an !== bn) return `${bn}\n${an}`;
      return bn || an || "";
    })(),
    // Score follows the winning side's completions (so an un-check that lowers
    // the score propagates); only Math.max when recency is unknown — and a
    // later real mutation recomputes it from the merged completions anyway.
    score:
      newer === "a"
        ? a.score ?? 0
        : newer === "b"
          ? b.score ?? 0
          : Math.max(a.score ?? 0, b.score ?? 0),
    // Swaps are a per-day INTENT map where deletion (undo) matters as much
    // as insertion — a blind union resurrected an undone swap (and its
    // auto-completion) from any stale copy (audit round 2). When both logs
    // carry recency stamps, the newer side's whole map wins; un-stamped
    // legacy logs keep the union.
    swaps:
      newer === null
        ? { ...(a.swaps ?? {}), ...(b.swaps ?? {}) }
        : newer === "b"
          ? b.swaps
          : a.swaps,
    swapAutoCompleted:
      newer === null
        ? {
            ...(a.swapAutoCompleted ?? {}),
            ...(b.swapAutoCompleted ?? {}),
          }
        : newer === "b"
          ? b.swapAutoCompleted
          : a.swapAutoCompleted,
    snoozes: { ...(a.snoozes ?? {}), ...(b.snoozes ?? {}) },
    oneOffs: [
      ...(a.oneOffs ?? []),
      ...(b.oneOffs ?? []).filter(
        (o) => !(a.oneOffs ?? []).some((x) => x.key === o.key)
      ),
    ],
    // Carry the freshest stamp forward so the merged log keeps a true recency
    // for any subsequent merge.
    updatedAt: aT && bT ? (bT >= aT ? bT : aT) : bT ?? aT,
  };
}

export function mergeStates(local: AppState, cloud: AppState): AppState {
  // REL-9: union both sides' deletion tombstones, keeping the LATEST stamp per
  // key, and drop ones past their TTL so the map stays bounded. A key present
  // here means some device intentionally removed that item, which outranks
  // another device's stale copy that still contains it.
  const mergedDeletions: Record<string, number> = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  for (const src of [cloud.deletions, local.deletions]) {
    for (const [k, t] of Object.entries(src ?? {})) {
      if (typeof t !== "number" || t < cutoff) continue;
      if (!(k in mergedDeletions) || t > mergedDeletions[k]) {
        mergedDeletions[k] = t;
      }
    }
  }
  const tomb = new Set(Object.keys(mergedDeletions));

  const byDate = new Map<string, AppState["dailyLogs"][number]>();
  // cloud first, then local — so the local (more-recent-intent) side is `b`.
  for (const l of [...(cloud.dailyLogs ?? []), ...(local.dailyLogs ?? [])]) {
    const prev = byDate.get(l.date);
    byDate.set(l.date, prev ? mergeDailyLog(prev, l) : l);
  }
  const bm = new Map<string, AppState["biomarkers"][number]>();
  for (const b of [...(cloud.biomarkers ?? []), ...(local.biomarkers ?? [])])
    bm.set(b.id, b);
  const customById = new Map<string, AppState["customPacks"][number]>();
  for (const p of [
    ...(cloud.customPacks ?? []),
    ...(local.customPacks ?? []),
  ])
    customById.set(p.id, p);
  const uniq = (xs: string[]) => Array.from(new Set(xs));
  const laterIso = (x?: string, y?: string) =>
    !x ? y : !y ? x : new Date(x) > new Date(y) ? x : y;
  // By-id union for object arrays (outcome goals / experiments): keep every
  // entry from both devices; on id collision, the later-spread wins per-field
  // (so an achievedAt/concludedAt stamp set on either device survives). Same
  // pattern biomarkers + customPacks already use — without it, the bare
  // `...local.settings` spread would silently drop the other device's goals.
  const mergeById = <T extends { id: string }>(a?: T[], b?: T[]): T[] => {
    const m = new Map<string, T>();
    for (const x of [...(a ?? []), ...(b ?? [])])
      m.set(x.id, { ...m.get(x.id), ...x });
    return [...m.values()];
  };

  // Vacation periods are streak-protective: union by `start`; on a collision
  // prefer the CLOSED period (closing a vacation on one device must
  // propagate), else the later end (audit round 2 — the bare settings spread
  // discarded the other side's entire vacation history).
  const vpByStart = new Map<string, { start: string; end: string | null }>();
  for (const v of [
    ...(cloud.settings.vacationPeriods ?? []),
    ...(local.settings.vacationPeriods ?? []),
  ]) {
    const prev = vpByStart.get(v.start);
    if (!prev) vpByStart.set(v.start, v);
    else if (prev.end === null && v.end !== null) vpByStart.set(v.start, v);
    else if (prev.end !== null && v.end !== null && v.end > prev.end)
      vpByStart.set(v.start, v);
  }
  const mergedVacationPeriods = [...vpByStart.values()].sort((x, y) =>
    x.start.localeCompare(y.start)
  );
  return {
    ...cloud,
    settings: {
      ...cloud.settings,
      ...local.settings,
      completedOnboarding:
        cloud.settings.completedOnboarding ||
        local.settings.completedOnboarding,
      tier:
        cloud.settings.tier === "premium" ||
        local.settings.tier === "premium"
          ? "premium"
          : cloud.settings.tier,
      premiumTrialEndsAt: laterIso(
        cloud.settings.premiumTrialEndsAt,
        local.settings.premiumTrialEndsAt
      ),
      // One-shot guard: if EITHER device saw the trial extension, it happened.
      // Before this, trialExtendedAt rode the bare `...local.settings` spread
      // — the guard only survived because JSON drops absent keys, and a merge
      // path could erase it while laterIso kept the extended end date,
      // re-arming the "one-shot" extension (audit 2026-08-16 bug 6.9). Keep
      // the EARLIEST stamp: that's when the one extension actually fired.
      trialExtendedAt:
        cloud.settings.trialExtendedAt && local.settings.trialExtendedAt
          ? new Date(cloud.settings.trialExtendedAt) <
            new Date(local.settings.trialExtendedAt)
            ? cloud.settings.trialExtendedAt
            : local.settings.trialExtendedAt
          : cloud.settings.trialExtendedAt ?? local.settings.trialExtendedAt,
      // Append-only sets — union across devices so a rest day planned on one
      // device isn't lost, and a milestone already celebrated on either
      // device never re-fires after the merge.
      restDays: [
        ...new Set([
          ...(cloud.settings.restDays ?? []),
          ...(local.settings.restDays ?? []),
        ]),
      ],
      celebratedMilestones: [
        ...new Set([
          ...(cloud.settings.celebratedMilestones ?? []),
          ...(local.settings.celebratedMilestones ?? []),
        ]),
      ],
      // Spent freeze tokens are append-only + streak-protective exactly like
      // restDays — union them so a freeze spent on one device can't be lost
      // (which would silently break the protected day's streak on merge).
      usedFreezeDates: [
        ...new Set([
          ...(cloud.settings.usedFreezeDates ?? []),
          ...(local.settings.usedFreezeDates ?? []),
        ]),
      ],
      // Vacation periods are streak-protective exactly like restDays /
      // usedFreezeDates, but rode the bare settings spread — so whenever the
      // local side carried the key at all, the other side's entire vacation
      // history was discarded and the streak it protected collapsed across
      // those dates, account-wide (audit round 2). Union by `start`; on a
      // collision prefer the CLOSED period (closing a vacation on one device
      // must propagate), else the later end.
      vacationPeriods: mergedVacationPeriods,
      // Outcome goals + self-experiments: by-id union so neither device's
      // entries are dropped on the first cross-device merge.
      outcomeGoals: mergeById(
        cloud.settings.outcomeGoals,
        local.settings.outcomeGoals
      ),
      experiments: mergeById(
        cloud.settings.experiments,
        local.settings.experiments
      ),
      // vacationMode is derived truth: ON iff the RESOLVED union contains an
      // open (end === null) period — a vacation toggled on the phone must not
      // be silently switched off by a merge from a stale laptop, and a stale
      // open copy that lost its collision to a closed one must not keep the
      // mode on either.
      vacationMode: mergedVacationPeriods.some((v) => v.end === null),
    },
    dailyLogs: [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    // REL-9: the unions below would otherwise RESURRECT anything deleted on one
    // device from the other's stale copy — and then push it back up, making the
    // undo permanent account-wide. `tomb` is the union of both sides'
    // tombstones, so an intentional deletion outranks a stale copy that still
    // has the item. Re-adding clears the tombstone, so a genuine re-add wins.
    deletions: mergedDeletions,
    biomarkers: [...bm.values()].filter(
      (b) => !tomb.has(deletionKey("bio", b.id))
    ),
    customPacks: [...customById.values()].filter(
      (p) => !tomb.has(deletionKey("custom", p.id))
    ),
    installedPacks: uniq([
      ...(cloud.installedPacks ?? []),
      ...(local.installedPacks ?? []),
    ]).filter((id) => !tomb.has(deletionKey("pack", id))),
    pausedPacks: uniq([
      ...(cloud.pausedPacks ?? []),
      ...(local.pausedPacks ?? []),
    ]).filter((id) => !tomb.has(deletionKey("pack", id))),
    behaviorOverrides: {
      ...(cloud.behaviorOverrides ?? {}),
      ...(local.behaviorOverrides ?? {}),
    },
    // The dirty path is LOCAL-PREFERRING (preserve un-pushed local edits). These
    // slices were previously inherited from `...cloud` only, so an un-pushed
    // local supplement edit (add/remove/dose/inventory), supplementMeta or
    // legacy-protocol change was silently discarded — then pushed back up,
    // making the loss permanent across devices. Reconcile them too:
    //  • supplements: by-id union, local wins on collision (like biomarkers).
    //  • supplementMeta / protocols: shallow-merge with local winning per key.
    //  • insights: derived/recomputed → prefer the local (more-recent-intent) set.
    supplements: mergeById(cloud.supplements, local.supplements).filter(
      (s) => !tomb.has(deletionKey("supp", s.id))
    ),
    supplementMeta: { ...cloud.supplementMeta, ...local.supplementMeta },
    protocols: { ...cloud.protocols, ...local.protocols },
    insights: local.insights ?? cloud.insights,
  };
}

/**
 * Decide which state a cloud-present load should persist + normalize:
 *  - dirty (local has un-pushed edits): a local-preferring MERGE so those
 *    edits survive cloud-wins;
 *  - clean (the normal case): cloud verbatim (cloud-wins → cross-device
 *    deletions propagate).
 * Pure + exported so the load decision is unit-testable without a live
 * Supabase session (the I/O plumbing around it is generic Supabase calls).
 */
export function chooseCloudLoad(
  local: AppState,
  cloud: AppState,
  dirty: boolean
): AppState {
  return dirty ? mergeStates(local, cloud) : cloud;
}

/** Resolve a pending first-sign-in conflict; persists the chosen state. */
export async function resolveConflict(
  choice: "local" | "cloud" | "merge"
): Promise<void> {
  const pc = pendingConflict;
  if (!pc) return;
  conflictHandled = true;
  pendingConflict = null;
  // Durably mark this device reconciled with the account BEFORE the
  // post-resolve reload, so the fresh module load doesn't re-prompt.
  const uid = await getUserId();
  if (uid) markReconciled(uid);
  const chosen =
    choice === "cloud"
      ? pc.cloud
      : choice === "local"
      ? pc.local
      : mergeStates(pc.local, pc.cloud);
  // REL-7: "keep this device's data" must also discard the account's cloud-only
  // per-day rows, or the next load unions them back and the choice is undone.
  // Runs BEFORE the save so the write-cache is already pruned.
  if (choice === "local" && activeDataSource.kind === "supabase") {
    await (activeDataSource as SupabaseDataSource).dropCloudDaysNotIn(chosen);
  }
  await activeDataSource.save(chosen);
}

/**
 * Cloud sync. Reuses storage's normalize + migration by round-tripping
 * the cloud row through localStorage + loadState(). Safe-by-default:
 * - no session            → behaves exactly like local
 * - session, no cloud row → uploads local once (non-destructive migration)
 * - session, cloud row    → cloud wins (local becomes an offline cache)
 * Never deletes; tolerant of offline (local always written).
 */
class SupabaseDataSource implements DataSource {
  readonly kind = "supabase" as const;
  readonly isCloud = true;

  // ── Per-day log split (Phases 0–2) ────────────────────────────────
  // Document stays authoritative (dual-write); rows are read-merged so
  // we never show fewer days than the document. Feature-detected: if
  // `protocolize_logs` doesn't exist yet, every logs op is a no-op and
  // the app behaves exactly as the single-table model. Fully reversible.
  private logsOk: boolean | undefined; // undefined = unprobed
  private lastDays = new Map<string, string>(); // date -> JSON(day)

  private async readLogDays(
    sb: NonNullable<ReturnType<typeof getSupabase>>,
    userId: string
  ): Promise<DailyLog[] | null> {
    try {
      const { data, error } = await sb
        .from(LOGS_TABLE)
        .select("log")
        .eq("user_id", userId);
      if (error) {
        this.logsOk = false; // table missing / not migrated yet
        return null;
      }
      this.logsOk = true;
      return (data ?? []).map((r) => r.log as DailyLog);
    } catch {
      this.logsOk = false;
      return null;
    }
  }

  /**
   * Reconstruct dailyLogs from per-day rows, union with the document
   * (never lose a day), and backfill any document days missing from the
   * table without clobbering newer rows. Returns the base state
   * unchanged if the table isn't available.
   */
  /**
   * REL-7 (audit 2026-07-24): drop per-day rows the user just chose to discard.
   *
   * reconcileLogs() unions the log table into dailyLogs on EVERY load — a
   * deliberate never-lose-a-day rule. But when a sync conflict is resolved with
   * "keep this device's data", the discarded account's cloud-only days survived
   * in that table and were unioned straight back on the next load (which the
   * post-resolve reload triggers immediately), then synced back up. The explicit
   * choice was silently downgraded to a merge. Removing the rows the chosen
   * state doesn't contain makes "keep mine" mean what it says.
   *
   * Best effort: the document-level choice has already been applied, so a
   * failure here leaves days to reappear rather than losing anything.
   */
  async dropCloudDaysNotIn(chosen: AppState): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const userId = await getUserId();
      if (!userId) return;
      const keep = new Set((chosen.dailyLogs ?? []).map((l) => l.date));
      const { data, error } = await sb
        .from(LOGS_TABLE)
        .select("log_date")
        .eq("user_id", userId);
      if (error || !data) return;
      const drop = (data as { log_date: string }[])
        .map((r) => r.log_date)
        .filter((d) => !keep.has(d));
      if (drop.length === 0) return;
      const { error: delErr } = await sb
        .from(LOGS_TABLE)
        .delete()
        .eq("user_id", userId)
        .in("log_date", drop);
      if (delErr) return;
      // Forget them in the write-cache too, so a day later re-created with the
      // same date is recognised as changed and re-uploaded.
      for (const d of drop) this.lastDays.delete(d);
    } catch {
      /* best effort — see doc comment */
    }
  }

  private async reconcileLogs(
    sb: NonNullable<ReturnType<typeof getSupabase>>,
    userId: string,
    base: AppState
  ): Promise<AppState> {
    const rows = await this.readLogDays(sb, userId);
    if (rows === null) return base; // table absent → document-only

    const byDate = new Map<string, DailyLog>();
    for (const d of rows) if (d?.date) byDate.set(d.date, d);

    const docDays = base.dailyLogs ?? [];
    const missing: DailyLog[] = [];
    for (const d of docDays) {
      const row = byDate.get(d.date);
      if (row) {
        // Day present in BOTH the per-day table and the document: recency-merge
        // (mergeDailyLog) rather than letting the table row win verbatim — else
        // a freshly field-merged or newer local edit for that day is silently
        // discarded (defeating the whole per-log recency model). The doc day `d`
        // is the more-recent-intent side (wins genuine ties), matching the
        // local-preferring dirty-load path that produced it.
        byDate.set(d.date, mergeDailyLog(row, d));
      } else {
        byDate.set(d.date, d);
        missing.push(d);
      }
    }
    if (missing.length) {
      // Idempotent backfill: create-if-absent, never overwrite a row.
      try {
        await sb.from(LOGS_TABLE).upsert(
          missing.map((d) => ({
            user_id: userId,
            log_date: d.date,
            log: d,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,log_date", ignoreDuplicates: true }
        );
      } catch {
        /* best effort — document still authoritative */
      }
    }

    const merged = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    this.lastDays = new Map(
      merged.map((d) => [d.date, JSON.stringify(d)])
    );
    const result = { ...base, dailyLogs: merged };
    saveState(result); // keep the offline cache coherent
    return result;
  }

  /** Dual-write only the days that actually changed. */
  private async writeChangedDays(
    sb: NonNullable<ReturnType<typeof getSupabase>>,
    userId: string,
    state: AppState
  ): Promise<void> {
    if (this.logsOk === false) return;
    const changed: { user_id: string; log_date: string; log: DailyLog }[] =
      [];
    const next = new Map<string, string>();
    for (const d of state.dailyLogs ?? []) {
      const json = JSON.stringify(d);
      next.set(d.date, json);
      if (this.lastDays.get(d.date) !== json) {
        changed.push({ user_id: userId, log_date: d.date, log: d });
      }
    }
    if (!changed.length) {
      this.lastDays = next;
      return;
    }
    try {
      const stamped = changed.map((c) => ({
        ...c,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await sb
        .from(LOGS_TABLE)
        .upsert(stamped, { onConflict: "user_id,log_date" });
      if (error) {
        this.logsOk = false;
        return;
      }
      this.logsOk = true;
      this.lastDays = next;
    } catch {
      this.logsOk = false;
    }
  }

  /** The row's server-clock updated_at (post-trigger) — the only value
   *  safe to compare in the concurrency guard. */
  private async readStateUpdatedAt(
    sb: NonNullable<ReturnType<typeof getSupabase>>,
    userId: string
  ): Promise<string | null> {
    try {
      const { data } = await sb
        .from(STATE_TABLE)
        .select("updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.updated_at as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  // SEC-1: pull the server-authoritative entitlement and hand it to
  // entitlements.setEntitlement(). In cloud mode this ALWAYS sets a value (the
  // real row, or a synthesized 'free' for a signed-in user / guest with no
  // row) so getAccess() stops trusting the user-writable settings.tier. A live
  // read failure is left alone → the last-cached entitlement governs (offline).
  private async syncEntitlement(
    sb: NonNullable<ReturnType<typeof getSupabase>>,
    userId: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    if (!userId) {
      // Guest in cloud mode — never paid (premium comes from a row).
      setEntitlement({ paidTier: "free", status: "none", syncedAt: now });
      return;
    }
    const { data, error } = await sb
      .from(ENTITLEMENTS_TABLE)
      .select("paid_tier, status, plan, current_period_end, source")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return; // offline / transient → keep the last-cached entitlement
    setEntitlement({
      paidTier: data?.paid_tier === "premium" ? "premium" : "free",
      status: (data?.status as Entitlement["status"]) ?? "none",
      plan: (data?.plan as Entitlement["plan"]) ?? null,
      currentPeriodEnd: (data?.current_period_end as string | null) ?? null,
      source: (data?.source as Entitlement["source"]) ?? null,
      syncedAt: now,
    });
  }

  /**
   * Public one-row entitlement re-read (see DataSource.refreshEntitlement).
   * Used by the post-checkout wait, which polls until the Stripe webhook has
   * written the row. Errors are swallowed by syncEntitlement (treated as
   * offline), so a transient failure just means the next poll tries again.
   */
  async refreshEntitlement(): Promise<Entitlement | null> {
    const sb = getSupabase();
    if (!sb) return null;
    await this.syncEntitlement(sb, await getUserId());
    return getEntitlement();
  }

  async load(): Promise<AppState> {
    bindAuthReset();
    captureResetEpoch();
    const sb = getSupabase();
    if (!sb) return loadState();
    try {
      const userId = await getUserId();
      // Refresh the paid entitlement before any early return, so every load
      // path (guest, conflict-hold, cloud-wins) reflects the server's truth.
      await this.syncEntitlement(sb, userId);
      if (!userId) return loadState();

      // A first-sign-in conflict is already awaiting the user's choice in the
      // modal. A re-entrant load (focus / visibility / state event) must NOT
      // re-evaluate it: conflictEvaluated is already true, so it would fall
      // through to markReconciled + cloud-wins and silently discard the local
      // data the user is still deciding about. Hold local until resolveConflict
      // (or auth reset) clears pendingConflict.
      if (pendingConflict) return loadState();

      const { data, error } = await sb
        .from(STATE_TABLE)
        .select("state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      // CRITICAL: supabase-js does NOT throw on network failure — it resolves
      // { data: null, error }. Checking only `data` made a transient/offline
      // SELECT indistinguishable from "no cloud row", so execution fell into
      // the first-sign-in UPLOAD branch below: one flaky request wholesale-
      // overwrote the account's (possibly newer) cloud row with this device's
      // state and cleared the pending-sync dirty flag with nothing actually
      // verified (audit round 2, probe-proven). Any read error → behave
      // exactly like offline: serve the local cache, change nothing remote.
      if (error) return loadState();

      lastCloudUpdatedAt = data?.updated_at ?? null;

      if (data?.state) {
        const cloud = data.state as AppState;
        const local = loadState();
        // Genuine first-sign-in conflict ONLY: this device has guest
        // data, the account already has independent data, and we've
        // never reconciled this device with this account. Evaluated at
        // most once per session and once per (device, account) — local
        // simply being ahead of cloud is normal, not a conflict.
        const genuineFirstSignIn =
          !conflictHandled &&
          !conflictEvaluated &&
          !isReconciled(userId) &&
          hasMeaningfulData(local) &&
          slicesDiffer(local, cloud);
        conflictEvaluated = true;
        if (genuineFirstSignIn) {
          pendingConflict = { local, cloud };
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(CONFLICT_EVENT));
          }
          return local; // hold local until the user decides
        }
        // Established on this account/device — never prompt again here.
        markReconciled(userId);
        const dirty = hasPendingSync();
        // REL-8: honour the reset-epoch tombstone here too. This raw write is
        // the one storage path that bypassed the fence in saveState(): a load
        // already in flight when another tab ran reset / delete-account would
        // land the pre-wipe cloud payload straight back into storage, and for
        // delete-account (now signed out) the "deleted" data persisted on the
        // device. Discard the payload instead — the wipe wins.
        if (typeof window !== "undefined" && !resetEpochMoved()) {
          // dirty → local-preferring merge (un-pushed non-log edits survive);
          // clean → cloud-wins (cross-device deletions still propagate). See
          // chooseCloudLoad (pure + unit-tested). Logs reconcile separately.
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(chooseCloudLoad(local, cloud, dirty))
          );
        }
        const norm = loadState(); // normalizes + migrates the payload
        const reconciled = await this.reconcileLogs(sb, userId, norm);
        // If we merged un-pushed edits, push the result up so the cloud row
        // catches up and the dirty flag clears. Best effort: on failure the
        // flag stays set and the next load re-merges (idempotent) — the
        // merged local copy is never lost in the meantime.
        if (dirty) await this.save(reconciled);
        return reconciled;
      }

      // First sign-in on this account: lift local data up, don't wipe.
      conflictEvaluated = true;
      const local = loadState();
      const nowIso = new Date().toISOString();
      const { error: upErr } = await sb.from(STATE_TABLE).upsert({
        user_id: userId,
        state: local,
        updated_at: nowIso,
      });
      // Only mark this device reconciled / clear the dirty flag after a
      // CONFIRMED write — an errored upsert previously still burned the
      // first-sign-in conflict gate and dropped the pending-sync protection
      // with nothing uploaded (audit round 2).
      if (upErr) return local;
      markReconciled(userId); // this device is the source of truth here
      // If the head re-read fails, do NOT fall back to the client clock
      // (nowIso): a server-skewed head would then look "ahead" of our
      // client-clock baseline and the next save would mistake our own write for
      // a remote one and drop it — the exact skew this baseline exists to avoid.
      // Null disables the concurrency guard for one cycle (it requires a truthy
      // baseline), so the next save re-reads and re-baselines off the server.
      lastCloudUpdatedAt = await this.readStateUpdatedAt(sb, userId);
      clearPendingSync(); // local is now mirrored to the cloud row
      return await this.reconcileLogs(sb, userId, local);
    } catch {
      return loadState(); // offline / transient → local cache
    }
  }

  async save(state: AppState): Promise<void> {
    // Reset-epoch fence: a reset / delete-account ran in another tab since we
    // loaded. Persisting OR pushing this stale in-memory state would resurrect
    // the wiped data locally and in the cloud row. Discard it and reload onto
    // the fresh state — checked BEFORE saveState/markPendingSync/upsert so no
    // resurrection write or dirty flag is left behind.
    if (resetEpochMoved()) {
      if (typeof window !== "undefined") {
        try {
          window.location.reload();
        } catch {
          /* test env */
        }
      }
      return;
    }
    saveState(state); // offline-first cache
    // Mark local ahead of cloud until a push confirms. Persisted so a reload
    // before the push still knows to merge rather than be clobbered.
    markPendingSync();
    // Stash the most recent state in a module-level slot so the retry
    // handler (registered below) can re-attempt the cloud upsert
    // whenever the network comes back. Without this, an offline-edit
    // burst would never be propagated to the cloud — the user would
    // re-open the app on a new device and find their changes missing.
    pendingCloudState = state;
    const notify = () => {
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent(STATE_EVENT));
    };
    const sb = getSupabase();
    if (!sb) {
      notify();
      return;
    }
    // REL-4: queue the cloud half so concurrent saves can't interleave or land
    // out of order. The local cache above is already written synchronously, so
    // the UI never waits on this.
    const mySeq = ++queuedSeq;
    // Chain the CALL, not an already-running promise: invoking pushToCloud here
    // and merely appending the result would start every save immediately and
    // serialize nothing. Deferring the invocation into .then() is what makes
    // one write finish (and re-baseline) before the next begins.
    const run = cloudChain.then(() => this.pushToCloud(state, mySeq, notify));
    // Keep the chain alive if a link rejects — pushToCloud handles its own
    // errors, but an unhandled rejection here would stall every later save.
    cloudChain = run.catch(() => {});
    return run;
  }

  /** The serialized cloud half of save(). One of these runs at a time. */
  private async pushToCloud(
    state: AppState,
    seq: number,
    notify: () => void
  ): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    // Superseded while queued: a newer save carries strictly newer data, so
    // writing this older document first would be wasted work at best and an
    // out-of-order write at worst. The newer save owns the flags.
    if (seq !== queuedSeq) return;
    markSaveStarted();
    try {
      const userId = await getUserId();
      if (!userId) {
        // Guest (no cloud row to be behind) — local is authoritative; the
        // first-sign-in path lifts it up wholesale later. Nothing pending.
        clearPendingSync();
        markSaveSuccess();
        // Notify sibling useAppState instances in this tab so cross-component
        // live updates work for guests too (LocalDataSource always dispatches;
        // this branch must match it, else a Quick-Add doesn't reach the board
        // until refocus). Safe — no cloud row for a pre-write read to race.
        notify();
        return;
      }

      // Establish the row version this write is based on. Normally that's the
      // baseline stamped by our last load/save; only when we have none do we
      // pay for a head read.
      let baseline = lastCloudUpdatedAt;
      if (!baseline) {
        const { data: head, error: headErr } = await sb
          .from(STATE_TABLE)
          .select("updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        // REL-5: the error was previously ignored, so a transiently failed head
        // read silently bypassed the concurrency guard and blind-wrote the whole
        // document. Treat it like offline instead.
        if (headErr) throw headErr;
        baseline = head?.updated_at ?? null;
      }

      if (baseline) {
        // REL-5: compare-and-swap, not check-then-act. The old code read
        // updated_at and then upserted unconditionally — two devices saving
        // inside that round-trip window both passed the check and the second
        // replaced the first's whole document, silently losing its settings.
        // Matching updated_at in the WHERE makes the guard atomic: if the row
        // moved under us we write nothing and defer. (`updated_at` is rewritten
        // by a BEFORE UPDATE trigger, so the server clock stays authoritative;
        // timestamptz survives the text round-trip exactly, verified in prod.)
        const { data: rows, error } = await sb
          .from(STATE_TABLE)
          .update({ state })
          .eq("user_id", userId)
          .eq("updated_at", baseline)
          .select("user_id");
        if (error) throw error;
        if (!rows || rows.length === 0) {
          // Someone else wrote first. Local stays dirty (markPendingSync above)
          // so the next load merges and pushes it — nothing is lost.
          markSaveDeferred();
          notify();
          return;
        }
      } else {
        // No row yet — first write for this account. Insert rather than upsert
        // so a concurrent first-write surfaces as a duplicate-key conflict we
        // can defer on, instead of clobbering whatever landed first.
        const { error } = await sb
          .from(STATE_TABLE)
          .insert({ user_id: userId, state });
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            markSaveDeferred();
            notify();
            return;
          }
          throw error;
        }
      }
      // CRITICAL: the DB trigger rewrites updated_at with the *server*
      // clock, so re-read it rather than assuming what we wrote. Baselining off
      // a client clock would let any skew make the next save mistake our own
      // write for a remote one and drop it (every change after the first lost).
      // If this re-read fails we store null, which disables the compare-and-swap
      // for one cycle — the next save re-reads and re-baselines off the server.
      lastCloudUpdatedAt = await this.readStateUpdatedAt(sb, userId);

      // Dual-write the changed day(s) to the per-day table. Best effort:
      // the document write above already succeeded and stays the safety
      // net through Phase 2, so a logs hiccup never surfaces an error.
      await this.writeChangedDays(sb, userId, state);

      // Notify other tabs ONLY after the cloud copy is durable, so a
      // resync never reads a pre-write row.
      notify();
      // Cloud copy matches local — clear the retry queue + the dirty flag, but
      // ONLY if no newer save is waiting behind us. An older write completing
      // while a newer edit is still queued must not mark local "clean": a reload
      // in that window would take the cloud-wins path and revert the newer edit.
      if (seq === queuedSeq) {
        pendingCloudState = null;
        clearPendingSync();
      }
      markSaveSuccess();
    } catch {
      // Local cache still holds; tell the user the cloud copy is behind
      // rather than letting the failure pass invisibly. The sync state
      // machine in lib/sync.ts auto-retries when network returns.
      markSaveError();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SAVE_ERROR_EVENT, { detail: "cloud" })
        );
      }
    }
  }

  async clearRemote(): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return true; // no cloud configured — nothing to clear
    try {
      const userId = await getUserId();
      if (!userId) return true; // not signed in — no cloud row of ours
      // Drop the cloud row so a local reset isn't immediately
      // re-hydrated from the server on the next load.
      const { error } = await sb
        .from(STATE_TABLE)
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      lastCloudUpdatedAt = null;
      clearPendingSync(); // cloud row gone; nothing local to push up
      // Also clear the per-day rows. supabase-js reports failures via `error`
      // (it does NOT throw), so a swallowed try/catch here let a FAILED delete
      // report success — then reconcileLogs unions the surviving rows back on
      // the next load and the "permanently cleared" history resurrects. Read
      // the error and fail the whole clear on a real failure; a missing table
      // (42P01, older deployments) is genuinely nothing to clear.
      this.lastDays.clear();
      const { error: logsErr } = await sb
        .from(LOGS_TABLE)
        .delete()
        .eq("user_id", userId);
      if (logsErr && logsErr.code !== "42P01") throw logsErr;
      return true; // cloud row + per-day rows confirmed removed
    } catch {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SAVE_ERROR_EVENT, { detail: "cloud-clear" })
        );
      }
      return false; // delete failed — cloud row may survive; do NOT claim success
    }
  }
}

export const activeDataSource: DataSource = supabaseEnabled
  ? new SupabaseDataSource()
  : new LocalDataSource();

// Register the auto-retry handler exactly once. When network returns
// (or the tab becomes visible while pending work exists), this fires
// and re-attempts the most recent save. Idempotent — if there's
// nothing pending OR the data source isn't cloud-backed, it's a no-op.
if (!retryHandlerRegistered && supabaseEnabled) {
  retryHandlerRegistered = true;
  setRetryHandler(async () => {
    if (!pendingCloudState) return;
    const snapshot = pendingCloudState;
    try {
      await (activeDataSource as SupabaseDataSource).save(snapshot);
    } catch {
      /* save() already marks error + dispatches event; nothing more here */
    }
  });
}
