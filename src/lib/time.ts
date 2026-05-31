/**
 * time.ts — shared schedule/time helpers (no deps, no cycles).
 */
import type { TimeBlock } from "./types";

export function parseHM(hm: string): number {
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

/**
 * Effective clock time for a (possibly retimed) timeline item:
 * a user customTime wins; otherwise the anchor math.
 */
export function effectiveMinutes(
  item: {
    anchor: string;
    offsetMin: number;
    block: TimeBlock;
    customTime?: string;
  },
  settings: { wakeTime: string; bedtime: string }
): number | null {
  if (item.customTime) return parseHM(item.customTime);
  return resolveMinutes(item, settings);
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

export function currentBlock(settings: {
  wakeTime: string;
  bedtime: string;
}): TimeBlock {
  // Compute the user's current block by mapping "now" into a
  // wake-aligned frame: minutes elapsed since their most recent
  // wake (0..1439). This gives a single linear coordinate for
  // every time of day, including overnight.
  //
  // Why the rewrite: the old logic mapped pre-wake times to
  // (now + 1440) and ran them past every break, so anything before
  // wake fell into "evening." For a 4:30 AM session, that meant
  // the app showed yesterday's evening block as "NOW" when the
  // user was clearly starting a new day. Fix splits the overnight
  // window 60/40 — first 60% is winding-down ("evening"), last
  // 40% is pre-dawn ("morning") so a 4:30 AM user sees morning.
  const now = nowMinutes();
  const wake = parseHM(settings.wakeTime);
  let bed = parseHM(settings.bedtime);
  if (bed <= wake) bed += 1440;
  const dayLength = bed - wake;
  let sinceWake = now - wake;
  if (sinceWake < 0) sinceWake += 1440;

  const morningEnd = 300; // first 5h after wake
  const eveningStart = dayLength - 180; // last 3h before bed
  if (sinceWake < morningEnd) return "morning";
  if (sinceWake < eveningStart) return "afternoon";
  if (sinceWake < dayLength) return "evening";
  // Overnight: 60/40 split between bed and next wake.
  const nightLength = 1440 - dayLength;
  const sinceBed = sinceWake - dayLength;
  return sinceBed > nightLength * 0.6 ? "morning" : "evening";
}

/**
 * True during the dead-of-night: the user is PAST their bedtime but not yet
 * in the pre-dawn run-up to wake. currentBlock() still returns "evening"
 * here (kept for back-compat), but the Today surface should treat this as a
 * distinct "rest / the day is done" state — it must NOT resurrect the
 * finished evening block as the live "NOW", and must NOT promote a daytime
 * behavior as the Up Next action. Mirrors currentBlock's overnight branch:
 * isOvernight ⟺ that branch lands on the "evening" (first 60%) side. The
 * pre-dawn tail (early risers) stays "morning" and is NOT overnight.
 */
export function isOvernight(
  settings: { wakeTime: string; bedtime: string },
  now: number = nowMinutes()
): boolean {
  const wake = parseHM(settings.wakeTime);
  let bed = parseHM(settings.bedtime);
  if (bed <= wake) bed += 1440;
  const dayLength = bed - wake;
  let sinceWake = now - wake;
  if (sinceWake < 0) sinceWake += 1440;
  if (sinceWake < dayLength) return false; // still within the awake day
  const nightLength = 1440 - dayLength;
  const sinceBed = sinceWake - dayLength;
  return sinceBed <= nightLength * 0.6;
}
