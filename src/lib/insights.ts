/**
 * insights.ts — lightweight, data-driven correlation engine.
 * Only emits an insight when there is enough signal to be honest about it.
 */
import type { DailyLog } from "./types";
import { pillarScore, recoveryScore, adherenceScore } from "./metrics";

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function derivedInsights(logs: DailyLog[]): string[] {
  const tracked = logs.filter((l) => l.score > 0);
  if (tracked.length < 7) return [];

  const out: string[] = [];

  // 1. Sleep-protocol → recovery correlation
  const withSleep: number[] = [];
  const withoutSleep: number[] = [];
  for (const l of tracked) {
    const sp = pillarScore(l, "sleep");
    const rec = recoveryScore(l);
    if (sp == null || rec == null) continue;
    (sp >= 70 ? withSleep : withoutSleep).push(rec);
  }
  // Honest gate: ≥8 samples per bucket and a ≥8-point spread before naming a
  // pattern (matches the rest of the intelligence layer). And NO superlative /
  // causal "strongest lever" claim — that competed with the rigorously-gated
  // keystone on the same screen and asserted causation from a correlation.
  if (withSleep.length >= 8 && withoutSleep.length >= 8) {
    const diff = Math.round(avg(withSleep) - avg(withoutSleep));
    if (diff >= 8) {
      out.push(
        `On days you complete your sleep protocol, your recovery tends to run about ${diff} points higher — a pattern worth noticing, not proof.`
      );
    }
  }

  // 2. Trend direction (last 7 vs prior 7)
  const sorted = [...tracked].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length >= 10) {
    const last7 = avg(sorted.slice(-7).map((l) => l.score));
    const prev = avg(sorted.slice(-14, -7).map((l) => l.score));
    if (prev > 0) {
      const d = Math.round(last7 - prev);
      if (d >= 5)
        out.push(
          `You're trending up — your weekly average climbed ${d} points over the last week.`
        );
      else if (d <= -5)
        out.push(
          `Your weekly average slipped ${Math.abs(
            d
          )} points. A small reset on consistency this week will turn it around.`
        );
    }
  }

  // 3. Best weekday
  const byDow: Record<number, number[]> = {};
  for (const l of tracked) {
    const dow = new Date(l.date + "T00:00:00").getDay();
    (byDow[dow] ??= []).push(l.score);
  }
  // Only claim a weekday pattern with real signal: enough total history,
  // ≥3 samples per weekday, ≥5 weekdays represented, and a large gap.
  const dows = Object.entries(byDow)
    .filter(([, v]) => v.length >= 3)
    .map(([d, v]) => ({ d: +d, m: avg(v) }))
    .sort((a, b) => b.m - a.m);
  if (tracked.length >= 14 && dows.length >= 5) {
    const best = dows[0];
    const worst = dows[dows.length - 1];
    const names = [
      "Sundays",
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
    ];
    if (best.m - worst.m >= 15) {
      out.push(
        `${names[best.d]} are your strongest days; ${names[worst.d]} your weakest. Pre-plan the weak day to smooth your week.`
      );
    }
  }

  return out;
}

export function topInsight(logs: DailyLog[]): string | null {
  return derivedInsights(logs)[0] ?? null;
}

export { adherenceScore };
