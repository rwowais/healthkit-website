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
  clearRemote(): Promise<void>;
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
  async clearRemote(): Promise<void> {
    /* nothing off-device */
  }
}

/** Event name other instances listen to for live state propagation. */
export const STATE_EVENT = "pz:state";

/** Fired when first sign-in finds both local data and a populated cloud row. */
export const CONFLICT_EVENT = "pz:sync-conflict";

let pendingConflict: { local: AppState; cloud: AppState } | null = null;
let conflictHandled = false;
/** updated_at we last observed — used for optimistic concurrency. */
let lastCloudUpdatedAt: string | null = null;

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
function mergeStates(local: AppState, cloud: AppState): AppState {
  const byDate = new Map<string, AppState["dailyLogs"][number]>();
  const score = (l: AppState["dailyLogs"][number]) =>
    Object.values(l.behaviorCompletions ?? {}).filter(Boolean).length * 1000 +
    (l.score ?? 0);
  for (const l of [...(cloud.dailyLogs ?? []), ...(local.dailyLogs ?? [])]) {
    const prev = byDate.get(l.date);
    if (!prev || score(l) >= score(prev)) byDate.set(l.date, l);
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
  };
}

/** Resolve a pending first-sign-in conflict; persists the chosen state. */
export async function resolveConflict(
  choice: "local" | "cloud" | "merge"
): Promise<void> {
  const pc = pendingConflict;
  if (!pc) return;
  conflictHandled = true;
  pendingConflict = null;
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
      if (!byDate.has(d.date)) {
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

  async load(): Promise<AppState> {
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
        // Don't silently let "cloud win" and erase guest progress — if
        // this device has real data that differs from the account's,
        // ask the user (keep / use account / merge) instead.
        if (
          !conflictHandled &&
          hasMeaningfulData(local) &&
          slicesDiffer(local, cloud)
        ) {
          pendingConflict = { local, cloud };
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(CONFLICT_EVENT));
          }
          return local; // hold local until the user decides
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        }
        const norm = loadState(); // normalizes + migrates the cloud payload
        return await this.reconcileLogs(sb, userId, norm);
      }

      // First sign-in on this account: lift local data up, don't wipe.
      const local = loadState();
      const nowIso = new Date().toISOString();
      await sb.from(STATE_TABLE).upsert({
        user_id: userId,
        state: local,
        updated_at: nowIso,
      });
      lastCloudUpdatedAt = nowIso;
      return await this.reconcileLogs(sb, userId, local);
    } catch {
      return loadState(); // offline / transient → local cache
    }
  }

  async save(state: AppState): Promise<void> {
    saveState(state); // offline-first cache + same-tab notify
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(STATE_EVENT));
    }
    const sb = getSupabase();
    if (!sb) return;
    try {
      const userId = await getUserId();
      if (!userId) return;

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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(STATE_EVENT));
        }
        return;
      }

      const nowIso = new Date().toISOString();
      const { error } = await sb.from(STATE_TABLE).upsert({
        user_id: userId,
        state,
        updated_at: nowIso,
      });
      if (error) throw error;
      lastCloudUpdatedAt = nowIso;

      // Dual-write the changed day(s) to the per-day table. Best effort:
      // the document write above already succeeded and stays the safety
      // net through Phase 2, so a logs hiccup never surfaces an error.
      await this.writeChangedDays(sb, userId, state);
    } catch {
      // Local cache still holds; tell the user the cloud copy is behind
      // rather than letting the failure pass invisibly.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SAVE_ERROR_EVENT, { detail: "cloud" })
        );
      }
    }
  }

  async clearRemote(): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const userId = await getUserId();
      if (!userId) return;
      // Drop the cloud row so a local reset isn't immediately
      // re-hydrated from the server on the next load.
      const { error } = await sb
        .from(STATE_TABLE)
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      lastCloudUpdatedAt = null;
      // Also clear the per-day rows (best effort; ignore if absent).
      this.lastDays.clear();
      try {
        await sb.from(LOGS_TABLE).delete().eq("user_id", userId);
      } catch {
        /* table may not exist yet — nothing to clear */
      }
    } catch {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SAVE_ERROR_EVENT, { detail: "cloud-clear" })
        );
      }
    }
  }
}

export const activeDataSource: DataSource = supabaseEnabled
  ? new SupabaseDataSource()
  : new LocalDataSource();
