/**
 * sync.ts — network + cloud sync state machine.
 *
 * The single source of truth for "are we online?" and "is our cloud
 * write keeping up with what the user is doing?" Consumed by:
 *   - SyncIndicator (the calm status pill in the shell)
 *   - SupabaseDataSource (drives the auto-retry when network returns)
 *   - any UI that needs to know whether a write will actually
 *     reach the server right now
 *
 * Why a tiny state machine instead of just navigator.onLine:
 *   `navigator.onLine` only tells us about the OS network stack, not
 *   whether our specific server is reachable. A user can be "online"
 *   per the browser yet still hit a 500 from Supabase, or be on a
 *   captive-portal wifi that pretends to work. So we track three
 *   things together — the OS network state, the actual save outcomes,
 *   and whether there's pending work — and derive the user-facing
 *   state from all three.
 *
 * States:
 *   - "synced"  — everything's up to date and online
 *   - "syncing" — a write is in flight right now
 *   - "pending" — online, but the last write failed or there's queued
 *                 work waiting to retry
 *   - "offline" — OS says we're offline; writes will queue locally
 *                 and retry on reconnect
 *   - "error"   — repeated failures even when online (server problem)
 */

export type SyncState =
  | "synced"
  | "syncing"
  | "pending"
  | "offline"
  | "error";

interface InternalState {
  online: boolean;
  inFlight: number;
  pending: boolean;
  errorStreak: number;
}

let state: InternalState = {
  online:
    typeof navigator !== "undefined" ? navigator.onLine !== false : true,
  inFlight: 0,
  pending: false,
  errorStreak: 0,
};

type Listener = (s: SyncState) => void;
const listeners = new Set<Listener>();

export function getSyncState(): SyncState {
  if (!state.online) return "offline";
  if (state.inFlight > 0) return "syncing";
  if (state.errorStreak >= 3) return "error";
  if (state.pending) return "pending";
  return "synced";
}

export function getNetworkOnline(): boolean {
  return state.online;
}

function emit() {
  const s = getSyncState();
  for (const l of listeners) {
    try {
      l(s);
    } catch {
      /* listener threw — keep going */
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Push current state immediately so subscribers don't render a
  // stale "synced" when they really should show "offline."
  try {
    listener(getSyncState());
  } catch {}
  return () => listeners.delete(listener);
}

/** Set by SupabaseDataSource at the start of an in-flight save. */
export function markSaveStarted() {
  state = { ...state, inFlight: state.inFlight + 1 };
  emit();
}

/** Set by SupabaseDataSource when a save completes successfully. */
export function markSaveSuccess() {
  state = {
    ...state,
    inFlight: Math.max(0, state.inFlight - 1),
    pending: false,
    errorStreak: 0,
  };
  emit();
}

/** Set by SupabaseDataSource when a save fails. */
export function markSaveError() {
  state = {
    ...state,
    inFlight: Math.max(0, state.inFlight - 1),
    pending: true,
    errorStreak: state.errorStreak + 1,
  };
  emit();
}

// ── Network listeners (browser-only) ──────────────────────────────

/**
 * Subscriber set up by the Shell on mount. Watches the browser's
 * online/offline events and the Page Visibility API so we also
 * notice when a backgrounded tab comes forward (often the moment
 * the user reconnects to wifi).
 */
type RetryCallback = () => Promise<void> | void;
let retryCallback: RetryCallback | null = null;
let retryDebounce: ReturnType<typeof setTimeout> | null = null;

/**
 * Called by SupabaseDataSource on first activation. The callback is
 * invoked whenever we transition online → offline → online, OR when
 * the tab becomes visible while pending work exists. Wrapped in a
 * 1s debounce so a flicker doesn't trigger a storm.
 */
export function setRetryHandler(cb: RetryCallback | null) {
  retryCallback = cb;
}

function scheduleRetry() {
  if (!retryCallback) return;
  if (retryDebounce) clearTimeout(retryDebounce);
  retryDebounce = setTimeout(() => {
    retryDebounce = null;
    if (!state.online) return;
    if (!state.pending && state.errorStreak === 0) return;
    retryCallback?.();
  }, 1000);
}

// Gate the global wiring on the existence of the relevant globals.
// Some test environments (node-only without jsdom) have window but
// not document, or neither — every check must stand alone so a
// missing global doesn't reference-error the module on import.
if (typeof window !== "undefined") {
  try {
    window.addEventListener("online", () => {
      state = { ...state, online: true };
      emit();
      scheduleRetry();
    });
    window.addEventListener("offline", () => {
      state = { ...state, online: false };
      emit();
    });
  } catch {
    /* event API unavailable — sync state still works, just no auto-retry */
  }
}
if (typeof document !== "undefined") {
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.online) {
        scheduleRetry();
      }
    });
  } catch {}
}
