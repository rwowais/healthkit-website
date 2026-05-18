/**
 * metrics.ts — SINGLE SOURCE OF TRUTH for all derived health metrics.
 *
 * Hard rule: never fabricate a number from defaults. If the inputs that
 * feed a metric are absent, the metric is `null` and the UI must show an
 * empty / cold-start state — not an alarming low score.
 */
import type { DailyLog, Pillar } from "./types";

export const PILLAR_LIST: Pillar[] = [
  "sleep",
  "exercise",
  "nutrition",
  "supplements",
];

// ── Presence checks ───────────────────────────────────────────────

export function sleepDurationMinutes(log: DailyLog): number | null {
  const { actualBedtime, actualWakeTime } = log.sleepLog;
  if (!actualBedtime || !actualWakeTime) return null;
  const [bh, bm] = actualBedtime.split(":").map(Number);
  const [wh, wm] = actualWakeTime.split(":").map(Number);
  let d = wh * 60 + wm - (bh * 60 + bm);
  if (d <= 0) d += 1440;
  return d;
}

export function pillarTracked(log: DailyLog, p: Pillar): boolean {
  if (p === "sleep") return log.sleepCompletions.some((c) => c.completed);
  if (p === "exercise") return log.exerciseEntries.some((e) => e.completed);
  if (p === "nutrition") {
    const sc = log.nutritionScorecard;
    return (
      [
        sc.hitProteinTarget,
        sc.ateFruitsVeggies,
        sc.stayedHydrated,
        sc.avoidedProcessedSugar,
        sc.finishedEatingOnTime,
        sc.minimizedAlcohol,
      ].some((v) => v != null) || sc.customItems.some((c) => c.answer != null)
    );
  }
  return log.supplementEntries.some((s) => s.taken || s.skipped);
}

export function hasAnyTracking(log: DailyLog): boolean {
  return (
    PILLAR_LIST.some((p) => pillarTracked(log, p)) ||
    log.energyLevel != null ||
    log.moodLevel != null ||
    sleepDurationMinutes(log) != null ||
    log.sleepLog.sleepQuality != null
  );
}

// ── Pillar scores (null when that pillar untouched) ───────────────

export function pillarScore(log: DailyLog, p: Pillar): number | null {
  if (p === "sleep") {
    // Empty-log arrays are pre-seeded, so gate on real engagement.
    if (log.sleepCompletions.length === 0 || !pillarTracked(log, "sleep"))
      return null;
    const done = log.sleepCompletions.filter((c) => c.completed).length;
    return Math.round((done / log.sleepCompletions.length) * 100);
  }
  if (p === "exercise") {
    if (log.exerciseEntries.length === 0 || !pillarTracked(log, "exercise"))
      return null;
    const done = log.exerciseEntries.filter((e) => e.completed).length;
    return Math.round((done / log.exerciseEntries.length) * 100);
  }
  if (p === "nutrition") {
    const sc = log.nutritionScorecard;
    const all = [
      sc.hitProteinTarget,
      sc.ateFruitsVeggies,
      sc.stayedHydrated,
      sc.avoidedProcessedSugar,
      sc.finishedEatingOnTime,
      sc.minimizedAlcohol,
      ...sc.customItems.map((c) => c.answer),
    ];
    const answered = all.filter((a) => a != null);
    if (answered.length === 0) return null;
    let pts = 0;
    for (const a of answered) {
      if (a === "yes") pts += 1;
      else if (a === "mostly") pts += 0.6;
    }
    return Math.round((pts / answered.length) * 100);
  }
  if (log.supplementEntries.length === 0) return null;
  if (!pillarTracked(log, "supplements")) return null;
  const taken = log.supplementEntries.filter((s) => s.taken).length;
  return Math.round((taken / log.supplementEntries.length) * 100);
}

export function pillarScoresSafe(
  log: DailyLog
): Record<Pillar, number | null> {
  return {
    sleep: pillarScore(log, "sleep"),
    exercise: pillarScore(log, "exercise"),
    nutrition: pillarScore(log, "nutrition"),
    supplements: pillarScore(log, "supplements"),
  };
}

