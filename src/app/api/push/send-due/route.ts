/**
 * POST /api/push/send-due
 *
 * Cron-callable endpoint that walks push_subscriptions and sends a
 * reminder to every subscription whose reminder_times include the
 * current minute in that subscription's timezone.
 *
 * Auth: requires a static bearer in env `PUSH_CRON_SECRET`. The
 * Supabase pg_cron job sends this header. Anyone who doesn't have
 * the secret gets a 401 — so the only callers are the cron + the
 * owner manually testing with curl.
 *
 * Idempotency: a subscription is reminded at most once per minute
 * per call. If pg_cron fires every minute, each due reminder fires
 * exactly once. If for some reason a minute is skipped, that
 * minute's reminders don't fire (we don't try to "catch up" — too
 * easy to spam users on a misconfigured cron).
 *
 * Notes:
 *  - Uses the service role so we can read every active subscription
 *    regardless of RLS. The service role key MUST NOT ship to the
 *    client; it lives only in this server route.
 *  - The actual reminder content is calm and brand-agnostic on
 *    purpose — the per-behavior detail will come in Phase 3.7. For
 *    now, this is the "reminders fire reliably" foundation.
 */
import { createClient } from "@supabase/supabase-js";
import { sendPush, pushConfigured } from "@/lib/server/webPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.PUSH_CRON_SECRET;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface SubRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_times: string[] | null;
  timezone: string | null;
}

/** Returns "HH:MM" in the given tz for the supplied date. */
function hmInTz(tz: string, when: Date): string {
  try {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      f.formatToParts(when).map((p) => [p.type, p.value])
    );
    const h = parts.hour === "24" ? "00" : parts.hour;
    return `${h}:${parts.minute}`;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  if (!pushConfigured() || !SB_URL || !SB_SERVICE) {
    return json({ ok: false, reason: "Server not configured." }, 503);
  }
  if (!CRON_SECRET) {
    return json({ ok: false, reason: "Cron secret not set." }, 503);
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== CRON_SECRET) {
    return json({ ok: false, reason: "Unauthorized." }, 401);
  }

  const sb = createClient(SB_URL, SB_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull every active subscription that has at least one reminder time.
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,reminder_times,timezone")
    .is("disabled_at", null)
    .not("reminder_times", "is", null);
  if (error) {
    console.error("[push:send-due] select failed", error);
    return json({ ok: false, reason: error.message }, 500);
  }
  if (!subs || subs.length === 0) {
    return json({ ok: true, sent: 0, considered: 0 });
  }

  const now = new Date();
  const due: SubRow[] = [];
  for (const s of subs as SubRow[]) {
    const tz = s.timezone || "UTC";
    const hm = hmInTz(tz, now);
    const times = s.reminder_times ?? [];
    if (times.includes(hm)) due.push(s);
  }
  if (due.length === 0) {
    return json({ ok: true, sent: 0, considered: subs.length });
  }

  const results = await Promise.allSettled(
    due.map((s) =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "Protocolize",
          body: "Reminder — check Today for your next behavior.",
          tag: "pz-reminder",
          url: "/today",
        }
      )
    )
  );

  const goneIds: number[] = [];
  const okIds: number[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      if (r.value.ok) okIds.push(due[i].id);
      else if ("gone" in r.value && r.value.gone) goneIds.push(due[i].id);
    }
  }
  if (goneIds.length) {
    await sb
      .from("push_subscriptions")
      .update({ disabled_at: new Date().toISOString() })
      .in("id", goneIds);
  }
  if (okIds.length) {
    await sb
      .from("push_subscriptions")
      .update({ last_pinged_at: new Date().toISOString() })
      .in("id", okIds);
  }
  return json({
    ok: true,
    sent: okIds.length,
    gone: goneIds.length,
    considered: subs.length,
  });
}
