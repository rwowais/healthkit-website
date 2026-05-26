// Protocolize service worker — offline app shell (network-first).
// Bump CACHE on any shipped change so stale clients (esp. iOS Safari /
// installed PWAs) purge old assets and pick up the new build.
const CACHE = "protocolize-v3";
const SHELL = ["/today"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Push event handler — fires when a Web Push arrives, even with the
 * tab closed (on iOS only when installed as a PWA, on every other
 * platform always). Without this handler, every push the server
 * sends would silently arrive and disappear.
 *
 * Payload shape (JSON): { title, body, url?, tag? }. Server defaults
 * the tag to "pz-reminder" so multiple reminders coalesce into one
 * notification slot instead of stacking.
 */
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
    icon: "/icon.svg",
    badge: "/icon.svg",
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
            // Honor the per-notification URL if the client is on a
            // different route — better than always re-anchoring to
            // /today regardless of context.
            if ("navigate" in c && url !== c.url) {
              try { c.navigate(url); } catch {}
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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith("http")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/today")))
  );
});
