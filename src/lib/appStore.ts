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

/** Test seam — drop the shared value and all subscribers. */
export function resetShared(): void {
  current = null;
  subs.clear();
}
