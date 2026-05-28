"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh hook with native-feel mechanics.
 *
 * Behavior:
 *   - Only engages when the user is at scroll-top (scrollY ≤ 0).
 *   - Tracks vertical drag distance; rubber-bands beyond the
 *     threshold so it feels like a real elastic surface, not a
 *     binary switch.
 *   - Above threshold (default 70px) on release: fires onRefresh,
 *     shows the spinner for at least 600ms (so the user sees the
 *     refresh happen — too-fast feels jarring), then resets.
 *   - Below threshold: snaps back smoothly.
 *
 * Why a custom hook instead of a library:
 *   The available libraries either depend on the older react-spring
 *   API, ship 30KB of layout overhead, or rely on touch events that
 *   don't play nice with our existing pointer-event handlers. This
 *   is ~80 lines, no extra dependencies, and matches our voice.
 *
 * Returns a ref to attach to the scroll container, plus the
 * "pull state" (0..1+ where 1.0 = at threshold) so the consumer
 * can render their own indicator.
 *
 * NB: requires `overscroll-behavior: contain` on the container so
 * the browser doesn't intercept the gesture with its own native
 * pull-to-refresh (Chrome on Android does this).
 */
export interface PullState {
  /** Normalized 0..1 (above 1 = rubber-band region). */
  progress: number;
  /** True while the refresh callback is in flight. */
  refreshing: boolean;
  /** True while the user is actively pulling. */
  pulling: boolean;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: { threshold?: number; disabled?: boolean } = {}
): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: PullState;
} {
  const { threshold = 70, disabled = false } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const [state, setState] = useState<PullState>({
    progress: 0,
    refreshing: false,
    pulling: false,
  });

  useEffect(() => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let dragging = false;

    const atTop = () =>
      el.scrollTop <= 0 && window.scrollY <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!atTop()) return;
      if (state.refreshing) return;
      startYRef.current = e.touches[0].clientY;
      dragging = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current == null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) return;
      if (!atTop()) {
        startYRef.current = null;
        setState((s) => ({ ...s, pulling: false, progress: 0 }));
        return;
      }
      dragging = true;
      // Rubber-band past threshold: linear up to threshold, then
      // dampened (sqrt-like) so the user can't pull infinitely.
      const eased =
        dy <= threshold
          ? dy
          : threshold + (dy - threshold) * 0.4;
      setState((s) => ({
        ...s,
        pulling: true,
        progress: eased / threshold,
      }));
      // Prevent native pull-to-refresh once we've engaged.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!dragging) {
        startYRef.current = null;
        return;
      }
      const triggered = state.progress >= 1;
      startYRef.current = null;
      dragging = false;
      if (!triggered) {
        setState({ progress: 0, refreshing: false, pulling: false });
        return;
      }
      setState({ progress: 1, refreshing: true, pulling: false });
      const startedAt = Date.now();
      try {
        await onRefresh();
      } finally {
        // Always show the spinner for at least 600ms — too-fast feels
        // janky and the user wonders if anything actually happened.
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, 600 - elapsed);
        setTimeout(() => {
          setState({ progress: 0, refreshing: false, pulling: false });
        }, wait);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, threshold, disabled, state.refreshing, state.progress]);

  return { containerRef, state };
}
