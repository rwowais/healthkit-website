/**
 * appBadge.ts — App icon badge management for installed PWAs.
 *
 * The Badging API (navigator.setAppBadge / clearAppBadge) lets a
 * PWA show a numeric badge on its installed icon — the same way
 * Mail, Messages, and Calendar show counts on iOS/macOS, or how
 * Android shows app dots.
 *
 * Platform support:
 *   - macOS + Safari: ✓ for installed PWAs (Dock icon)
 *   - macOS + Chrome/Edge: ✓ for installed PWAs (Dock icon)
 *   - Windows + Chrome/Edge: ✓ for installed PWAs (taskbar)
 *   - Android Chrome: ✓ for installed PWAs (home screen icon dot/number)
 *   - iOS Safari: ✓ from iOS 16.4+ for installed PWAs only
 *   - Anything not installed: silent no-op (the API returns but
 *     no badge shows because there's no app icon to badge)
 *
 * Usage pattern:
 *   - Set the badge whenever today's remaining count changes
 *     (after behavior toggle, after timeline reshape, on initial
 *     load, on visibility change to "visible")
 *   - Clear when count is 0 — no "0" badge stays visible.
 *
 * Reality:
 *   This is a "delight" feature. Users without an installed PWA
 *   never see it. But for installed users — your real engaged
 *   audience — seeing "3" on your icon when 3 things still need
 *   to happen today is the single biggest re-engagement nudge
 *   short of a notification.
 */

let lastBadge: number | null = null;

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function nav(): BadgeNavigator | null {
  if (typeof navigator === "undefined") return null;
  return navigator as BadgeNavigator;
}

export function badgeSupported(): boolean {
  const n = nav();
  return typeof n?.setAppBadge === "function" &&
    typeof n?.clearAppBadge === "function";
}

/**
 * Set the badge to N. N=0 clears the badge (no zero badges).
 * Idempotent — re-setting the same number is a no-op (avoids
 * thrashing the OS on every state save).
 */
export async function setBadge(count: number) {
  const n = nav();
  if (!n?.setAppBadge || !n?.clearAppBadge) return;
  // Clamp to a reasonable max so we never request a 9999 badge.
  const c = Math.max(0, Math.min(99, Math.round(count)));
  if (c === lastBadge) return;
  lastBadge = c;
  try {
    if (c === 0) {
      await n.clearAppBadge();
    } else {
      await n.setAppBadge(c);
    }
  } catch {
    /* Permission may not be granted; quietly carry on */
  }
}

/** Force-clear the badge regardless of cached value. Used on sign-out. */
export async function clearBadge() {
  const n = nav();
  if (!n?.clearAppBadge) return;
  lastBadge = 0;
  try {
    await n.clearAppBadge();
  } catch {}
}
