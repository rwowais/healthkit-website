/**
 * Server-side Web Push helpers. Only ever imported from /api/push/*
 * route handlers (so the private VAPID key never ships to the client).
 *
 * Configuration:
 *   VAPID_PRIVATE_KEY        — private signing key (server-only)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — public key (also bundled client-side)
 *   VAPID_SUBJECT            — mailto: or https URL identifying the
 *                              app to push providers. Required.
 *
 * Generate the keypair once with `npx web-push generate-vapid-keys`
 * (or the script we ship in scripts/generate-vapid.mjs). Store both
 * in Vercel env vars and in .env.local.
 */
import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@protocolize.com";
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a single push. Returns { ok: true } on success; on failure
 * returns { ok: false, gone: true } if the subscription is gone (so
 * the caller can mark it disabled) or { ok: false, transient: true }
 * for network/temporary errors.
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; gone?: boolean; transient?: boolean; reason: string }> {
  configure();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 } // 1h — overdue reminders shouldn't pile up
    );
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    const code = err?.statusCode;
    const msg = err?.message ?? "push send failed";
    if (code === 404 || code === 410) {
      return { ok: false, gone: true, reason: msg };
    }
    return { ok: false, transient: true, reason: msg };
  }
}
