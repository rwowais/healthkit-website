/**
 * auth.ts — thin, friendly wrappers over Supabase Auth.
 *
 * Every function degrades gracefully when Supabase isn't configured
 * (returns a soft error) so the app never hard-crashes on the auth path.
 */
import { getSupabase, supabaseEnabled } from "./supabase";

export type AuthResult = { ok: boolean; error?: string; pending?: boolean };

function redirect(path = "/onboarding"): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${path}`;
}

const NOT_CONFIGURED =
  "Accounts aren't enabled yet. You can keep using the app — your data is saved on this device.";

export async function signUpEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    // Land on /today after confirming — the /today onboarding guard
    // sends genuinely-new users into onboarding, returning users skip it.
    options: { emailRedirectTo: redirect("/today") },
  });
  if (error) return { ok: false, error: error.message };
  // Email-confirmation on → no session yet.
  if (!data.session) return { ok: true, pending: true };
  return { ok: true };
}

export async function signInEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirect("/today") },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, pending: true };
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirect("/auth/reset"),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, pending: true };
}

export async function updatePassword(
  password: string
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInOAuth(
  provider: "google" | "apple"
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirect("/today") },
  });
  // On success the browser redirects away; an error means the provider
  // isn't configured in Supabase yet.
  if (error)
    return {
      ok: false,
      error:
        "That sign-in option isn't enabled yet. Try email for now.",
    };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/**
 * Permanent account deletion. Removes the user's own data rows, then
 * asks Supabase to delete the auth user itself via a SECURITY DEFINER
 * RPC (the auth user delete cannot be done from client code; the RPC
 * is defined in supabase/schema.sql).
 *
 * The data table is `protocolize_state` (keyed by `user_id`) — an
 * earlier rename from `app_states` left this path pointing at a table
 * that no longer exists, which silently broke deletion the moment cloud
 * sync was on. The pre-deletes below are best-effort (errors ignored):
 * deleting the auth user cascades `protocolize_state`, `protocolize_logs`
 * and `push_subscriptions` via their `on delete cascade` FKs, so the
 * RPC is the source of truth — these just keep the promise honest even
 * if the RPC is somehow unavailable.
 *
 * After cloud deletion succeeds, the caller is expected to clear
 * localStorage and redirect to the landing page.
 *
 * Returns { ok: true } even if Supabase isn't configured — in that
 * case there's nothing in the cloud to delete; just clear local.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "No active session." };
  // Delete the IDENTITY FIRST via the SECURITY DEFINER RPC (it can remove the
  // auth.users row that RLS would otherwise block). That delete cascades
  // protocolize_state / protocolize_logs / push_subscriptions / cms_admins via
  // their FK `on delete cascade`, so a success here means the identity AND all
  // owned data are gone together. This is the only ordering that can't strand a
  // live login pointing at a wiped account: we never destroy data before the
  // identity delete is confirmed.
  const { error: rpcErr } = await sb.rpc("delete_my_account");
  if (rpcErr) {
    // The identity could NOT be removed. Do NOT wipe the data rows and report
    // success — that would leave the user with a working login to an empty
    // account, told it was deleted. Leave their data untouched, keep the
    // session, and surface the failure honestly so they can retry / get help.
    return {
      ok: false,
      error:
        "We couldn't delete your account just now — nothing was removed. Please try again, or contact support if it keeps failing.",
    };
  }
  // Identity + data are gone. Clear the local session.
  await sb.auth.signOut();
  return { ok: true };
}

export { supabaseEnabled };
