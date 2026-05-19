/**
 * datasource.ts — persistence abstraction.
 *
 * The app talks to a DataSource, never to localStorage directly. This makes
 * the entire app Supabase-ready: when a Supabase project exists, implement
 * SupabaseDataSource (auth + row sync) and swap `activeDataSource` — no
 * screen or hook changes required.
 */
import type { AppState } from "./types";
import { loadState, saveState } from "./storage";
import { STORAGE_KEY } from "./constants";
import { getSupabase, supabaseEnabled, STATE_TABLE } from "./supabase";

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

  async load(): Promise<AppState> {
    const sb = getSupabase();
    if (!sb) return loadState();
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return loadState();

      const { data } = await sb
        .from(STATE_TABLE)
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.state) {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state));
        }
        return loadState(); // normalizes + migrates the cloud payload
      }

      // First sign-in on this account: lift local data up, don't wipe.
      const local = loadState();
      await sb.from(STATE_TABLE).upsert({
        user_id: user.id,
        state: local,
        updated_at: new Date().toISOString(),
      });
      return local;
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
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      await sb.from(STATE_TABLE).upsert({
        user_id: user.id,
        state,
        updated_at: new Date().toISOString(),
      });
    } catch {
      /* offline — local cache holds; will resync on next save */
    }
  }

  async clearRemote(): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      // Drop the cloud row so a local reset isn't immediately
      // re-hydrated from the server on the next load.
      await sb.from(STATE_TABLE).delete().eq("user_id", user.id);
    } catch {
      /* offline — best effort; local is already cleared */
    }
  }
}

export const activeDataSource: DataSource = supabaseEnabled
  ? new SupabaseDataSource()
  : new LocalDataSource();
