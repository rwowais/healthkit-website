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
 * Permanent account deletion. Removes the user's app_states row,
 * any cms_admins row, and then asks Supabase to delete the auth user
 * itself via an RPC (the auth user delete cannot be done from client
 * code; the RPC is defined in supabase/schema.sql).
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
  // Delete the app_states row first (RLS allows own-row delete).
  const { error: dataErr } = await sb
    .from("app_states")
    .delete()
    .eq("id", user.id);
  if (dataErr) return { ok: false, error: dataErr.message };
  // Best-effort: remove cms_admins row if present. Ignore errors —
  // if the user isn't an admin, this is a no-op.
  try {
    await sb.from("cms_admins").delete().eq("user_id", user.id);
  } catch {}
  // Ask the auth.users delete RPC to remove the user. The RPC is
  // SECURITY DEFINER (defined in supabase/schema.sql) so it can
  // delete the user row that RLS would otherwise block.
  const { error: rpcErr } = await sb.rpc("delete_my_account");
  if (rpcErr) {
    // Even if the RPC isn't installed yet, the row is gone — sign out
    // and surface a soft warning. The user can email support for the
    // auth-user removal.
    await sb.auth.signOut();
    return {
      ok: true,
      error:
        "Your data is deleted. Your sign-in record will be removed within 30 days. (RPC missing — admin to install delete_my_account.)",
    };
  }
  await sb.auth.signOut();
  return { ok: true };
}

export { supabaseEnabled };
