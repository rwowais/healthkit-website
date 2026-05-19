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
    // When a new service worker takes control (new deploy), reload once
    // so the user is never stuck on a stale cached build. Guarded so it
    // can't loop and never fires on the very first install.
    const onControllerChange = () => {
      if (reloaded || !navigator.serviceWorker.controller) return;
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
