/**
 * datasource.ts — persistence abstraction.
 *
 * The app talks to a DataSource, never to localStorage directly. This makes
 * the entire app Supabase-ready: when a Supabase project exists, implement
 * SupabaseDataSource (auth + row sync) and swap `activeDataSource` — no
 * screen or hook changes required.
 */
import type { AppState, DailyLog } from "./types";
import { loadState, saveState, SAVE_ERROR_EVENT } from "./storage";
import {
  markSaveStarted,
  markSaveSuccess,
  markSaveError,
  setRetryHandler,
} from "./sync";
import { STORAGE_KEY } from "./constants";
import {
  getSupabase,
  supabaseEnabled,
  STATE_TABLE,
  LOGS_TABLE,
  getUserId,
} from "./supabase";

export interface DataSource {
  readonly kind: "local" | "supabase";
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  /** Wipe the off-device copy (no-op for local). */
  /** Remove the user's cloud copy. Returns true if the cloud row is confirmed
   *  gone (or there is nothing to clear); false if the remote delete failed, so
   *  the caller must NOT wipe local + claim success (the data would resurrect). */
  clearRemote(): Promise<boolean>;
  /** True when this source persists off-device. */
  readonly isCloud: boolean;
}

class LocalDataSource implements DataSource {
  readonly kind = "local" as const;
  readonly isCloud = false;
  async load(): Promise<AppState> {
    return loadState();
  }
  async save(state: AppState): Promise<void> {
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

function hasMeaningfulData(s: AppState): boolean {
  return (
    (s.dailyLogs?.length ?? 0) > 0 ||
    (s.biomarkers?.length ?? 0) > 0 ||
    (s.customPacks?.length ?? 0) > 0
  );
}

function slicesDiffer(a: AppState, b: AppState): boolean {
  return (
    JSON.stringify(a.dailyLogs ?? []) !==
      JSON.stringify(b.dailyLogs ?? []) ||
    JSON.stringify(a.biomarkers ?? []) !==
      JSON.stringify(b.biomarkers ?? []) ||
    JSON.stringify([...(a.installedPacks ?? [])].sort()) !==
      JSON.stringify([...(b.installedPacks ?? [])].sort())
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
    swaps: { ...(a.swaps ?? {}), ...(b.swaps ?? {}) },
    swapAutoCompleted: {
      ...(a.swapAutoCompleted ?? {}),
      ...(b.swapAutoCompleted ?? {}),
    },
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
    },
    dailyLogs: [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    biomarkers: [...bm.values()],
    customPacks: [...customById.values()],
    installedPacks: uniq([
      ...(cloud.installedPacks ?? []),
      ...(local.installedPacks ?? []),
    ]),
    pausedPacks: uniq([
      ...(cloud.pausedPacks ?? []),
      ...(local.pausedPacks ?? []),
    ]),
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
    supplements: mergeById(cloud.supplements, local.supplements),
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

  async load(): Promise<AppState> {
    bindAuthReset();
    const sb = getSupabase();
    if (!sb) return loadState();
    try {
      const userId = await getUserId();
      if (!userId) return loadState();

      const { data } = await sb
        .from(STATE_TABLE)
        .select("state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

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
        if (typeof window !== "undefined") {
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
      markReconciled(userId); // this device is the source of truth here
      const local = loadState();
      const nowIso = new Date().toISOString();
      await sb.from(STATE_TABLE).upsert({
        user_id: userId,
        state: local,
        updated_at: nowIso,
      });
      lastCloudUpdatedAt =
        (await this.readStateUpdatedAt(sb, userId)) ?? nowIso;
      clearPendingSync(); // local is now mirrored to the cloud row
      return await this.reconcileLogs(sb, userId, local);
    } catch {
      return loadState(); // offline / transient → local cache
    }
  }

  async save(state: AppState): Promise<void> {
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
    markSaveStarted();
    try {
      const userId = await getUserId();
      if (!userId) {
        // Guest (no cloud row to be behind) — local is authoritative; the
        // first-sign-in path lifts it up wholesale later. Nothing pending.
        clearPendingSync();
        markSaveSuccess();
        return;
      }

      // Optimistic-concurrency guard: if another device wrote since we
      // last loaded, don't blindly clobber the whole document — pull the
      // newer copy and let the app resync instead of silently losing it.
      const { data: head } = await sb
        .from(STATE_TABLE)
        .select("updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (
        head?.updated_at &&
        lastCloudUpdatedAt &&
        head.updated_at > lastCloudUpdatedAt
      ) {
        // Another device is ahead — let other tabs resync to it.
        notify();
        return;
      }

      const nowIso = new Date().toISOString();
      const { error } = await sb.from(STATE_TABLE).upsert({
        user_id: userId,
        state,
        updated_at: nowIso,
      });
      if (error) throw error;
      // CRITICAL: the DB trigger rewrites updated_at with the *server*
      // clock. Baseline the concurrency guard off that server value, not
      // our client clock — otherwise any client/server skew makes the
      // next save mistake our own write for a remote one and silently
      // drop it (every change after the first is lost).
      lastCloudUpdatedAt =
        (await this.readStateUpdatedAt(sb, userId)) ?? nowIso;

      // Dual-write the changed day(s) to the per-day table. Best effort:
      // the document write above already succeeded and stays the safety
      // net through Phase 2, so a logs hiccup never surfaces an error.
      await this.writeChangedDays(sb, userId, state);

      // Notify other tabs ONLY after the cloud copy is durable, so a
      // resync never reads a pre-write row.
      notify();
      // Cloud copy matches local — clear the retry queue + the dirty flag.
      pendingCloudState = null;
      clearPendingSync();
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
      // Also clear the per-day rows (best effort; ignore if absent).
      this.lastDays.clear();
      try {
        await sb.from(LOGS_TABLE).delete().eq("user_id", userId);
      } catch {
        /* table may not exist yet — nothing to clear */
      }
      return true; // cloud row confirmed removed
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
