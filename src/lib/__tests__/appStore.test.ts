/**
 * Shared in-tab state (audit REL-3, 2026-07-24).
 *
 * The bug: each useAppState instance kept its own copy of AppState, so a
 * functional update ran against THAT instance's snapshot. Two components
 * mutating inside the save debounce each wrote a whole document built from its
 * own stale copy, and whichever flushed last silently dropped the other's edit.
 *
 * These tests model exactly that: two "instances" that each captured the state
 * before either mutated. The store must make the second update see the first's
 * result, so both survive.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getShared,
  setShared,
  subscribeShared,
  applyUpdate,
  resetShared,
} from "@/lib/appStore";
import { getDefaultState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

const base = () => getDefaultState();

function withName(s: AppState, name: string): AppState {
  return { ...s, settings: { ...s.settings, name } };
}
function withStreak(s: AppState, n: number): AppState {
  return { ...s, currentStreak: n };
}

beforeEach(() => resetShared());

describe("appStore — lost-update protection (REL-3)", () => {
  it("a second update sees the first, so neither edit is dropped", () => {
    setShared(base());
    // Both "instances" capture the state BEFORE either mutates — the exact
    // condition that used to lose one of the two writes.
    const snapshotA = getShared()!;
    const snapshotB = getShared()!;
    expect(snapshotA).toBe(snapshotB);

    // Instance A renames (e.g. a profile edit).
    applyUpdate((prev) => withName(prev, "renamed"), base);
    // Instance B toggles something a moment later, still holding its snapshot.
    applyUpdate((prev) => withStreak(prev, 12), base);

    const final = getShared()!;
    expect(final.settings.name).toBe("renamed"); // A survived
    expect(final.currentStreak).toBe(12); // B survived
  });

  it("demonstrates the old behaviour to prove the test has teeth", () => {
    // Updating against a CAPTURED snapshot (what each instance used to do)
    // drops the earlier edit — this is the regression being guarded against.
    setShared(base());
    const stale = getShared()!;
    applyUpdate((prev) => withName(prev, "renamed"), base);
    // Instance B ignores the shared value and uses its own copy:
    setShared(withStreak(stale, 12));
    const final = getShared()!;
    expect(final.currentStreak).toBe(12);
    expect(final.settings.name).not.toBe("renamed"); // the lost update
  });

  it("a direct (non-functional) update replaces the shared value", () => {
    setShared(base());
    applyUpdate(withStreak(base(), 3), base);
    expect(getShared()!.currentStreak).toBe(3);
  });

  it("falls back to a default base when nothing is published yet", () => {
    expect(getShared()).toBeNull();
    applyUpdate((prev) => withStreak(prev, 5), base);
    expect(getShared()!.currentStreak).toBe(5);
  });

  it("notifies every subscriber, and stops after unsubscribe", () => {
    const seenA: number[] = [];
    const seenB: number[] = [];
    const unsubA = subscribeShared((s) => seenA.push(s.currentStreak));
    subscribeShared((s) => seenB.push(s.currentStreak));

    applyUpdate(withStreak(base(), 1), base);
    unsubA();
    applyUpdate(withStreak(base(), 2), base);

    expect(seenA).toEqual([1]); // stopped after unsubscribe
    expect(seenB).toEqual([1, 2]); // still listening
  });
});
