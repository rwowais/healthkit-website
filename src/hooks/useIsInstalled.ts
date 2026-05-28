"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the app is currently running as an installed PWA
 * (i.e. launched from the home screen / dock, not from a browser tab).
 *
 * Detection covers both standards:
 *   - `(display-mode: standalone)` — the cross-browser modern way
 *   - `navigator.standalone` — iOS Safari's legacy way (still works,
 *     not part of the official standard)
 *
 * Why this matters:
 *   - The install prompt itself should never show to installed users.
 *   - Reminders / notifications behave differently when launched
 *     standalone vs in a browser tab (iOS specifically only delivers
 *     Web Push to installed PWAs).
 *   - Layout adjustments — installed mode has more screen real estate
 *     since there's no browser chrome — we can lean into it.
 */
export type InstallState = "installed" | "browser" | "unknown";

export function useIsInstalled(): InstallState {
  const [state, setState] = useState<InstallState>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detect = (): InstallState => {
      try {
        // Modern path: media query exposed on every browser worth
        // supporting. Returns true when the app is launched
        // standalone via the install path.
        const mql = window.matchMedia("(display-mode: standalone)");
        if (mql.matches) return "installed";
        // iOS Safari quirk: standalone is a boolean on navigator
        // and isn't covered by the media query in older Safari
        // versions. Belt-and-suspenders check.
        const navStandalone = (
          window.navigator as unknown as { standalone?: boolean }
        ).standalone;
        if (navStandalone === true) return "installed";
        return "browser";
      } catch {
        return "unknown";
      }
    };

    setState(detect());

    // Re-check if the display mode changes (rare — but happens if
    // the user installs while in a tab and the browser hot-swaps).
    const mql = window.matchMedia("(display-mode: standalone)");
    const handler = () => setState(detect());
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return state;
}
