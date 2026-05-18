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
  if (withSleep.length >= 3 && withoutSleep.length >= 3) {
    const diff = Math.round(avg(withSleep) - avg(withoutSleep));
    if (diff >= 6) {
      out.push(
        `Your recovery runs ${diff} points higher on days you complete your sleep protocol. It's your strongest lever right now.`
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
          `You're trending up — your weekly average climbed ${d} points. Whatever you changed is working.`
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
  const dows = Object.entries(byDow).filter(([, v]) => v.length >= 2);
  if (dows.length >= 4) {
    const best = dows.sort((a, b) => avg(b[1]) - avg(a[1]))[0];
    const worst = dows.sort((a, b) => avg(a[1]) - avg(b[1]))[0];
    const names = [
      "Sundays",
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
    ];
    if (avg(best[1]) - avg(worst[1]) >= 12) {
      out.push(
        `${names[+best[0]]} are your strongest days; ${
          names[+worst[0]]
        } your weakest. Pre-plan the weak day to smooth your week.`
      );
    }
  }

  return out;
}

export function topInsight(logs: DailyLog[]): string | null {
  return derivedInsights(logs)[0] ?? null;
}

export { adherenceScore };