// ── Composite metrics (null = cold start, show empty state) ───────

/** Adherence = avg of pillars that were actually engaged with. */
export function adherenceScore(log: DailyLog): number | null {
  const vals = PILLAR_LIST.map((p) => pillarScore(log, p)).filter(
    (v): v is number => v != null
  );
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Recovery — weighted blend of the *present* inputs only, renormalized.
 * null if none of energy / mood / sleep signal exist.
 */
export function recoveryScore(log: DailyLog): number | null {
  const parts: { v: number; w: number }[] = [];
  if (log.energyLevel != null)
    parts.push({ v: (log.energyLevel / 5) * 100, w: 0.4 });
  if (log.moodLevel != null)
    parts.push({ v: (log.moodLevel / 5) * 100, w: 0.25 });
  const sp = pillarScore(log, "sleep");
  const dur = sleepDurationMinutes(log);
  if (sp != null) parts.push({ v: sp, w: 0.2 });
  if (log.sleepLog.sleepQuality != null)
    parts.push({ v: (log.sleepLog.sleepQuality / 5) * 100, w: 0.25 });
  if (dur != null)
    parts.push({ v: Math.min(100, (dur / 480) * 100), w: 0.2 });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / wSum);
}

/**
 * Sleep score — duration (vs 8h) + adherence + consistency, present-only.
 * null if no sleep signal at all.
 */
export function sleepScore(
  log: DailyLog,
  consistency?: number | null
): number | null {
  const parts: { v: number; w: number }[] = [];
  const dur = sleepDurationMinutes(log);
  if (dur != null)
    parts.push({ v: Math.max(0, Math.min(100, (dur / 480) * 100)), w: 0.5 });
  if (log.sleepLog.sleepQuality != null)
    parts.push({ v: (log.sleepLog.sleepQuality / 5) * 100, w: 0.25 });
  const sp = pillarScore(log, "sleep");
  if (sp != null) parts.push({ v: sp, w: 0.3 });
  if (consistency != null) parts.push({ v: consistency, w: 0.2 });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / wSum);
}

/** Readiness — top-line composite. null until something is tracked. */
export function readinessScore(log: DailyLog): number | null {
  const parts: { v: number; w: number }[] = [];
  const sp = pillarScore(log, "sleep");
  const ad = adherenceScore(log);
  if (sp != null) parts.push({ v: sp, w: 0.3 });
  if (ad != null) parts.push({ v: ad, w: 0.35 });
  if (log.energyLevel != null)
    parts.push({ v: (log.energyLevel / 5) * 100, w: 0.2 });
  if (log.moodLevel != null)
    parts.push({ v: (log.moodLevel / 5) * 100, w: 0.15 });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(
    Math.min(100, parts.reduce((s, p) => s + p.v * p.w, 0) / wSum)
  );
}

/** Bedtime-consistency over a set of logs (0-100) or null if <2 nights. */
export function bedtimeConsistency(logs: DailyLog[]): number | null {
  const mins = logs
    .map((l) => l.sleepLog.actualBedtime)
    .filter((b): b is string => !!b)
    .map((b) => {
      const [h, m] = b.split(":").map(Number);
      return h * 60 + m;
    });
  if (mins.length < 2) return null;
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
  const sd = Math.sqrt(
    mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length
  );
  return Math.max(0, Math.round(100 - (sd / 60) * 25));
}

// ── Qualitative bands (shared, calm language) ─────────────────────

export function band(n: number): string {
  if (n >= 85) return "Optimal";
  if (n >= 70) return "Strong";
  if (n >= 50) return "Fair";
  if (n >= 30) return "Building";
  return "Needs Focus";
}

export function bandColor(n: number): string {
  if (n >= 85) return "var(--vitality)";
  if (n >= 70) return "var(--readiness)";
  if (n >= 50) return "var(--warm)";
  return "var(--alert)";
}
