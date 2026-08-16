/**
 * appStore.ts — the single in-tab AppState.
 *
 * Why this exists (audit REL-3, 2026-07-24): every `useAppState` instance used
 * to keep its OWN copy of the state. A mutation was a functional update against
 * that instance's `prev`, and the reconcile-by-reload was deliberately skipped
 * whenever the receiving instance had a pending save of its own. So two
 * components mutating inside the ~600ms save debounce each built a whole
 * document from its own stale copy, and whichever flushed last silently dropped
 * the other's edit — quick-add an item, immediately tap a behavior, and one of
 * the two is gone from localStorage, from the cloud, and from the UI.
 *
 * Holding one object per tab here (rather than in a Context) keeps the fix free
 * of provider plumbing and avoids re-rendering components that don't use it.
 * The important guarantee is in `applyUpdate`: a functional update always
 * resolves against the CURRENT shared value, never a caller-captured snapshot.
 */
import type { AppState } from "./types";

let current: AppState | null = null;
const subs = new Set<(s: AppState) => void>();

/** The tab's current state, or null before the first load/publish. */
export function getShared(): AppState | null {
  return current;
}

/** Publish a new tab-wide state and notify every subscriber. */
export function setShared(next: AppState): void {
  current = next;
  for (const fn of subs) fn(next);
}

/** Subscribe to shared-state changes. Returns an unsubscribe function. */
export function subscribeShared(fn: (s: AppState) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/**
 * The core of the hook's setState.
 *
 * `fallback` supplies a base only when nothing has been published yet (i.e.
 * a mutation racing the initial load); it is intentionally lazy so the default
 * state isn't constructed on every call.
 */
export function applyUpdate(
  updater: AppState | ((prev: AppState) => AppState),
  fallback: () => AppState
): AppState {
  const base = current ?? fallback();
  const next =
    typeof updater === "function"
      ? (updater as (prev: AppState) => AppState)(base)
      : updater;
  setShared(next);
  return next;
}

/**
 * Compare-and-swap publish, for values that were computed from an OLDER
 * snapshot — i.e. anything asynchronous: the initial load, a refocus resync.
 *
 * Why it exists: a load started before the user touched anything resolves
 * AFTER they did, carrying pre-edit data. Publishing it unconditionally
 * overwrites the edit for every instance at once — the user sees the toggle
 * flip, then the stale document is what actually gets saved, and the change is
 * silently gone (caught by the e2e persistence + sync specs, 2026-07-24).
 *
 * Callers capture `getShared()` before starting the async work and pass it as
 * `expected`. If anything published in the meantime, this is a no-op and the
 * caller should adopt the current value instead of forcing its own.
 *
 * Returns true if the value was published.
 */
export function publishIfUnchanged(
  expected: AppState | null,
  next: AppState
): boolean {
  if (current !== expected) return false;
  setShared(next);
  return true;
}

/** Test seam — drop the shared value and all subscribers. */
export function resetShared(): void {
  current = null;
  subs.clear();
}
