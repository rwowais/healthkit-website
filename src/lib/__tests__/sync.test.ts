/**
 * Sync state machine — regression lock for the audit's High finding (REL-1,
 * 2026-07-16): the optimistic-concurrency guard-skip path returned without
 * balancing markSaveStarted()'s in-flight increment, so after one normal
 * multi-device guard-skip the indicator wedged on "Syncing…" forever and
 * masked pending/offline/error. markSaveDeferred() balances the counter while
 * keeping "pending" truthful.
 *
 * Note: sync.ts holds module-level singleton state; these tests are written
 * order-tolerantly (every markSaveStarted is balanced) and rely on
 * getSyncState()'s inFlight>0 → "syncing" short-circuit.
 */
import { describe, it, expect } from "vitest";
import {
  markSaveStarted,
  markSaveDeferred,
  markSaveSuccess,
  getSyncState,
} from "@/lib/sync";

describe("sync state machine — markSaveDeferred (REL-1)", () => {
  it("balances the in-flight counter so the indicator can't wedge on 'syncing'", () => {
    markSaveStarted();
    expect(getSyncState()).toBe("syncing");
    markSaveDeferred();
    // Decremented inFlight AND set pending → surfaces the un-pushed edit as
    // "pending", never stuck on "syncing".
    expect(getSyncState()).toBe("pending");
  });

  it("repeated deferrals never escalate to the 'error' state", () => {
    for (let i = 0; i < 5; i++) {
      markSaveStarted();
      markSaveDeferred();
    }
    expect(getSyncState()).not.toBe("error");
    expect(getSyncState()).toBe("pending");
  });

  it("a later successful save clears the deferred-pending flag", () => {
    markSaveStarted();
    markSaveDeferred();
    expect(getSyncState()).toBe("pending");
    markSaveStarted();
    markSaveSuccess();
    expect(getSyncState()).toBe("synced");
  });
});
