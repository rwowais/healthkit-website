/**
 * intel.ts — ambient intelligence layer.
 *
 * Time anchoring, current-block awareness, per-behavior streaks,
 * keystone-habit detection, and proactive (calm) suggestions.
 */
import type { AppState, DailyLog, TimeBlock } from "./types";
import { compileTimeline, type TimelineItem } from "./engine";
import { packById, PACKS } from "./packs";

// ── Time anchoring ────────────────────────────────────────────────

function parseHM(hm: string): number {
  const [h, m] = (hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Resolve a behavior's clock time from the user's wake/bed anchors. */
export function resolveMinutes(
  item: { anchor: string; offsetMin: number; block: TimeBlock },
  settings: { wakeTime: string; bedtime: string }
): number | null {
  if (item.block === "anytime") return null;
  const wake = parseHM(settings.wakeTime);
  let bed = parseHM(settings.bedtime);
  if (bed <= wake) bed += 1440; // bed after midnight
  const base = item.anchor === "bed" ? bed : wake;
  let t = base + item.offsetMin;
  t = ((t % 1440) + 1440) % 1440;
  return t;
}

export function fmtClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Which block the user is currently in, from their schedule. */
export function currentBlock(settings: {
  wakeTime: string;
  bedtime: string;
}): TimeBlock {
  const now = nowMinutes();
  const wake = parseHM(settings.wakeTime);
  let bed = parseHM(settings.bedtime);
  if (bed <= wake) bed += 1440;
  const n = now < wake ? now + 1440 : now;
  const morningEnd = wake + 300;
  const eveningStart = bed - 180;
  if (n < morningEnd) return "morning";
  if (n < eveningStart) return "afternoon";
  return "evening";
}

// ── Per-behavior streaks ──────────────────────────────────────────

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BehaviorStat {
  streak: number;
  last7: number;
}

export function behaviorStats(
  state: AppState,
  key: string
): BehaviorStat {
  const logs = new Map(state.dailyLogs.map((l) => [l.date, l]));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const log = logs.get(dateKey(d));
    const done = !!log?.behaviorCompletions?.[key];
    if (done) streak++;
    else if (i === 0) continue; // today not done yet — don't break
    else break;
  }
  let last7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (logs.get(dateKey(d))?.behaviorCompletions?.[key]) last7++;
  }
  return { streak, last7 };
}

// ── Keystone detection ────────────────────────────────────────────

export interface Keystone {
  key: string;
  title: string;
  delta: number; // % points higher on days done
}

export function keystone(state: AppState): Keystone | null {
  const logs = state.dailyLogs.filter((l) => l.score > 0);
  if (logs.length < 6) return null;
  const items = compileTimeline(state, 0);
  let best: Keystone | null = null;
  for (const it of items) {
    const done: number[] = [];
    const not: number[] = [];
    for (const l of logs) {
      (l.behaviorCompletions?.[it.canonicalKey] ? done : not).push(l.score);
    }
    if (done.length < 4 || not.length < 3) continue;
    const avg = (xs: number[]) =>
      xs.reduce((a, b) => a + b, 0) / xs.length;
    const delta = Math.round(avg(done) - avg(not));
    if (delta >= 8 && (!best || delta > best.delta)) {
      best = { key: it.canonicalKey, title: it.title, delta };
    }
  }
  return best;
}

// ── Adaptive suggestions ──────────────────────────────────────────

export type SuggestionAction =
  | { type: "install"; packId: string }
  | { type: "pause"; key: string }
  | { type: "none" };

export interface Suggestion {
  id: string;
  kind: "install" | "pause" | "progress";
  title: string;
  body: string;
  cta: string;
  action: SuggestionAction;
}

export function suggestions(state: AppState): Suggestion[] {
  const out: Suggestion[] = [];
  const installed = new Set(state.installedPacks ?? []);

  // 1. Sleep quality trending low → suggest Better Sleep
  const sq = state.dailyLogs
    .filter((l) => l.sleepLog?.sleepQuality != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((l) => l.sleepLog.sleepQuality as number);
  if (
    sq.length >= 4 &&
    sq.reduce((a, b) => a + b, 0) / sq.length <= 2.7 &&
    !installed.has("better-sleep")
  ) {
    out.push({
      id: "sug-sleep",
      kind: "install",
      title: "Your sleep keeps coming up short",
      body: "The Better Sleep protocol targets exactly this — light, temperature, and timing.",
      cta: "Install Better Sleep",
      action: { type: "install", packId: "better-sleep" },
    });
  }

  // 2. Chronically skipped behavior → offer to pause (kills guilt)
  const items = compileTimeline(state, 0);
  const activeDays = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (activeDays.length >= 5) {
    for (const it of items) {
      if (state.behaviorOverrides?.[it.canonicalKey]?.disabled) continue;
      const everDone = activeDays.some(
        (l) => l.behaviorCompletions?.[it.canonicalKey]
      );
      if (!everDone) {
        out.push({
          id: `sug-pause-${it.canonicalKey}`,
          kind: "pause",
          title: `“${it.title}” isn't landing`,
          body: "It's been skipped every recent day. Pausing it is not failure — it clears space for what works.",
          cta: "Pause this behavior",
          action: { type: "pause", key: it.canonicalKey },
        });
        break;
      }
    }
  }

  // 3. Consistently strong → suggest a progression pack
  const recent = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (
    recent.length >= 7 &&
    recent.reduce((a, b) => a + b.score, 0) / recent.length >= 80
  ) {
    const next = PACKS.find(
      (p) =>
        !installed.has(p.id) &&
        ["deep-focus", "blood-sugar", "burnout-recovery"].includes(p.id)
    );
    if (next) {
      out.push({
        id: "sug-progress",
        kind: "progress",
        title: "You've earned a new layer",
        body: `Your consistency is excellent. ${next.name} stacks cleanly on your current system — overlaps merge automatically.`,
        cta: `Explore ${next.name}`,
        action: { type: "install", packId: next.id },
      });
    }
  }

  return out.slice(0, 2);
}

export function packName(id: string): string {
  return packById(id)?.name ?? id;
}

/** Due-aware ordering helper for the live timeline. */
export function dueRank(
  it: TimelineItem,
  settings: { wakeTime: string; bedtime: string }
): number {
  const m = resolveMinutes(it, settings);
  if (m == null) return 9999; // anytime — lowest urgency
  const diff = m - nowMinutes();
  // overdue (negative) and near-future rank highest (smallest)
  return diff < 0 ? -diff * 0.4 : diff;
}
