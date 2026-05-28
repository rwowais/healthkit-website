/**
 * haptics.ts — calm haptic feedback for key interactions.
 *
 * Reality on the web:
 *   - Android Chrome / Edge / Firefox: navigator.vibrate works.
 *   - iOS Safari: deliberately disabled by Apple for web pages,
 *     including installed PWAs. Apple keeps haptics gated to native
 *     apps for now (and to AudioContext side-channels, which we
 *     don't abuse — that path is a UX cliff full of edge cases).
 *   - Desktop: silently no-op.
 *
 * So this helper is best-effort: it improves the experience for
 * Android users (a meaningful share of mobile PWA users) without
 * doing anything weird on iOS. The lack of iOS haptics is one of
 * the real "PWAs are 80-90% as good as native" gaps; native wrappers
 * (Capacitor/Expo) unlock proper iOS haptics when we wrap later.
 *
 * Patterns:
 *   light()   — subtle confirmation of a small action (toggling a
 *               behavior off, tapping a chip)
 *   medium()  — definitive action (saving a setting, installing a
 *               protocol, completing a behavior)
 *   success() — celebratory positive moment (streak unlocked,
 *               keystone freshly mastered)
 *   warning() — calm correction (action couldn't complete; respect
 *               the user, don't startle them)
 *
 * Tuning notes:
 *   The vibration durations are intentionally short (10-25ms) — we
 *   want the user to feel the system acknowledge them, not feel
 *   their phone shake. Anything > 30ms is too much for casual UX.
 */

let enabled = true;

function canVibrate(): boolean {
  if (!enabled) return false;
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  // Respect prefers-reduced-motion as a proxy for reduced-stimulation
  // — users who turned it on probably want quieter feedback too.
  try {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return false;
    }
  } catch {}
  return true;
}

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/** Subtle 10ms tap — for small confirmations. */
export function light() {
  if (canVibrate()) navigator.vibrate(10);
}

/** Definitive 18ms tap — for completing an important action. */
export function medium() {
  if (canVibrate()) navigator.vibrate(18);
}

/** Pleasant two-pulse — for positive moments (streak, milestone). */
export function success() {
  if (canVibrate()) navigator.vibrate([12, 30, 12]);
}

/** Single 25ms tap — for "couldn't complete" without alarming. */
export function warning() {
  if (canVibrate()) navigator.vibrate(25);
}
