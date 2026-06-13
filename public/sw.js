/**
 * Protocolize service worker — offline-first.
 *
 * Caching strategy (chosen for "installable PWA that opens instantly"):
 *
 *  - App shell (HTML navigations + RSC payloads, same-origin):
 *      network-first.
 *      Always fetch the live page when online, so a new deploy is seen
 *      immediately; fall back to the cached shell (then /offline.html)
 *      only when the network fails. Heavy assets stay cache-first
 *      (below) so launch is still fast — we just never serve a stale
 *      PAGE to an online user. (This replaced stale-while-revalidate,
 *      which served the old page first, so a route not re-visited since
 *      a deploy stayed stuck on the previous build.)
 *
 *  - Static assets (/_next/static/*, /icons/*, /splash/*, fonts):
 *      cache-first with long TTL.
 *      Next.js content-hashes these so any change ships a new URL.
 *      Old hashes are evicted via the version bump on activate.
 *
 *  - API routes (/api/*) and cross-origin (Supabase, Anthropic):
 *      network-only with no caching.
 *      Data writes must NEVER be served stale, and our /api/push/*
 *      and /api/cms/* routes have auth headers that cache servers
 *      mustn't fingerprint.
 *
 *  - Offline navigation fallback:
 *      when even the cached shell isn't available (e.g. truly first
 *      visit while offline), serve /offline.html — a tiny static page
 *      so the user gets something, not a Chrome dino.
 *
 * Cache versioning:
 *   Bump CACHE_VERSION on any shipped change you want clients to pick
 *   up aggressively. The activate handler deletes everything that
 *   isn't on the current version — purges stale Next chunks, prevents
 *   the iOS Safari "stuck on old build" failure mode.
 *
 *  Push notifications: see the push event handler below.
 */
// Bumped to v10 (network-first migration). In production this constant is
// stamped with the per-deploy git SHA by scripts/stamp-sw.mjs, so every
// deploy ships a distinct SW → old caches purge on activate → the
// controllerchange reload in ServiceWorker.tsx fires → users land on the
// new build automatically. Locally it stays "v10".
const CACHE_VERSION = "v10";

// VAPID public key for re-subscribing in the background (pushsubscriptionchange
// handler below). Stamped from NEXT_PUBLIC_VAPID_PUBLIC_KEY at build time by
// scripts/stamp-sw.mjs; left as the empty placeholder locally and when push
// isn't configured, in which case background re-subscribe is simply skipped.
const VAPID_PUBLIC_KEY = "__VAPID_PUBLIC_KEY__";
const SHELL_CACHE = `pz-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `pz-static-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];

// Routes we want to pre-warm so first launch from home screen is
// instant. /offline.html is the last-resort fallback when even the
// shell isn't reachable.
const PRECACHE_SHELL = [
  "/today",
  "/protocols",
  "/insights",
  "/library",
  "/biomarkers",
  "/profile",
  "/offline.html",
  "/manifest.webmanifest",
];

