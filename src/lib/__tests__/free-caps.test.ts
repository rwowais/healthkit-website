/**
 * Free-cap enforcement — "lock, don't delete" (founder decisions 2026-08-16).
 *
 * The deal: free = 2 active official packs + 3 active supplements. At trial
 * expiry the extras PAUSE (data intact, restore by upgrading or swapping) —
 * and enforcement has teeth ONLY once payments are live (capsEnforced()),
 * so pre-Stripe users stay grandfathered.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  getDefaultState,
  enforceFreeCaps,
  addSupplement,
  toggleSupplement,
  setSupplementPaused,
  setPackPaused,
  upsertCustomPack,
  clearSupplementPauses,
} from "@/lib/storage";
import {
  __setCapsEnforced,
  setEntitlement,
  FREE_PACKS,
  FREE_SUPPLEMENTS,
} from "@/lib/entitlements";
import { PACKS } from "@/lib/packs";
import type { AppState, Supplement, ProtocolPack } from "@/lib/types";

const DAY = 86_400_000;
const OFFICIAL = PACKS.filter((p) => p.source === "official").map((p) => p.id);

function supp(id: string, paused?: boolean): Supplement {
  return {
    id,
    name: `S-${id}`,
    block: "morning",
    source: "custom",
    ...(paused ? { paused: true } : {}),
  } as unknown as Supplement;
}

/** An expired-trial free user — the state enforcement exists for. */
function expiredUser(over: Partial<AppState> = {}): AppState {
  const base = getDefaultState();
  return {
    ...base,
    settings: {
      ...base.settings,
      tier: "free",
      trialStartDate: new Date(Date.now() - 20 * DAY).toISOString(),
      premiumTrialEndsAt: new Date(Date.now() - 6 * DAY).toISOString(),
    },
    ...over,
  };
}

/** Same shape but still inside the trial (premium via trial). */
function trialUser(over: Partial<AppState> = {}): AppState {
  const s = expiredUser(over);
  return {
    ...s,
    settings: {
      ...s.settings,
      premiumTrialEndsAt: new Date(Date.now() + 7 * DAY).toISOString(),
    },
  };
}

afterEach(() => {
  __setCapsEnforced(null);
  setEntitlement(null);
});

