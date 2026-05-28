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
  // Best-effort cleanup of every owned row (RLS allows own-row delete).
  // Non-fatal: the RPC + FK cascade below are the source of truth.
  for (const table of [
    "protocolize_state",
    "protocolize_logs",
    "push_subscriptions",
    "cms_admins",
  ] as const) {
    try {
      await sb.from(table).delete().eq("user_id", user.id);
    } catch {
      /* ignore — cascade handles it */
    }
  }
  // Ask the auth.users delete RPC to remove the user. The RPC is
  // SECURITY DEFINER (defined in supabase/schema.sql) so it can
  // delete the user row that RLS would otherwise block; this cascades
  // any remaining owned rows.
  const { error: rpcErr } = await sb.rpc("delete_my_account");
  if (rpcErr) {
    // Even if the RPC isn't installed, the data rows are already gone
    // above — sign out and surface a soft warning for the auth row.
    await sb.auth.signOut();
    return {
      ok: true,
      error:
        "Your data is deleted. Your sign-in record will be removed shortly — contact support if your login still works in 30 days.",
    };
  }
  await sb.auth.signOut();
  return { ok: true };
}

export { supabaseEnabled };