// Pull same-origin /_next/static asset URLs (scripts, CSS, preloads) out of a
// precached HTML document so we can cache them too. Without this the shell is
// HTML-only: after a deploy purges the previous STATIC_CACHE, an offline
// launch onto a route the user didn't re-visit online serves fresh HTML whose
// JS/CSS chunks are gone → a dead, unhydrated (and unstyled) skeleton. The
// pages are all "use client", so the chunks are what actually renders them.
function extractStaticAssets(html, baseUrl) {
  const urls = new Set();
  // src="..." / href="..." pointing at /_next/static/...
  const re = /(?:src|href)\s*=\s*["']([^"']*\/_next\/static\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.origin === self.location.origin) urls.add(u.pathname + u.search);
    } catch {
      /* malformed URL — skip */
    }
  }
  return [...urls];
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE_SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return; // missing — fall back to runtime caching
            await shell.put(url, res.clone());
            // Parse HTML documents for their hashed static assets and
            // precache them, so the route fully hydrates offline — not just
            // its bare HTML. (manifest/offline.html etc. aren't HTML pages
            // with chunk graphs, so this loop simply finds nothing for them.)
            const ct = res.headers.get("content-type") || "";
            if (!ct.includes("text/html")) return;
            const html = await res.text();
            const assets = extractStaticAssets(html, res.url || url);
            await Promise.all(
              assets.map(async (a) => {
                // Dedupe across routes — shared chunks are referenced by many
                // pages; only fetch each hashed asset once.
                if (await staticCache.match(a)) return;
                try {
                  const ar = await fetch(a);
                  if (ar.ok) await staticCache.put(a, ar.clone());
                } catch {
                  /* asset unreachable at install — runtime cache picks it up */
                }
              })
            );
          } catch {
            /* route unreachable at install — fall back to runtime caching */
          }
        })
      );
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !CURRENT_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch handler ─────────────────────────────────────────────────

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // POST/PUT/DELETE: pass through
  const url = new URL(req.url);

  // Cross-origin (Supabase, Anthropic, etc.): network-only.
  if (url.origin !== self.location.origin) return;

  // API routes: never cache. Auth headers + dynamic data.
  if (url.pathname.startsWith("/api/")) return;

  // Static assets — cache-first with background refresh on miss.
  // Includes Next.js hashed chunks (which never change for a given
  // URL) and our app icons / splash screens.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/splash/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf")
  ) {
    e.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Everything else (HTML navigations, RSC payloads, manifest):
  // network-first so an online user always gets the current deploy;
  // the cached shell + /offline.html are the offline fallback.
  e.respondWith(networkFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    // No cache, no network — return a generic 504 so the browser
    // doesn't render a broken image / hang the page.
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    // Cache successful GETs so the page is still available offline later.
    // Only commit OK responses (no 404/500 poisoning of the shell cache).
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    // Network failed (offline / flaky): serve the cached copy if we have
    // one — instant launch is preserved offline.
    const hit = await cache.match(req);
    if (hit) return hit;
    // Never cached either: branded offline page for navigations.
    if (
      req.mode === "navigate" ||
      req.headers.get("accept")?.includes("text/html")
    ) {
      const fallback = await cache.match("/offline.html");
      if (fallback) return fallback;
    }
    return new Response("Offline", { status: 504, statusText: "Offline" });
  }
}

// ── Push notifications ────────────────────────────────────────────

self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      // De-dupe with the in-tab path. When a tab is open AND visible, the
      // in-tab Reminders effect already fires a NAMED, per-behavior
      // notification at this minute; the generic server push uses a different
      // tag ("pz-reminder") so the OS would NOT collapse them — the user would
      // see two notifications (one specific, one generic). Defer to the in-tab
      // path whenever a visible client exists.
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      if (wins.some((c) => c.visibilityState === "visible" || c.focused)) return;

      let data = {};
      try {
        data = e.data ? e.data.json() : {};
      } catch {
        data = { title: "Protocolize", body: e.data ? e.data.text() : "" };
      }
      const title = data.title || "Protocolize";
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-96.png",
        tag: data.tag || "pz-reminder",
        data: { url: data.url || "/today" },
        renotify: false,
      });
    })()
  );
});

// Standard Web Push base64url → Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// pushsubscriptionchange: the push service rotated/expired this subscription
// (FCM rotation, iOS PWA expiry). Without this handler the SW can't re-subscribe
// in the background — the next cron send hits a 410, the server marks the row
// disabled_at, and reminders stay silently dead until the user reopens the app
// (the exact user background push exists for). Re-subscribe with the bundled
// VAPID key and hand the new endpoint to /api/push/rotate, keyed by the old
// endpoint (the SW has no user token, so the old endpoint is the identity).
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith("__")) return;
      const oldEndpoint =
        (e.oldSubscription && e.oldSubscription.endpoint) || null;
      try {
        // Prefer the browser-provided new subscription; otherwise re-subscribe.
        let sub = e.newSubscription || null;
        if (!sub) {
          const existing = await self.registration.pushManager.getSubscription();
          sub =
            existing ||
            (await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                .buffer,
            }));
        }
        if (!sub) return;
        const j = sub.toJSON();
        await fetch("/api/push/rotate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: j.endpoint,
            p256dh: j.keys && j.keys.p256dh,
            auth: j.keys && j.keys.auth,
          }),
        });
      } catch {
        /* best-effort — foreground re-subscribe on next app open is the backstop */
      }
    })()
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/today";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((cl) => {
        for (const c of cl) {
          if ("focus" in c) {
            if ("navigate" in c && url !== c.url) {
              try {
                c.navigate(url);
              } catch {}
            }
            return c.focus();
          }
        }
        return self.clients.openWindow
          ? self.clients.openWindow(url)
          : undefined;
      })
  );
});