describe("enforceFreeCaps — pause, never delete", () => {
  it("pauses official packs beyond the cap, keeping the first ones active", () => {
    __setCapsEnforced(true);
    const five = OFFICIAL.slice(0, 5);
    const out = enforceFreeCaps(expiredUser({ installedPacks: five }));
    // Nothing removed…
    expect(out.installedPacks).toEqual(five);
    // …extras paused, first FREE_PACKS stay active.
    expect(out.pausedPacks).toEqual(five.slice(FREE_PACKS));
  });

  it("pauses supplements beyond the cap, keeping the first ones active", () => {
    __setCapsEnforced(true);
    const stack = ["a", "b", "c", "d", "e"].map((id) => supp(id));
    const out = enforceFreeCaps(expiredUser({ supplements: stack }));
    expect(out.supplements!.map((s) => !!s.paused)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    // Data intact — same ids, nothing dropped.
    expect(out.supplements!.map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("is a no-op before payments are live (grandfathering)", () => {
    __setCapsEnforced(false);
    const st = expiredUser({
      installedPacks: OFFICIAL.slice(0, 5),
      supplements: ["a", "b", "c", "d"].map((id) => supp(id)),
    });
    expect(enforceFreeCaps(st)).toBe(st); // same reference — fixed point
  });

  it("is a no-op for trial (premium) users", () => {
    __setCapsEnforced(true);
    const st = trialUser({ installedPacks: OFFICIAL.slice(0, 5) });
    expect(enforceFreeCaps(st)).toBe(st);
  });

  it("is idempotent — a second pass changes nothing", () => {
    __setCapsEnforced(true);
    const once = enforceFreeCaps(
      expiredUser({
        installedPacks: OFFICIAL.slice(0, 4),
        supplements: ["a", "b", "c", "d"].map((id) => supp(id)),
      })
    );
    expect(enforceFreeCaps(once)).toBe(once);
  });
});

describe("supplement gates", () => {
  it("addSupplement blocks past the active cap when enforced + free", () => {
    __setCapsEnforced(true);
    let st = expiredUser({
      supplements: ["a", "b", "c"].map((id) => supp(id)),
    });
    st = addSupplement(st, supp("d"));
    expect(st.supplements!.length).toBe(3); // blocked
    // A paused item does NOT count toward active — swap room exists.
    st = { ...st, supplements: [supp("a", true), supp("b"), supp("c")] };
    st = addSupplement(st, supp("d"));
    expect(st.supplements!.length).toBe(4); // allowed (2 active + 1)
  });

  it("addSupplement is unlimited during the trial", () => {
    __setCapsEnforced(true);
    let st = trialUser({ supplements: [] });
    for (const id of ["a", "b", "c", "d", "e", "f"])
      st = addSupplement(st, supp(id));
    expect(st.supplements!.length).toBe(6);
  });

  it("toggleSupplement is a no-op on a paused supplement", () => {
    const st = expiredUser({ supplements: [supp("a", true)] });
    expect(toggleSupplement(st, "2026-08-16", "a")).toBe(st);
  });

  it("setSupplementPaused swaps within the cap, never past it", () => {
    __setCapsEnforced(true);
    let st = expiredUser({
      supplements: [supp("a"), supp("b"), supp("c"), supp("d", true)],
    });
    // Unpause at cap → blocked.
    expect(setSupplementPaused(st, "d", false)).toBe(st);
    // Pause one, then the unpause fits.
    st = setSupplementPaused(st, "a", true);
    st = setSupplementPaused(st, "d", false);
    expect(st.supplements!.find((s) => s.id === "a")!.paused).toBe(true);
    expect(st.supplements!.find((s) => s.id === "d")!.paused).toBeUndefined();
  });

  it("clearSupplementPauses restores the whole stack (the upgrade promise)", () => {
    const st = expiredUser({
      supplements: [supp("a"), supp("b", true), supp("c", true)],
    });
    const out = clearSupplementPauses(st);
    expect(out.supplements!.every((s) => !s.paused)).toBe(true);
  });
});

describe("pack + builder gates", () => {
  it("unpausing an official pack past the cap is blocked; pausing is free", () => {
    __setCapsEnforced(true);
    const three = OFFICIAL.slice(0, 3);
    let st = expiredUser({
      installedPacks: three,
      pausedPacks: [three[2]],
    });
    // 2 active = at cap → unpause blocked.
    expect(setPackPaused(st, three[2], false)).toBe(st);
    // Swap: pause an active one, then the unpause fits.
    st = setPackPaused(st, three[0], true);
    st = setPackPaused(st, three[2], false);
    expect(st.pausedPacks).toEqual([three[0]]);
  });

  it("editing an existing custom pack requires premium; accepting a NEW shared pack stays open", () => {
    __setCapsEnforced(true);
    const pack = {
      id: "custom-1",
      name: "Mine",
      source: "custom",
      behaviors: [],
    } as unknown as ProtocolPack;
    let st = expiredUser({ customPacks: [pack], installedPacks: ["custom-1"] });
    // EDIT blocked…
    const edited = { ...pack, name: "Renamed" };
    expect(upsertCustomPack(st, edited)).toBe(st);
    // …CREATE (a friend's shared pack) allowed.
    const shared = { ...pack, id: "custom-2", name: "Shared" };
    st = upsertCustomPack(st, shared);
    expect(st.customPacks.some((p) => p.id === "custom-2")).toBe(true);
  });

  it("everything above is inert while payments are off", () => {
    __setCapsEnforced(false);
    const pack = {
      id: "custom-1",
      name: "Mine",
      source: "custom",
      behaviors: [],
    } as unknown as ProtocolPack;
    let st = expiredUser({
      customPacks: [pack],
      supplements: [supp("a"), supp("b"), supp("c")],
    });
    st = upsertCustomPack(st, { ...pack, name: "Renamed" });
    expect(st.customPacks[0].name).toBe("Renamed"); // edit allowed
    st = addSupplement(st, supp("d"));
    expect(st.supplements!.length).toBe(4); // add allowed
  });
});

describe("cap values (founder call 2026-08-16)", () => {
  it("free = 2 packs + 3 supplements", () => {
    expect(FREE_PACKS).toBe(2);
    expect(FREE_SUPPLEMENTS).toBe(3);
  });
});
