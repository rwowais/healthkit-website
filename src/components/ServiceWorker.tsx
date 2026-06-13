"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    let reloaded = false;
    // Whether the page was ALREADY controlled by a service worker when this
    // effect ran. On a brand-new install the page starts UNcontrolled, then
    // sw.js calls skipWaiting()+clients.claim(), which sets
    // navigator.serviceWorker.controller AND fires controllerchange — so the
    // controller is non-null inside the handler on first install too. The
    // old `!controller` guard could never tell first-install from an update,
    // so every first-time visitor got a jarring full-page reload seconds in.
    // wasControlled distinguishes them: only an UPDATE (page was controlled,
    // then a new worker takes over) should reload.
    const wasControlled = !!navigator.serviceWorker.controller;
    // When a new service worker takes control (new deploy), reload once
    // so the user is never stuck on a stale cached build. Guarded so it
    // can't loop and never fires on the very first install.
    const onControllerChange = () => {
      if (reloaded || !wasControlled) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    const t = setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});
          // Poll for updates when the app regains focus.
          window.addEventListener("focus", () => reg.update().catch(() => {}));
        })
        .catch(() => {});
    }, 1200);
    return () => {
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);
  return null;
}
