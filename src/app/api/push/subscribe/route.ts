/**
 * POST /api/push/subscribe
 *
 * Store or update a Web Push subscription row for the caller. Auth
 * via the caller's own Supabase access token in the Authorization
 * header; RLS handles the rest (own_user_id is the only row anyone
 * can write).
 *
 * Body: { endpoint, p256dh, auth, reminderTimes?, timezone?, userAgent? }
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

async function requireUser(req: Request) {
  if (!SB_URL || !SB_ANON) return null;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const sb = createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return null;
    return { uid: u.user.id, sb };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return json({ ok: false, reason: "Sign in required." }, 401);

  interface SubBody {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    reminderTimes?: string[];
    timezone?: string;
    userAgent?: string;
  }
  let body: SubBody;
  try {
    body = (await req.json()) as SubBody;
  } catch {
    return json({ ok: false, reason: "Invalid JSON." }, 400);
  }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return json({ ok: false, reason: "Missing subscription fields." }, 400);
  }

  // upsert by (user_id, endpoint) — re-subscribing on the same device
  // should refresh times/tz without creating a duplicate row.
  const { error } = await auth.sb
    .from("push_subscriptions")
    .upsert(
      {
        user_id: auth.uid,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        user_agent: body.userAgent ?? null,
        reminder_times: body.reminderTimes ?? [],
        timezone: body.timezone ?? null,
        disabled_at: null,
      },
      { onConflict: "user_id,endpoint" }
    );
  if (error) {
    console.error("[push:subscribe] upsert failed", error);
    return json({ ok: false, reason: error.message }, 500);
  }
  return json({ ok: true });
}
