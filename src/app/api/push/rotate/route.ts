/**
 * POST /api/push/rotate
 *
 * Background subscription rotation from the service worker's
 * `pushsubscriptionchange` handler. When a push service rotates or expires a
 * subscription, the SW re-subscribes and calls this route — but the SW has no
 * Supabase user token, so the row is matched by its OLD endpoint (an
 * unguessable push-service URL that already acts as a bearer secret). The
 * matched row's endpoint/keys are updated in place and `disabled_at` cleared,
 * so reminders survive rotation without waiting for the user to reopen the app.
 *
 * Body: { oldEndpoint, endpoint, p256dh, auth }
 *
 * Uses the service role because there is no caller identity to drive RLS; the
 * old endpoint is the only credential. If the old subscription was never stored
 * (oldEndpoint missing/unknown) the request is a no-op success — the foreground
 * re-subscribe on next app open is the backstop.
 */
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!SB_URL || !SB_SERVICE) {
    return json({ ok: false, reason: "Push not configured." }, 503);
  }

  interface RotateBody {
    oldEndpoint?: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  }
  let body: RotateBody;
  try {
    body = (await req.json()) as RotateBody;
  } catch {
    return json({ ok: false, reason: "Invalid JSON." }, 400);
  }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return json({ ok: false, reason: "Missing subscription fields." }, 400);
  }
  // No prior endpoint to match — nothing to rotate. Treat as a no-op so the
  // SW doesn't retry; the next foreground subscribe will (re)create the row.
  if (!body.oldEndpoint) {
    return json({ ok: true, rotated: false });
  }

  const sb = createClient(SB_URL, SB_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb
    .from("push_subscriptions")
    .update({
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      disabled_at: null,
    })
    .eq("endpoint", body.oldEndpoint)
    .select("id");
  if (error) {
    console.error("[push:rotate] update failed", error);
    return json({ ok: false, reason: error.message }, 500);
  }
  return json({ ok: true, rotated: (data?.length ?? 0) > 0 });
}
