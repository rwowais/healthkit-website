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

/** Per-day log rows (config stays in STATE_TABLE). */
export const LOGS_TABLE = "protocolize_logs";

/**
 * Cached user id. `getSession()` is local (no network) so re-checking
 * when we don't have an id is cheap. CRITICAL: we only memoize a *known*
 * id — never a null. Caching null permanently meant a `getUserId()` call
 * made on /auth before sign-in poisoned the cache, so the post-sign-in
 * load() saw "no user", fell back to default local state, and routed an
 * existing user into onboarding (then looped back to login).
 */
let cachedUserId: string | null = null;
let authListenerBound = false;

export function invalidateUserId(): void {
  cachedUserId = null;
}

export async function getUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  if (!authListenerBound) {
    authListenerBound = true;
    sb.auth.onAuthStateChange((_e, s) => {
      cachedUserId = s?.user?.id ?? null;
    });
  }
  if (cachedUserId) return cachedUserId; // trust a known id
  // No id yet → re-resolve from the (local) session every time, so a
  // fresh sign-in is picked up immediately even before the auth event.
  const {
    data: { session },
  } = await sb.auth.getSession();
  cachedUserId = session?.user?.id ?? null;
  return cachedUserId;
}
