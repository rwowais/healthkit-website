/**
 * REL-9 (audit 2026-07-16): supabase-js requests had no timeout, so a
 * black-holed connection hung load() forever (infinite skeleton). The client
 * now wraps fetch with makeFetchWithTimeout — these lock its contract.
 */
import { describe, it, expect, vi } from "vitest";
import { makeFetchWithTimeout } from "@/lib/fetchWithTimeout";

// A fetch that never responds but rejects when its signal aborts — models a
// stalled/black-holed connection the way the real fetch behaves: an ALREADY
// aborted signal rejects immediately (the "abort" event won't fire again),
// otherwise it rejects when the abort event arrives.
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    const sig = init?.signal;
    if (sig?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    sig?.addEventListener("abort", () => reject(new Error("aborted")));
  });

describe("makeFetchWithTimeout", () => {
  it("aborts a hanging request once the timeout elapses", async () => {
    vi.useFakeTimers();
    try {
      const f = makeFetchWithTimeout(1000, hangingFetch);
      const p = f("https://example.test");
      p.catch(() => {}); // pre-attach so the rejection is never unhandled
      await vi.advanceTimersByTimeAsync(1000);
      await expect(p).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes a fast response straight through, unmodified", async () => {
    const sentinel = {} as Response;
    const fastFetch: typeof fetch = () => Promise.resolve(sentinel);
    const f = makeFetchWithTimeout(1000, fastFetch);
    await expect(f("https://example.test")).resolves.toBe(sentinel);
  });

  it("respects an already-aborted upstream signal", async () => {
    const f = makeFetchWithTimeout(60_000, hangingFetch);
    const ac = new AbortController();
    ac.abort();
    const p = f("https://example.test", { signal: ac.signal });
    await expect(p).rejects.toThrow();
  });

  it("propagates an upstream abort that fires later", async () => {
    const f = makeFetchWithTimeout(60_000, hangingFetch);
    const ac = new AbortController();
    const p = f("https://example.test", { signal: ac.signal });
    p.catch(() => {});
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});
