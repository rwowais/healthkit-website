/**
 * supabase.ts — env-gated client.
 *
 * Entirely inert until BOTH NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set. With no env, `supabaseEnabled`
 * is false and the app runs exactly as before (LocalDataSource).
 *
 * The anon key is a public client key by design (it ships in the
 * browser bundle and is safe to expose). NEVER use the service_role key.
 */
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(URL && ANON);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client) {
    client = createClient(URL as string, ANON as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/** Row shape in the `protocolize_state` table. */
export const STATE_TABLE = "protocolize_state";
