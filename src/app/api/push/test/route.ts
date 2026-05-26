/**
 * POST /api/push/test
 *
 * Send a test push to every subscription owned by the caller. Used
 * by the "Send a test reminder" button in Profile so the user can
 * verify their push setup works without waiting for a scheduled
 * reminder.
 */
import { createClient } from "@supabase/supabase-js";
import { sendPush, pushConfigured } from "@/lib/server/webPush";

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
  if (!pushConfigured()) {
    return json(
      { ok: false, reason: "Push is not configured on this server." },
      503
    );
  }
  if (!SB_URL || !SB_ANON)
    return json({ ok: false, reason: "Cloud not configured." }, 503);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ ok: false, reason: "Sign in required." }, 401);

  const sb = createClient(SB_URL, SB_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user) return json({ ok: false, reason: "Sign in required." }, 401);

  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", u.user.id)
    .is("disabled_at", null);
  if (error) return json({ ok: false, reason: error.message }, 500);
  if (!subs || subs.length === 0) {
    return json({ ok: false, reason: "No active subscriptions." }, 404);
  }

  const results = await Promise.allSettled(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "Protocolize",
          body: "Test reminder — you're all set.",
          tag: "pz-test",
          url: "/today",
        }
      )
    )
  );
  // Best-effort: mark gone subscriptions disabled so they don't keep
  // wasting cron cycles. Doesn't need to block the response.
  const goneEndpoints: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && !r.value.ok && "gone" in r.value && r.value.gone) {
      goneEndpoints.push(subs[i].endpoint);
    }
  }
  if (goneEndpoints.length) {
    await sb
      .from("push_subscriptions")
      .update({ disabled_at: new Date().toISOString() })
      .eq("user_id", u.user.id)
      .in("endpoint", goneEndpoints);
  }
  const okCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok
  ).length;
  return json({ ok: okCount > 0, sent: okCount, total: subs.length });
}
