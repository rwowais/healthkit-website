/**
 * fetch wrapped with an AbortController timeout.
 *
 * A stalled / black-holed connection (captive portal, dead TCP, a server
 * that accepts the socket but never responds) makes a bare `fetch` hang
 * FOREVER — and supabase-js just awaits it. So the initial `load()` never
 * resolves, its `.then` never runs, and every page spins its skeleton
 * indefinitely; a post-sign-in `afterAuth()` never navigates (audit REL-9,
 * 2026-07-16). Bounding every request converts that infinite hang into a
 * ~10s ceiling: on timeout the fetch aborts, the supabase-js call surfaces
 * an error, and the existing offline-fallback paths (load() → local cache)
 * take over. Only pathological stalls hit the ceiling — a working request,
 * even on a slow mobile network, finishes in well under a second.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

export function makeFetchWithTimeout(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return (input, init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    // Respect an upstream abort too — supabase-js may pass its own signal
    // (e.g. a caller cancelled). Chain it so our wrapper never swallows it.
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) ctrl.abort();
      else
        upstream.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    return baseFetch(input, { ...init, signal: ctrl.signal }).finally(() =>
      clearTimeout(timer)
    );
  };
}
