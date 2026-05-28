/**
 * trial-transitions.test.ts — three trial-state personas evolved in
 * parallel through key checkpoints.
 *
 * Personas:
 *   1. "Quinn the quick converter" — free trial day 1, pays annual day 7.
 *      Premium ever after; uses Premium features freely.
 *   2. "Erin the engaged but free" — completes 14-day trial perfectly
 *      (>6 engaged days). Trial does NOT auto-extend (engagement-gated).
 *      Returns daily for the rest of the year. Free-tier caps must hold.
 *   3. "Iris the inactive truster" — barely opens app in 14 days. Trial
 *      MUST auto-extend (low engagement). Returns day 21 mid-extension,
 *      then converts to paid. Premium ever after.
 *
 * Each persona drives day-by-day. assertInvariants runs at every
 * checkpoint, picking up the full ALL_INVARIANTS suite. Additional
 * targeted assertions enforce the specific entitlement contracts:
 *   - inv_biomarkers_premium_gated holds for Erin (bio-aware adapt
 *     never fires for a non-premium user).
 *   - inv_free_tier_caps_held holds for Erin after multiple add attempts.
 *   - maybeExtendTrial only fires when engagement is below AHA_DAYS.
 *   - On extension, the new trialEndsAt is in the future and access
 *     reports premium=true again.
 *
 * Time is controlled with vi.setSystemTime so day-precise checkpoints
 * are reproducible regardless of when the suite is run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBiomarker,
  getDefaultState,
  installPack,
  saveDailyLog,
} from "@/lib/storage";
import {
  AHA_DAYS,
  getAccess,
  maybeExtendTrial,
} from "@/lib/entitlements";
import { adapt, getSignals } from "@/lib/engine";
import { PACKS } from "@/lib/packs";
import { assertInvariants } from "../invariants";
import type { AppState, DailyLog } from "@/lib/types";

// ── Deterministic time anchor ────────────────────────────────────

const T0_ISO = "2025-03-01T12:00:00Z"; // arbitrary fixed anchor
const T0 = new Date(T0_ISO).getTime();

function setNow(dayNum: number): void {
  // dayNum=1 → T0, dayNum=2 → T0+1 day, etc.
  vi.setSystemTime(new Date(T0 + (dayNum - 1) * 86_400_000));
}

function dayKey(dayNum: number): string {
  const d = new Date(T0 + (dayNum - 1) * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ── Log factory ──────────────────────────────────────────────────

function emptyLog(date: string): DailyLog {
  return {
    date,
    sleepCompletions: [],
    exerciseEntries: [],
    nutritionScorecard: {
      hitProteinTarget: null,
      ateFruitsVeggies: null,
      stayedHydrated: null,
      avoidedProcessedSugar: null,
      finishedEatingOnTime: null,
      minimizedAlcohol: null,
      customItems: [],
      note: "",
    },
    supplementEntries: [],
    completions: [],
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: null,
      sleepDurationMinutes: null,
    },
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
    pillarScores: { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 },
    behaviorCompletions: {},
  } as DailyLog;
}

function engagedLog(date: string): DailyLog {
  const l = emptyLog(date);
  l.score = 75;
  l.sleepLog = {
    actualBedtime: null,
    actualWakeTime: null,
    sleepQuality: 4,
    sleepDurationMinutes: 450,
  };
  l.energyLevel = 4;
  l.behaviorCompletions = { "morning-sunlight": true, "hydrate-am": true };
  return l;
}

// "open the app, but nothing logged" — engagement helper records
// existence-only days so engagedDays() does NOT count them. The
// entitlement layer's engagedDays() requires score > 0 OR a check-in
// OR a behavior completion. We deliberately keep score=0 + no logs
// for Iris's first 14 days.
function passiveLog(date: string): DailyLog {
  return emptyLog(date);
}

// ── Persona setup ────────────────────────────────────────────────

/** All three personas start day 1 on the 14-day reverse trial. */
function startTrialState(name: string): AppState {
  const trialEnd = new Date(T0 + 14 * 86_400_000).toISOString();
  const base = getDefaultState();
  return {
    ...base,
    settings: {
      ...base.settings,
      name,
      tier: "free",
      premiumTrialEndsAt: trialEnd,
      completedOnboarding: true,
    },
  };
}

