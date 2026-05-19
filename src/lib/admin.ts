/**
 * admin.ts — internal admin gate for the Protocol Intelligence CMS.
 *
 * Access is an allowlist: a row in `cms_admins` keyed to the signed-in
 * Supabase user id. RLS ("admins self-read") lets a user read only
 * their own row, so this check needs no service key and is safe
 * client-side. Not an admin / not signed in / Supabase off → false.
 */
import { getSupabase, getUserId } from "./supabase";

export async function isAdmin(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const uid = await getUserId();
    if (!uid) return false;
    const { data, error } = await sb
      .from("cms_admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}
