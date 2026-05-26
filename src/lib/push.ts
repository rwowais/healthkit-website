/**
 * push.ts — client-side Web Push subscription helpers.
 *
 * Cross-platform notes (this is the part that's easy to get wrong):
 *   - iOS Safari: push works ONLY in installed PWAs (Add to Home
 *     Screen) on iOS 16.4+. In regular Safari tabs, the permission
 *     prompt itself is suppressed. The UI elsewhere has to be honest
 *     about this — "install to lock screen" not "enable reminders."
 *   - Android Chrome, desktop Chrome, Firefox, Edge: push works
 *     immediately after grant; no install required.
 *   - All platforms: subscriptions are tied to (origin, VAPID public
 *     key). If you rotate the VAPID public key, every existing
 *     subscription becomes invalid and the client must re-subscribe.
 *
 * The VAPID public key is intentionally bundled (it's public — the
 * matching private key stays server-side). If the env var is missing
 * at build time, push is silently disabled.
 */

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  return !!VAPID_PUBLIC_KEY;
}

/** True when the install-to-home-screen path is required (iOS). */
export function pushRequiresInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua);
  if (!ios) return false;
  // standalone === true when launched from Home Screen.
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches;
  return !standalone;
}

/**
 * Convert the URL-safe base64 VAPID public key into a Uint8Array, which
 * is what PushManager.subscribe wants. Standard Web Push boilerplate.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Subscribe this browser to push, then POST the subscription to our
 * /api/push/subscribe endpoint so the server can target it later.
 *
 * Returns true on success, false on any failure (permission denied,
 * VAPID misconfigured, server error). The caller surfaces a toast.
 */
export async function subscribeToPush(opts: {
  reminderTimes?: string[];
  timezone?: string;
}): Promise<boolean> {
  if (!pushAvailable()) return false;
  try {
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    } else if (Notification.permission !== "granted") {
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Cast to BufferSource via .buffer because TS's PushManager
      // typings expect ArrayBuffer not Uint8Array<ArrayBufferLike>.
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer as ArrayBuffer,
      });
    }
    const sJson = sub.toJSON();
    const body = {
      endpoint: sJson.endpoint,
      p256dh: sJson.keys?.p256dh,
      auth: sJson.keys?.auth,
      reminderTimes: opts.reminderTimes ?? [],
      timezone: opts.timezone,
      userAgent: navigator.userAgent.slice(0, 240),
    };
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      // Best-effort: keep the browser-level sub so retry later succeeds
      // without re-prompting the user.
      console.warn("[push] subscribe POST failed", await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[push] subscribe failed", e);
    return false;
  }
}

/**
 * Tear down the browser subscription AND remove the server row for
 * this device. Called when the user disables reminders.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Send a test push to the current user — useful from Profile. */
export async function sendTestPush(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  try {
    const r = await fetch("/api/push/test", { method: "POST" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, reason: text || `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Unknown error" };
  }
}
