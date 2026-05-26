/**
 * POST /api/push/unsubscribe
 *
 * Delete the caller's subscription row for the given endpoint. RLS
 * ensures users can only delete their own.
 *
 * Body: { endpoint }
 */
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!SB_URL || !SB_ANON) return json({ ok: false }, 200);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ ok: false, reason: "Sign in required." }, 401);

  interface UnsubBody { endpoint?: string }
  let body: UnsubBody;
  try {
    body = (await req.json()) as UnsubBody;
  } catch {
    return json({ ok: false, reason: "Invalid JSON." }, 400);
  }
  if (!body.endpoint) return json({ ok: false, reason: "No endpoint." }, 400);

  try {
    const sb = createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ ok: false, reason: "Sign in required." }, 401);
    const { error } = await sb
      .from("push_subscriptions")
      .delete()
      .eq("user_id", u.user.id)
      .eq("endpoint", body.endpoint);
    if (error) return json({ ok: false, reason: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json(
      { ok: false, reason: e instanceof Error ? e.message : "Failed." },
      500
    );
  }
}
