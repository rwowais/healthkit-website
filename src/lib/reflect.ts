/**
 * reflect.ts — the longitudinal "personal model".
 *
 * Personalization the user can SEE compounding: traits inferred from
 * their own history (where their leverage is, how fragile they are under
 * stress, their strongest anchor, the trend) plus a calm monthly
 * identity reflection. This is the lock-in that isn't in the export —
 * a relationship, not a data dump. Honest: nothing is shown until
 * there's enough signal to mean it.
 */
import type { AppState, DailyLog, TimeBlock } from "./types";
import { compileTimeline } from "./engine";
import { behaviorStats } from "./intel";
import type { IconName } from "@/components/ui/icons";

export interface Trait {
  icon: IconName;
  label: string;
  detail: string;
}

function isoDayOf(s: string) {
  const j = new Date(s + "T00:00:00").getDay();
  return j === 0 ? 6 : j - 1;
}
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

function activeLogs(state: AppState): DailyLog[] {
  return (state.dailyLogs ?? []).filter(
    (l) =>
      l.score > 0 ||
      Object.values(l.behaviorCompletions ?? {}).some(Boolean) ||
      l.energyLevel != null ||
      l.sleepLog?.sleepQuality != null
  );
}

/** Traits — only the ones the data can actually support. */
export function personalModel(state: AppState): Trait[] {
  const logs = activeLogs(state);
  if (logs.length < 12) return [];
  const out: Trait[] = [];

  // 1. Where the user's leverage is (best-completed daypart).
  const blocks: TimeBlock[] = ["morning", "afternoon", "evening"];
  const rates: Record<string, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const l of logs) {
    const items = compileTimeline(state, isoDayOf(l.date));
    for (const b of blocks) {
      const inB = items.filter((i) => i.block === b);
      if (inB.length === 0) continue;
      const done = inB.filter(
        (i) => l.behaviorCompletions?.[i.canonicalKey]
      ).length;
      rates[b].push(done / inB.length);
    }
  }
  const blockMean = blocks
    .map((b) => ({ b, m: mean(rates[b]), n: rates[b].length }))
    .filter((x) => x.n >= 6)
    .sort((a, b) => b.m - a.m);
  if (
    blockMean.length >= 2 &&
    blockMean[0].m - blockMean[blockMean.length - 1].m >= 0.18
  ) {
    const top = blockMean[0].b;
    // "afternoon"/"evening" take "an"; "morning" takes "a".
    const article = /^[aeiou]/.test(top) ? "an" : "a";
    out.push({
      icon: top === "evening" ? "moon" : "sun",
      label: `You're ${article} ${top}-leverage person`,
      detail: `Your ${top} behaviors stick the most — that's where to protect first.`,
    });
  }

  // 2. Fragility under low recovery.
  const low: number[] = [];
  const normal: number[] = [];
  for (const l of logs) {
    const sq = l.sleepLog?.sleepQuality ?? null;
    const en = l.energyLevel ?? null;
    if (sq == null && en == null) continue;
    ((sq != null && sq <= 2) || (en != null && en <= 2)
      ? low
      : normal
    ).push(l.score);
  }
  if (low.length >= 4 && normal.length >= 6) {
    const drop = mean(normal) - mean(low);
    if (drop >= 18)
      out.push({
        icon: "pulse",
        label: "Fragile on low-recovery days",
        detail: `When sleep or energy is low your routine drops ~${Math.round(
          drop
        )} points — easing those days is the right call, not a failure.`,
      });
    else if (drop <= 8)
      out.push({
        icon: "pulse",
        label: "Resilient under stress",
        detail:
          "You hold your routine even on rough days — a rare, durable strength.",
      });
  }

  // 3. Strongest anchor.
  let anchor: { title: string; streak: number } | null = null;
  for (const it of compileTimeline(state, 0)) {
    const { streak } = behaviorStats(state, it.canonicalKey);
    if (!anchor || streak > anchor.streak)
      anchor = { title: it.title, streak };
  }
  if (anchor && anchor.streak >= 5)
    out.push({
      icon: "flame",
      label: `Your anchor is "${anchor.title}"`,
      detail: `${anchor.streak} days running — the thread the rest of your system hangs on.`,
    });

  // 4. Trend (last 30 vs prior 30).
  const scored = (state.dailyLogs ?? []).filter((l) => l.score > 0);
  const today = new Date();
  const inRange = (l: DailyLog, from: number, to: number) => {
    const diff = Math.round(
      (today.setHours(0, 0, 0, 0) -
        new Date(l.date + "T00:00:00").getTime()) /
        86400000
    );
    return diff >= from && diff < to;
  };
  const recent = scored.filter((l) => inRange(l, 0, 30)).map((l) => l.score);
  const prior = scored.filter((l) => inRange(l, 30, 60)).map((l) => l.score);
  if (recent.length >= 8 && prior.length >= 8) {
    const d = Math.round(mean(recent) - mean(prior));
    if (d >= 6)
      out.push({
        icon: "sparkle",
        label: "Trending up",
        detail: `Your last month is ${d} points stronger than the one before. Compounding is real.`,
      });
    else if (d <= -6)
      out.push({
        icon: "sparkle",
        label: "Easing off lately",
        detail: `Down ${Math.abs(
          d
        )} from the prior month — not a verdict, a signal to simplify.`,
      });
  }

  return out.slice(0, 4);
}

export interface Identity {
  headline: string;
  body: string;
}

/** A calm monthly "who you've become" — the identity loop. */
export function identityReflection(state: AppState): Identity | null {
  const logs = activeLogs(state);
  if (logs.length < 21) return null;

  const last30 = logs.filter((l) => {
    const diff = Math.round(
      (Date.now() - new Date(l.date + "T00:00:00").getTime()) / 86400000
    );
    return diff >= 0 && diff < 30;
  });
  const activeDays = new Set(last30.map((l) => l.date)).size;
  if (activeDays < 12) return null;

  const traits = personalModel(state);
  const anchor = traits.find((t) => t.label.startsWith("Your anchor"));
  const name = state.settings?.name?.trim();

  const headline = name
    ? `Who you've become, ${name}`
    : "Who you've become";
  const anchorPhrase = anchor
    ? ` ${anchor.label.replace("Your anchor is", "Your anchor stayed")} —`
    : "";
  const body =
    `Over the last month you showed up ${activeDays} days.` +
    `${anchorPhrase} this isn't a streak to protect anxiously — it's ` +
    `evidence of the kind of person you're quietly becoming. The system ` +
    `held; you did the work.`;
  return { headline, body };
}
