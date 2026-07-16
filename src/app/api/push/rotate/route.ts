/**
 * POST /api/push/rotate
 *
 * Background subscription rotation from the service worker's
 * `pushsubscriptionchange` handler. When a push service rotates or expires a
 * subscription, the SW re-subscribes and calls this route — but the SW has no
 * Supabase user token, so the row is matched by its OLD endpoint (an
 * unguessable push-service URL that already acts as a bearer secret). The
 * matched row's endpoint/keys are updated in place so reminders survive
 * rotation without waiting for the user to reopen the app.
 *
 * Body: { oldEndpoint, endpoint, p256dh, auth }
 *
 * Uses the service role because there is no caller identity to drive RLS; the
 * old endpoint is the only credential. Hardening (SEC-2): the new endpoint must
 * be on the SAME push service (origin) as the old, `disabled_at` is never
 * cleared here, and the response is uniform (no existence oracle). If the old
 * subscription was never stored (oldEndpoint missing/unknown) the request is a
 * no-op success — the foreground re-subscribe on next app open is the backstop.
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
    return json({ ok: true });
  }

  // HARDENING (audit SEC-2, 2026-07-16): this route is unauthenticated —
  // knowledge of a victim's push endpoint is the only "credential". Without
  // the constraint below, an attacker who learns that endpoint could redirect
  // the victim's reminders to an ATTACKER-controlled endpoint + keys. A genuine
  // `pushsubscriptionchange` re-subscribe always stays on the SAME push service
  // (fcm.googleapis.com / web.push.apple.com / *.mozilla.com), so require the
  // new endpoint's origin to equal the old one's. Reject cross-origin rotations.
  let sameService = false;
  try {
    const oldOrigin = new URL(body.oldEndpoint).origin;
    const newUrl = new URL(body.endpoint);
    sameService = newUrl.protocol === "https:" && newUrl.origin === oldOrigin;
  } catch {
    sameService = false;
  }
  if (!sameService) {
    return json({ ok: false, reason: "Endpoint origin mismatch." }, 400);
  }

  const sb = createClient(SB_URL, SB_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Update endpoint + keys in place. Deliberately do NOT clear `disabled_at`:
  // an unauthenticated call must not silently re-enable a subscription the
  // server disabled (e.g. after a 410). Re-enabling happens through the
  // authenticated foreground subscribe on next app open.
  const { error } = await sb
    .from("push_subscriptions")
    .update({
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
    })
    .eq("endpoint", body.oldEndpoint);
  if (error) {
    console.error("[push:rotate] update failed", error);
    return json({ ok: false, reason: "Rotation failed." }, 500);
  }
  // Uniform response — do NOT leak whether a row matched (would make this an
  // existence oracle for arbitrary push endpoints).
  return json({ ok: true });
}
