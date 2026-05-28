"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onResume` when the tab becomes visible again after being
 * hidden for at least `minHiddenMs` (default 30s). The threshold
 * exists so we don't refresh on every short tab-switch — only when
 * the user has actually been away and the data could plausibly be
 * stale.
 *
 * Why this matters for a PWA:
 *   When a user opens the app from their home screen, the OS often
 *   resumes the existing process instead of cold-starting. Without
 *   visibility-triggered refresh, they'd see whatever was on screen
 *   when they last switched away — which could be hours old, with
 *   wrong streaks/scores/up-next.
 *
 * Used by Today's outer effect to fetch fresh state on resume.
 */
export function useVisibilityRefresh(
  onResume: () => void,
  minHiddenMs = 30_000
) {
  const onResumeRef = useRef(onResume);
  useEffect(() => {
    onResumeRef.current = onResume;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    let hiddenAt: number | null = null;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === "visible") {
        if (hiddenAt != null && Date.now() - hiddenAt >= minHiddenMs) {
          try {
            onResumeRef.current();
          } catch {
            /* ignore */
          }
        }
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [minHiddenMs]);
}
