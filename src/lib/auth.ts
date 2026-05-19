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

export { supabaseEnabled };
