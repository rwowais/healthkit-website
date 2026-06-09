/**
 * Persona: "Priya the careful" — 52yo, free tier, never converts.
 *
 * This is a 365-day stress test of Protocolize's free-tier limits.
 * Priya goes slow:
 *   - Installs ONLY longevity-foundation at onboarding (safetyFlags:
 *     anticoagulants=true, pregnant=false).
 *   - Adherence starts at 40%, climbs to ~60-70% over the year.
 *   - Adds biomarkers slowly: weight (day 31), HRV (day 50), restingHR
 *     (day 80) — 3 markers, at the free cap.
 *   - Tries to add LDL at day 90 → should be blocked.
 *   - At day 90, tries to install 4th pack (deep-focus) — has only 1
 *     installed, should SUCCEED (cap is 3).
 *   - At day 100, adds deep-focus + blood-sugar. Now at 3 packs.
 *   - At day 110, tries to install 4th pack — should be BLOCKED.
 *   - Day 120: trial expired long ago (14-day reverse trial); insights
 *     past 7 days, biomarker-aware adapt should degrade.
 *   - Never adds supplements; never uses vacation.
 *
 * The test deliberately probes the engine's enforcement of free-tier
 * caps and safety-flag suppression. Failures are expected — they're
 * the point. Each assertion exposes whether a contract is enforced at
 * the lib layer or only at the UI layer.
 */
import { describe, it, expect } from "vitest";
import {
  compileTimeline,
  shapeTimeline,
  adapt,
  getSignals,
} from "@/lib/engine";
import {
  getDefaultState,
  installPack,
  addBiomarker,
  saveDailyLog,
} from "@/lib/storage";
import {
  getAccess,
  getFreeBiomarkers,
  getFreePacks,
  getFreeInsightDays,
} from "@/lib/entitlements";
import { PACKS, STANDALONE_ATOMS_REGISTRY } from "@/lib/packs";
import {
  supplementsForBlock,
  supplementFromBehavior,
  isSupplementBehavior,
} from "@/lib/supplements";
import type { AppState, DailyLog, Supplement } from "@/lib/types";

// ── Deterministic time helpers ──────────────────────────────────

const T0 = new Date("2025-01-01T08:00:00Z").getTime();

