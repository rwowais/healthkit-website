/**
 * Body-trends reduction: the bloodwork panel was removed from the
 * catalog, but a returning user may still carry old blood readings in
 * their stored state. Those must be INERT — never crash adaptation,
 * never surface a clinical claim — while the kept body markers (HRV,
 * resting HR) keep driving the live recovery signal. This is the
 * "don't break ever" + "still feels like it knows my data" guarantee
 * for the reduction.
 */
import { describe, it, expect } from "vitest";
import { BIOMARKERS, biomarkerDef } from "@/lib/biomarkers";
import { getSignals } from "@/lib/engine";
import { getDefaultState, addBiomarker } from "@/lib/storage";
import type { AppState } from "@/lib/types";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const DROPPED_BLOOD = [
  "apoB",
  "ldlC",
  "hdlC",
  "triglycerides",
  "fastingGlucose",
  "fastingInsulin",
  "hba1c",
  "hsCRP",
  "lpa",
  "omega3Index",
];

const premium = (): AppState => {
  const base = getDefaultState();
  return { ...base, settings: { ...base.settings, tier: "premium" } };
};

describe("biomarker reduction — body-only catalog", () => {
  it("catalog contains only body markers; every bloodwork key is gone", () => {
    expect(BIOMARKERS.length).toBeGreaterThan(0);
    expect(BIOMARKERS.every((b) => b.category === "body")).toBe(true);
    for (const k of DROPPED_BLOOD) {
      expect(biomarkerDef(k), `${k} should no longer resolve`).toBeUndefined();
    }
    // The kept signals that power live recovery adaptation survive.
    expect(biomarkerDef("hrv")).toBeTruthy();
    expect(biomarkerDef("restingHR")).toBeTruthy();
  });

  it("a stale bloodwork reading is inert — never crashes, never claims", () => {
    // Simulates a returning user whose state predates the reduction.
    const st = addBiomarker(premium(), {
      metric: "ldlC",
      value: 160, // would have been a "Watch" under the old panel
      date: todayKey(),
    });
    // The old reading is preserved in storage (non-destructive)…
    expect(st.biomarkers.some((b) => b.metric === "ldlC")).toBe(true);
    // …but it has no def now, so adaptation simply ignores it.
    const sig = getSignals(st);
    expect(sig.bioConcern).toBeNull();
    expect(sig.bioRecoveryFlag).toBe(false);
  });

  it("HRV in the Watch band still drives the recovery signal for premium", () => {
    let st = addBiomarker(premium(), {
      metric: "ldlC", // stale blood marker present alongside…
      value: 160,
      date: todayKey(),
    });
    st = addBiomarker(st, {
      metric: "hrv", // …a real, kept body marker in the Watch band
      value: 30, // hrv optimal 65 / watch 40 → 30 is "Watch"
      date: todayKey(),
    });
    const sig = getSignals(st);
    expect(sig.bioConcern).not.toBeNull();
    expect(sig.bioRecoveryFlag).toBe(true);
  });
});
