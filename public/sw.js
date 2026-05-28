/**
 * Protocolize service worker — offline-first.
 *
 * Caching strategy (chosen for "installable PWA that opens instantly"):
 *
 *  - App shell (HTML navigations, same-origin):
 *      stale-while-revalidate.
 *      Serve the cached version immediately, refresh the cache in the
 *      background. Net effect: launch feels instant even on flaky wifi,
 *      and new builds propagate on the next navigation.
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
const CACHE_VERSION = "v7";
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

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      // .addAll is atomic — if any URL fails the whole pre-warm fails.
      // Use individual catches so a missing route doesn't break the
      // whole install (Next.js dev builds sometimes lag a route).
      Promise.all(
        PRECACHE_SHELL.map((url) =>
          c.add(url).catch(() => {
            /* missing — fall back to runtime caching */
          })
        )
      )
    )
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

  // Everything else (HTML navigations, manifest, dynamic chunks):
  // stale-while-revalidate against the shell cache.
  e.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
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

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  // Always kick off a background refresh — but only commit the new
  // response to cache if it's actually OK (no 404/500 poisoning).
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (hit) return hit; // serve cached immediately, refresh in background
  const live = await refresh;
  if (live) return live;
  // Truly offline and never cached: serve the offline fallback for
  // HTML navigations so the user sees something branded.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    const fallback = await cache.match("/offline.html");
    if (fallback) return fallback;
  }
  return new Response("Offline", { status: 504, statusText: "Offline" });
}

// ── Push notifications ────────────────────────────────────────────

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Protocolize", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "Protocolize";
  const opts = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    tag: data.tag || "pz-reminder",
    data: { url: data.url || "/today" },
    renotify: false,
  };
  e.waitUntil(self.registration.showNotification(title, opts));
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