function dayKey(dayNum: number): string {
  // dayNum=1 → 2025-01-01, dayNum=2 → 2025-01-02, etc.
  const d = new Date(T0 + (dayNum - 1) * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isoDayOf(dateStr: string): number {
  // Mon=0..Sun=6 (matches engine's daysActive convention)
  const j = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return j === 0 ? 6 : j - 1;
}

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

// Simple deterministic PRNG so the same day always produces the
// same completions for a given persona.
function makeRng(seedStr: string): () => number {
  let h = 1;
  for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

function simulateDay(
  state: AppState,
  dayNum: number,
  adherence: number,
  reflectChance: number
): DailyLog {
  const date = dayKey(dayNum);
  const idx = isoDayOf(date);
  const items = compileTimeline(state, idx);
  const log = emptyLog(date);
  const rng = makeRng(`priya:${dayNum}`);
  const bc: Record<string, boolean> = {};
  let done = 0;
  let active = 0;
  for (const it of items) {
    if (it.muted) continue;
    active++;
    if (rng() < adherence) {
      bc[it.canonicalKey] = true;
      done++;
    }
  }
  log.behaviorCompletions = bc;
  log.score = active > 0 ? Math.round((done / active) * 100) : 0;
  // ~20% reflection: a check-in (sleep + energy)
  if (rng() < reflectChance) {
    log.sleepLog = {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: 3,
      sleepDurationMinutes: null,
    };
    log.energyLevel = 3;
  }
  return log;
}

// ── Persona setup ───────────────────────────────────────────────

function makePriya(): AppState {
  let st = getDefaultState();
  // Onboarding choices: anticoagulants=true (NOT pregnant). Free tier.
  // Started reverse trial 120 days before "today" (day 365) — so by
  // day 15 the trial has lapsed for the assertions at day 30+.
  const trialEnd = new Date(T0 + 14 * 86_400_000).toISOString();
  st = {
    ...st,
    // Replace default ["longevity-foundation", "better-sleep"] with
    // her actual onboarding selection — only longevity-foundation.
    installedPacks: ["longevity-foundation"],
    settings: {
      ...st.settings,
      name: "Priya",
      safetyFlags: { pregnant: false, anticoagulants: true },
      completedOnboarding: true,
      tier: "free",
      premiumTrialEndsAt: trialEnd,
    },
  };
  return st;
}

function adherenceForDay(d: number): number {
  if (d <= 30) return d <= 7 ? 0.4 : 0.5;
  if (d <= 120) return 0.7;
  return 0.7;
}

// ── The simulation ───────────────────────────────────────────────

describe("persona: Priya the careful — 365-day free-tier stress test", () => {
  it("day 30 — early adherence builds, trial already expired", () => {
    let st = makePriya();
    for (let d = 1; d <= 30; d++) {
      const log = simulateDay(st, d, adherenceForDay(d), 0.2);
      st = saveDailyLog(st, log);
    }
    const dayLog = st.dailyLogs[st.dailyLogs.length - 1];
    const a = adapt(st);
    const s = getSignals(st);
    expect(dayLog.score).toBeGreaterThan(0);
    // hasHistory captures "is there any data" — the post-fix semantic
    // for the rebuild gate. trackedDays is now a 7-day window count,
    // which can be 0 here because the simulated days (Jan 2025) fall
    // outside the wall-clock 7-day window when the test runs later in
    // 2026. Use hasHistory for the "has she ever logged" check.
    expect(s.hasHistory).toBe(true);
    // Trial began at day 1 and ended at day 14 — by day 30 she's
    // long past the trial. She should be in `trialExpired` posture.
    const ax = getAccess(st);
    expect(ax.premium).toBe(false);
    expect(ax.paid).toBe(false);
    expect(ax.trialExpired).toBe(true);
    // Mode must be valid
    expect([
      "normal",
      "essentials",
      "recovery",
      "lighter",
      "primed",
      "rebuild",
    ]).toContain(a.mode);
  });

  it("biomarker free cap — addBiomarker silently allows the 4th add", () => {
    let st = makePriya();
    // Mature state — assume she's at day 90 with 3 biomarkers already.
    st = addBiomarker(st, { metric: "weight", value: 72, date: dayKey(31) });
    st = addBiomarker(st, { metric: "hrv", value: 45, date: dayKey(50) });
    st = addBiomarker(st, {
      metric: "restingHR",
      value: 62,
      date: dayKey(80),
    });
    expect(new Set(st.biomarkers.map((b) => b.metric)).size).toBe(3);
    // Now try to add a 4th distinct marker — at the free cap, should be
    // blocked.
    const before = st.biomarkers.length;
    st = addBiomarker(st, { metric: "vo2max", value: 46, date: dayKey(90) });
    const after = st.biomarkers.length;
    // EXPECTED behavior: cap enforced at the lib layer → after === before.
    // ACTUAL behavior: storage.ts addBiomarker has NO cap → after === before+1.
    // We document the actual behavior with a failing-style expectation
    // that surfaces the bug clearly.
    const access = getAccess(st);
    const distinctAfter = new Set(st.biomarkers.map((b) => b.metric)).size;
    expect(
      // Either the engine blocks the write (cap respected) OR distinct count
      // grows past the free cap. We test that the cap is enforced.
      distinctAfter <= getFreeBiomarkers() || access.premium,
      `BUG: addBiomarker allowed distinct metrics (${distinctAfter}) to exceed FREE_BIOMARKERS (${getFreeBiomarkers()}) for a non-premium user`
    ).toBe(true);
    // Also expect the row count not to have grown beyond the cap when
    // the user is free. If this fails, the bug is reproduced.
    expect(after, "BUG: 4th biomarker write was silently accepted").toBe(
      before
    );
  });

  it("pack free cap — installPack silently allows 4th official pack", () => {
    let st = makePriya();
    // She has 1 official pack installed already (longevity-foundation).
    expect(st.installedPacks).toEqual(["longevity-foundation"]);
    // Day 90 — install deep-focus (4th pack, but she only has 1 — SUCCEEDS).
    st = installPack(st, "deep-focus");
    expect(st.installedPacks).toContain("deep-focus");
    // Day 100 — install blood-sugar. Now at 3 packs (at cap).
    st = installPack(st, "blood-sugar");
    const officialIds = new Set(
      PACKS.filter((p) => p.source === "official").map((p) => p.id)
    );
    const officialInstalled = st.installedPacks.filter((id) =>
      officialIds.has(id)
    ).length;
    expect(officialInstalled).toBe(3);
    // Day 110 — try to install a 4th pack. Free cap = 3.
    const before = st.installedPacks.length;
    st = installPack(st, "cognitive-performance");
    const afterCount = st.installedPacks.filter((id) => officialIds.has(id))
      .length;
    const access = getAccess(st);
    // EXPECTED: cap enforced at lib layer — install rejected.
    // ACTUAL: installPack has NO cap check — addition succeeds silently.
    expect(
      afterCount <= getFreePacks() || access.premium,
      `BUG: installPack allowed official-pack count (${afterCount}) to exceed FREE_PACKS (${getFreePacks()}) for a free user`
    ).toBe(true);
    expect(
      st.installedPacks.length,
      "BUG: 4th pack install was silently accepted at lib layer"
    ).toBe(before);
  });

  it("safety flag: anticoagulants — omega-3 atom carries NO contraindications", () => {
    // The persona has anticoagulants set. The clinical reality is that
    // high-dose omega-3 is contraindicated for anticoagulant users
    // (bleeding-risk interaction). Verify whether the curated atom in
    // packs.ts encodes this.
    // omega-3 now lives in the standalone supplement library (protocols no
    // longer embed supplements); its contraindications must still be encoded.
    const omega3 = STANDALONE_ATOMS_REGISTRY.find(
      (b) => b.canonicalKey === "omega-3"
    );
    expect(omega3).toBeDefined();
    // EXPECTED: omega-3 atom should list "anticoagulants" in
    // contraindications. ACTUAL: it lists none.
    expect(
      omega3?.contraindications ?? [],
      `BUG: omega-3 atom in packs.ts has no contraindications — anticoagulants user is not protected via the safety-flag pipeline`
    ).toContain("anticoagulants");
  });

  it("safety flag: anticoagulants — supplement layer also fails to suppress omega-3", () => {
    // Even if a user adds omega-3 to their supplement stack (not auto-
    // installed; she'd have to add manually), the suppression chain
    // depends on s.contraindications being populated from the curated
    // atom. Verify that supplementFromBehavior carries it through.
    const omega3 = STANDALONE_ATOMS_REGISTRY.find(
      (b) => b.canonicalKey === "omega-3"
    )!;
    const supp: Supplement = supplementFromBehavior(omega3, "longevity-foundation");
    const blockList = supplementsForBlock(
      [supp],
      "anytime",
      0,
      { anticoagulants: true }
    );
    // EXPECTED: omega-3 filtered out → empty list. ACTUAL: contraindications
    // are undefined on the supplement, so the filter passes it through.
    expect(
      blockList.length,
      `BUG: supplementsForBlock returned omega-3 for an anticoagulants user (contraindications missing on the curated atom)`
    ).toBe(0);
  });

  it("safety flag: anticoagulants — timeline does NOT auto-suppress omega-3 (it's filtered as supplement anyway)", () => {
    // omega-3 is filtered out of compileTimeline because isSupplementBehavior
    // catches it (icon=fish, canonical key omega-3 in the supplement registry).
    // So she never sees it on the behavior timeline regardless. Document this
    // gap: the safety pipeline is bypassed because the atom is routed to
    // supplements first.
    const st = makePriya();
    const tl = compileTimeline(st, isoDayOf(dayKey(30)));
    const hasOmega = tl.some((it) => it.canonicalKey === "omega-3");
    expect(hasOmega).toBe(false); // confirmed routed away
    // But isSupplementBehavior identifies it correctly:
    const omega3 = STANDALONE_ATOMS_REGISTRY.find(
      (b) => b.canonicalKey === "omega-3"
    )!;
    expect(isSupplementBehavior(omega3)).toBe(true);
  });

  it("day 120 — biomarker-aware adapt is NOT gated by access.premium", () => {
    let st = makePriya();
    // Build up 120 days of logs.
    for (let d = 1; d <= 120; d++) {
      st = saveDailyLog(st, simulateDay(st, d, adherenceForDay(d), 0.2));
    }
    // Add a biomarker that signals concern (HRV very low → "Watch" band).
    // hrv: higher is better; watch band is < 40.
    // Use *today's* real date so getSignals' 30-day cutoff doesn't filter it
    // out — we're probing the gating logic, not the freshness window.
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    st = addBiomarker(st, { metric: "hrv", value: 28, date: todayKey });
    const access = getAccess(st);
    expect(access.premium).toBe(false);
    expect(access.trialExpired).toBe(true);
    const s = getSignals(st);
    const a = adapt(st);
    // Post-fix contract: biomarker-aware adapt is now Premium-gated.
    // bioConcern must be null for a non-premium expired-trial user
    // even when a "Watch"-band biomarker exists. The mode can still
    // shift via subjective signals (sleep, energy) but never via
    // bloodwork for a free user.
    expect(
      s.bioConcern,
      `bioConcern should be null for non-premium user — biomarker-aware adapt is Premium-only per CLAUDE.md`
    ).toBeNull();
    expect(s.bioRecoveryFlag).toBe(false);
    expect(a.mode).toBeDefined();
  });

  it("insights free delay — getFreeInsightDays() is now load-bearing (audit 2026-06-09)", () => {
    let st = makePriya();
    for (let d = 1; d <= 60; d++) {
      st = saveDailyLog(st, simulateDay(st, d, 0.6, 0.2));
    }
    const access = getAccess(st);
    expect(access.premium).toBe(false);
    // Reconciled: FREE_INSIGHT_DAYS is the free-tier insight DELAY (days behind
    // today), it equals the delay the insights page actually applies, and the
    // accessor is what the page reads — so changing it in CMS Config genuinely
    // moves the delay. (Was: a dead 7 that no runtime gate consulted.)
    expect(getFreeInsightDays()).toBe(3);
  });

  it("day 365 — adherence holds, score reasonable, mode lands in a healthy band", () => {
    let st = makePriya();
    // Install schedule: she adds deep-focus at day 100 and blood-sugar
    // at day 100 too (the persona spec says "Day 100: installs 2 more
    // packs"). At day 110 she tries to install a 4th — if the cap were
    // enforced this would no-op. We continue simulating with whatever
    // installPack actually does (so the failing cap test above also
    // pollutes this state slightly; that's the realistic outcome).
    for (let d = 1; d <= 365; d++) {
      if (d === 100) {
        st = installPack(st, "deep-focus");
        st = installPack(st, "blood-sugar");
      }
      if (d === 110) {
        // 4th pack attempt — installPack doesn't enforce cap, so this
        // WILL succeed. Captured here so the simulation reflects the
        // bug's downstream impact on the day-365 state.
        st = installPack(st, "cognitive-performance");
      }
      // Biomarkers along Priya's curve.
      if (d === 31)
        st = addBiomarker(st, {
          metric: "weight",
          value: 72,
          date: dayKey(d),
        });
      if (d === 50)
        st = addBiomarker(st, {
          metric: "hrv",
          value: 45,
          date: dayKey(d),
        });
      if (d === 80)
        st = addBiomarker(st, {
          metric: "restingHR",
          value: 62,
          date: dayKey(d),
        });
      // Day 90 — 4th-marker attempt; cap should block it.
      if (d === 90)
        st = addBiomarker(st, {
          metric: "vo2max",
          value: 46,
          date: dayKey(d),
        });
      st = saveDailyLog(st, simulateDay(st, d, adherenceForDay(d), 0.2));
    }
    const ax = getAccess(st);
    expect(ax.premium).toBe(false);
    expect(ax.trialExpired).toBe(true);
    // Signals come back without crashing. adherence7 may be null
    // when the test's fixed T0 puts all logs outside the wall-clock
    // 7-day window — that's the correct post-fix behavior, not a bug.
    const sig = getSignals(st);
    if (sig.adherence7 !== null) {
      expect(sig.adherence7).toBeGreaterThanOrEqual(0);
      expect(sig.adherence7).toBeLessThanOrEqual(100);
    }
    expect(sig.hasHistory).toBe(true);
    const a = adapt(st);
    expect([
      "normal",
      "essentials",
      "recovery",
      "lighter",
      "primed",
      "rebuild",
    ]).toContain(a.mode);
    // Distinct biomarkers — should be 3 if the cap worked, 4 because
    // it doesn't.
    const distinct = new Set(st.biomarkers.map((b) => b.metric)).size;
    // Document the actual behavior (intentional failing assertion).
    expect(
      distinct,
      `BUG fallout at day 365: distinct biomarker metrics = ${distinct}, expected <= ${getFreeBiomarkers()} for free user`
    ).toBeLessThanOrEqual(getFreeBiomarkers());
    // Pack count — should be <= 3 if cap worked.
    const officialIds = new Set(
      PACKS.filter((p) => p.source === "official").map((p) => p.id)
    );
    const officialCount = st.installedPacks.filter((id) =>
      officialIds.has(id)
    ).length;
    expect(
      officialCount,
      `BUG fallout at day 365: official pack count = ${officialCount}, expected <= ${getFreePacks()} for free user`
    ).toBeLessThanOrEqual(getFreePacks());
  });

  it("day-1 soft entry — first day after onboarding renders a timeline with no panics", () => {
    let st = makePriya();
    // Day 1: no logs yet. Compile + shape + adapt should all work.
    const today = dayKey(1);
    const items = compileTimeline(st, isoDayOf(today));
    expect(items.length).toBeGreaterThan(0);
    const a = adapt(st);
    expect(a.mode).toBeDefined();
    // With trackedDays=0 and gapDays=0, baselineAdapt should land
    // in "normal" (no signals to shift it).
    expect(a.mode).toBe("normal");
    const shaped = shapeTimeline(items, a.mode);
    expect(shaped.length).toBe(items.length);
    // Now: she completes a few items on day 1. Simulate it and check
    // that the next day she sees "normal" or "primed" (not "rebuild" —
    // she wasn't away).
    st = saveDailyLog(st, simulateDay(st, 1, 0.4, 0.4));
    // Day-2 view
    const tomorrow = dayKey(2);
    const a2 = adapt({
      ...st,
      // adapt uses *today* via dateKeyInTz — we can't change the clock,
      // but we can verify the persistent state didn't corrupt anything.
    });
    expect(a2.mode).toBeDefined();
    // The fact that adapt() reads the device clock for "today" makes
    // testing Day-N → Day-N+1 transitions awkward in a unit test —
    // documented limitation, not a bug per se.
    expect(tomorrow).not.toBe(today);
  });
});
