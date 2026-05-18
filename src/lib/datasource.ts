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

export interface DataSource {
  readonly kind: "local" | "supabase";
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
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
  }
}

/**
 * Placeholder for the future cloud implementation. Intentionally inert
 * until a Supabase project + keys are provided by the account owner.
 *
 * class SupabaseDataSource implements DataSource {
 *   readonly kind = "supabase";
 *   readonly isCloud = true;
 *   // auth(), load() from `protocolize_state` row, save() upsert, realtime
 * }
 */

export const activeDataSource: DataSource = new LocalDataSource();