// ── Pack catalog helpers ─────────────────────────────────────────

const OFFICIAL_PACK_IDS = PACKS.filter((p) => p.source === "official").map(
  (p) => p.id,
);

/** Five distinct official pack ids for Quinn's heavy install. */
function fiveOfficialPacks(): string[] {
  return OFFICIAL_PACK_IDS.slice(0, 5);
}

/** Four official packs to try installing for Erin (4th must fail). */
function fourOfficialPacks(): string[] {
  return OFFICIAL_PACK_IDS.slice(0, 4);
}

// ── Hooks ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  setNow(1);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Quinn — quick converter ──────────────────────────────────────

describe("persona: Quinn the quick converter", () => {
  it("converts day 7, premium ever after; >3 biomarkers, 5 packs", () => {
    let st = startTrialState("Quinn");

    // Days 1-6: heavy use during trial — premium (via trial) is on,
    // so installs/biomarkers are uncapped.
    for (let d = 1; d <= 6; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    // Install 5 official packs while trial-premium is active.
    setNow(6);
    for (const pid of fiveOfficialPacks()) st = installPack(st, pid);
    // Add 5 distinct biomarkers while trial-premium is active.
    const bioOnTrial: Array<{ metric: string; value: number }> = [
      { metric: "weight", value: 80 },
      { metric: "hrv", value: 60 },
      { metric: "restingHR", value: 58 },
      { metric: "vo2max", value: 46 },
      { metric: "bodyFat", value: 22 },
    ];
    for (const b of bioOnTrial)
      st = addBiomarker(st, { ...b, date: dayKey(6) });

    // Day 7 — conversion: tier flips to premium. premiumTrialEndsAt may
    // remain (it's harmless once paid; getAccess prefers `paid`).
    setNow(7);
    st = {
      ...st,
      settings: { ...st.settings, tier: "premium" },
    };
    st = saveDailyLog(st, engagedLog(dayKey(7)));
    const a7 = getAccess(st);
    expect(a7.paid).toBe(true);
    expect(a7.premium).toBe(true);
    expect(a7.trialExpired).toBe(false);
    assertInvariants(st, "Quinn day 7 (just converted)");

    // Walk through more checkpoints. Quinn keeps logging.
    for (let d = 8; d <= 30; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(30);
    const a30 = getAccess(st);
    expect(a30.paid).toBe(true);
    expect(a30.premium).toBe(true);
    assertInvariants(st, "Quinn day 30");

    // Day 90 — 60 more engaged days.
    for (let d = 31; d <= 90; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(90);
    expect(getAccess(st).paid).toBe(true);
    assertInvariants(st, "Quinn day 90");

    // Premium-paid users have ZERO free-tier caps — verify post-conversion
    // adds beyond the free caps STILL work. Try to push 6th biomarker.
    st = addBiomarker(st, {
      metric: "vo2max",
      value: 50,
      date: dayKey(90),
    });
    const distinctMetrics = new Set(st.biomarkers.map((b) => b.metric)).size;
    expect(
      distinctMetrics,
      "premium user can add unlimited biomarker metrics",
    ).toBeGreaterThan(3);

    // maybeExtendTrial is a no-op for paid users.
    const ext = maybeExtendTrial(st);
    expect(ext).toEqual(st);

    // Day 180 + 365 — long-run stability.
    for (let d = 91; d <= 180; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(180);
    expect(getAccess(st).paid).toBe(true);
    assertInvariants(st, "Quinn day 180");

    for (let d = 181; d <= 365; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(365);
    expect(getAccess(st).paid).toBe(true);
    expect(getAccess(st).premium).toBe(true);
    assertInvariants(st, "Quinn day 365");
  });
});

// ── Erin — engaged but free ───────────────────────────────────────

describe("persona: Erin the engaged but free", () => {
  it("completes trial perfectly, no extension, free caps hold", () => {
    let st = startTrialState("Erin");

    // Days 1-14: engaged on most days (>6 → AHA reached).
    for (let d = 1; d <= 14; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    // Sanity: she easily crossed AHA_DAYS.
    setNow(14);
    expect(st.dailyLogs.length).toBe(14);
    // Day 14 — still in trial (end is at start of day 15).
    const a14 = getAccess(st);
    expect(a14.inTrial).toBe(true);
    expect(a14.premium).toBe(true);
    assertInvariants(st, "Erin day 14 (last trial day)");

    // maybeExtendTrial: she's engaged → MUST NOT extend.
    const trialEndBefore = st.settings.premiumTrialEndsAt;
    const afterMaybe = maybeExtendTrial(st);
    expect(
      afterMaybe.settings.premiumTrialEndsAt,
      "engagement above AHA must NOT trigger extension",
    ).toBe(trialEndBefore);
    expect(afterMaybe.settings.trialExtendedAt).toBeUndefined();

    // Day 15 — trial has expired (end was at T0 + 14 days, i.e. day 15
    // 12:00 UTC; setNow(15) hits T0 + 14d which is exactly the end. Step
    // to day 15.5 to ensure expiry.
    setNow(16); // safely past expiry
    const a16 = getAccess(st);
    expect(a16.trialExpired).toBe(true);
    expect(a16.premium).toBe(false);
    expect(a16.paid).toBe(false);
    assertInvariants(st, "Erin day 16 (trial expired)");

    // Day 30 — try to install a 4th official pack. Default install is 2
    // packs (longevity-foundation + better-sleep). Add one more legally
    // (3 → cap). The 4th MUST fail.
    setNow(30);
    st = saveDailyLog(st, engagedLog(dayKey(30)));
    const before30 = st.installedPacks.length;
    for (const pid of fourOfficialPacks()) {
      st = installPack(st, pid);
    }
    const officialIds = new Set(
      PACKS.filter((p) => p.source === "official").map((p) => p.id),
    );
    const installedOfficial = st.installedPacks.filter((id) =>
      officialIds.has(id),
    ).length;
    expect(
      installedOfficial,
      `free user has ${installedOfficial} official packs installed; cap is 3`,
    ).toBeLessThanOrEqual(3);
    expect(installedOfficial).toBeGreaterThanOrEqual(before30);
    assertInvariants(st, "Erin day 30 (after pack install attempts)");

    // Day 30 — biomarker caps. Add 4 distinct metrics; the 4th MUST fail.
    const toAdd = [
      { metric: "weight", value: 70 },
      { metric: "hrv", value: 30 }, // "Watch" band — would trigger biomarker-aware adapt for premium
      { metric: "restingHR", value: 65 },
      { metric: "vo2max", value: 46 }, // 4th — should be blocked
    ];
    for (const b of toAdd) st = addBiomarker(st, { ...b, date: dayKey(30) });
    const distinctMetrics = new Set(
      (st.biomarkers ?? []).map((b) => b.metric),
    );
    expect(distinctMetrics.size, "free biomarker cap = 3").toBe(3);
    expect(distinctMetrics.has("vo2max")).toBe(false);
    assertInvariants(st, "Erin day 30 (after biomarker add attempts)");

    // Critical: biomarker-aware adapt MUST NOT fire on a non-premium
    // user, even with a Watch-band HRV reading present.
    const signals30 = getSignals(st);
    expect(signals30.bioConcern, "premium-only signal leaked").toBeNull();
    expect(signals30.bioRecoveryFlag).toBe(false);
    const a30 = adapt(st);
    // Mode may legitimately be "rebuild" here (she has a real gap between
    // day 14 logs and day 30 — engine correctly reads that as a return).
    // The Premium-only contract we care about is that "recovery" mode is
    // NOT being driven by the bioRecoveryFlag.
    const sigs30 = getSignals(st);
    expect(sigs30.bioRecoveryFlag).toBe(false);
    // Recovery mode only fires for premium when bioRecoveryFlag is on.
    // For a non-premium user with a Watch HRV reading, recovery must not
    // be the *reason* (since bio signals are zeroed) — but recovery may
    // still fire from a low recoveryProxy. Our engagedLog gives sleep=4,
    // energy=4 → recoveryProxy is high → recovery should NOT fire.
    expect(a30.mode).not.toBe("recovery");

    // Days 60, 90, 180, 365 — she keeps showing up, but no premium.
    for (let d = 31; d <= 90; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(90);
    const a90 = getAccess(st);
    expect(a90.trialExpired).toBe(true);
    expect(a90.premium).toBe(false);
    assertInvariants(st, "Erin day 90");

    for (let d = 91; d <= 180; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(180);
    expect(getAccess(st).premium).toBe(false);
    assertInvariants(st, "Erin day 180");

    for (let d = 181; d <= 365; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(365);
    const a365 = getAccess(st);
    expect(a365.trialExpired).toBe(true);
    expect(a365.premium).toBe(false);
    assertInvariants(st, "Erin day 365");

    // Re-check biomarker premium gate at day 365 — paranoid: a year of
    // free-tier history shouldn't have leaked a bio signal anywhere.
    const sigs365 = getSignals(st);
    expect(sigs365.bioConcern).toBeNull();
    expect(sigs365.bioRecoveryFlag).toBe(false);
  });
});

// ── Iris — inactive truster ───────────────────────────────────────

describe("persona: Iris the inactive truster", () => {
  it("trial auto-extends, returns day 21, converts; premium ever after", () => {
    let st = startTrialState("Iris");

    // Days 1-14: she opens the app twice with NO engagement (no
    // completions, no check-in). engagedDays(state) = 0.
    // We don't even save daily logs for most days — she just opens it.
    setNow(2);
    st = saveDailyLog(st, passiveLog(dayKey(2)));
    setNow(10);
    st = saveDailyLog(st, passiveLog(dayKey(10)));

    // Day 13 — within the 3-day-before-expiry window (trial ends at
    // T0 + 14*86_400_000 which is start of day 15; setNow(13) → end - now
    // ≈ 2 days, satisfying the `< 3 * 86_400_000` window check.
    // maybeExtendTrial should fire here (engagement is 0, well below
    // AHA_DAYS=6).
    setNow(13);
    const trialEndOriginal = st.settings.premiumTrialEndsAt!;
    const extended = maybeExtendTrial(st);
    expect(
      extended.settings.premiumTrialEndsAt,
      "low engagement near expiry MUST trigger extension",
    ).not.toBe(trialEndOriginal);
    expect(extended.settings.trialExtendedAt).toBeDefined();

    // New trialEndsAt must be in the future.
    const newEnd = new Date(extended.settings.premiumTrialEndsAt!).getTime();
    expect(newEnd).toBeGreaterThan(Date.now());

    // Access must report premium=true after extension.
    const accessAfterExt = getAccess(extended);
    expect(accessAfterExt.premium).toBe(true);
    expect(accessAfterExt.inTrial).toBe(true);
    expect(accessAfterExt.trialExpired).toBe(false);
    st = extended;
    assertInvariants(st, "Iris day 13 (just extended)");

    // Day 14 — original "trial end" date. With the extension applied,
    // she's still in trial.
    setNow(14);
    const a14 = getAccess(st);
    expect(a14.premium).toBe(true);
    expect(a14.inTrial).toBe(true);
    assertInvariants(st, "Iris day 14 (extended trial active)");

    // Day 15 — past the ORIGINAL trial end but still inside the
    // extended one (extension is +7 days from day 13, so end ≈ day 20).
    setNow(15);
    expect(getAccess(st).premium).toBe(true);
    assertInvariants(st, "Iris day 15 (still in extension)");

    // Day 21 — she returns. The extended trial has just expired
    // (extension was +7 days from day 13 → ends ~day 20). At day 21,
    // trial expired but she converts now to paid.
    setNow(21);
    const a21Before = getAccess(st);
    // After extension: end was day 13 + 7 = day 20; day 21 → expired.
    expect(a21Before.trialExpired).toBe(true);
    expect(a21Before.premium).toBe(false);
    // She converts to paid.
    st = {
      ...st,
      settings: { ...st.settings, tier: "premium" },
    };
    st = saveDailyLog(st, engagedLog(dayKey(21)));
    const a21After = getAccess(st);
    expect(a21After.paid).toBe(true);
    expect(a21After.premium).toBe(true);
    expect(a21After.trialExpired).toBe(false); // paid overrides
    assertInvariants(st, "Iris day 21 (just converted post-extension)");

    // Day 30, 90, 180, 365 — premium ever after.
    for (let d = 22; d <= 30; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(30);
    expect(getAccess(st).paid).toBe(true);
    assertInvariants(st, "Iris day 30");

    for (let d = 31; d <= 90; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(90);
    expect(getAccess(st).paid).toBe(true);
    assertInvariants(st, "Iris day 90");

    for (let d = 91; d <= 180; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(180);
    expect(getAccess(st).paid).toBe(true);
    assertInvariants(st, "Iris day 180");

    for (let d = 181; d <= 365; d++) {
      setNow(d);
      st = saveDailyLog(st, engagedLog(dayKey(d)));
    }
    setNow(365);
    expect(getAccess(st).paid).toBe(true);
    expect(getAccess(st).premium).toBe(true);
    assertInvariants(st, "Iris day 365");
  });

  it(
    "edge: an inactive trial that goes WITHOUT a return until extension " +
      "window passes still degrades correctly",
    () => {
      // Variant: Iris never returns in the +/- 7-day window after the
      // original trial end. maybeExtendTrial fired the one time she
      // checked on day 12, but if she'd never come back at all, no
      // automatic extension would have applied. After day 22 (original
      // end + 7 days) the trial is truly expired and access degrades.
      let st = startTrialState("Iris-no-return");
      setNow(2);
      st = saveDailyLog(st, passiveLog(dayKey(2)));

      // Fast-forward to day 30 without ever calling maybeExtendTrial.
      setNow(30);
      const a = getAccess(st);
      expect(a.trialExpired).toBe(true);
      expect(a.premium).toBe(false);
      // maybeExtendTrial at day 30 is OUTSIDE the forgiving window
      // (>7 days past expiry) → should NOT extend.
      const after = maybeExtendTrial(st);
      expect(after.settings.premiumTrialEndsAt).toBe(
        st.settings.premiumTrialEndsAt,
      );
      expect(after.settings.trialExtendedAt).toBeUndefined();
      assertInvariants(st, "Iris-no-return day 30 (truly expired)");
    },
  );
});

// ── Cross-persona invariant matrix ───────────────────────────────

describe("cross-persona invariant matrix", () => {
  it("maybeExtendTrial is idempotent and respects engagement", () => {
    // Build all three states at day 12 and run the extension on each.
    setNow(1);
    const quinn = startTrialState("Q");
    const erin = startTrialState("E");
    const iris = startTrialState("I");

    // Quinn paid by day 7 — maybeExtendTrial is a no-op even with no
    // engagement, because paid users never extend.
    setNow(7);
    let qSt = { ...quinn, settings: { ...quinn.settings, tier: "premium" } } as
      AppState;
    qSt = saveDailyLog(qSt, engagedLog(dayKey(7)));
    setNow(13);
    const qExt = maybeExtendTrial(qSt);
    expect(qExt).toBe(qSt); // identity preserved for paid users

    // Erin engaged 12 days — maybeExtendTrial leaves her alone.
    let eSt = erin;
    for (let d = 1; d <= 12; d++) {
      setNow(d);
      eSt = saveDailyLog(eSt, engagedLog(dayKey(d)));
    }
    setNow(13);
    const eExt = maybeExtendTrial(eSt);
    expect(eExt.settings.premiumTrialEndsAt).toBe(
      eSt.settings.premiumTrialEndsAt,
    );

    // Iris no engagement — extension fires (day 13 is within the
    // <3-day-before-expiry window: end-now ≈ 2 days).
    setNow(13);
    const iExt = maybeExtendTrial(iris);
    expect(iExt.settings.premiumTrialEndsAt).not.toBe(
      iris.settings.premiumTrialEndsAt,
    );

    // Calling maybeExtendTrial AGAIN on Iris's extended state should be
    // a no-op (engagement still 0 but the new trial end is >3 days
    // away, so out of window). This guards against silent re-extension.
    const iExt2 = maybeExtendTrial(iExt);
    expect(iExt2.settings.premiumTrialEndsAt).toBe(
      iExt.settings.premiumTrialEndsAt,
    );
  });

  it(
    "AHA_DAYS exactly equals threshold — engagement at the boundary " +
      "does NOT extend",
    () => {
      // Exactly AHA_DAYS engaged logs: maybeExtendTrial sees
      // engagedDays >= AHA_DAYS and returns state unchanged.
      let st = startTrialState("Boundary");
      for (let d = 1; d <= AHA_DAYS; d++) {
        setNow(d);
        st = saveDailyLog(st, engagedLog(dayKey(d)));
      }
      setNow(13);
      const before = st.settings.premiumTrialEndsAt;
      const after = maybeExtendTrial(st);
      expect(after.settings.premiumTrialEndsAt).toBe(before);
    },
  );
});
