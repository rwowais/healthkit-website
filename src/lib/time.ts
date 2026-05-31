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

/**
 * Clock-based day block for a minutes-since-midnight value (0..1439).
 * The day is split by the CLOCK, not by wake time:
 *   Morning    5:00am – 11:59am
 *   Afternoon  12:00pm – 4:59pm
 *   Evening    5:00pm onward, incl. the late-night wind-down before 5am
 * so a behavior always sits under the section that matches the time it's
 * shown at (an 11:30am item is "morning", a 12:30pm item is "afternoon").
 * Never returns "anytime" — callers handle untimed items separately.
 */
export function blockForMinutes(min: number): TimeBlock {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  if (m >= 300 && m < 720) return "morning"; // 5:00am – 11:59am
  if (m >= 720 && m < 1020) return "afternoon"; // 12:00pm – 4:59pm
  return "evening"; // 5:00pm – 4:59am
}

/**
 * The user's current day block — CLOCK-BASED (see blockForMinutes). This
 * is the live "NOW" block on Today, and it deliberately uses the SAME
 * clock split as the section a behavior is filed under, so the section
 * header and the NOW highlight can never disagree (an 11:30am item and
 * the NOW marker are both "morning").
 *
 * The post-bedtime "rest / the day is done" state is a SEPARATE concern,
 * handled by isOvernight(); when that's true the Today surface shows the
 * rest state and ignores this value for the NOW highlight.
 *
 * `settings` is accepted for call-site stability (every caller already
 * passes it) and possible future schedule-aware tweaks; the clock split
 * itself needs only the time. `now` is minutes since local midnight — a
 * caller in another timezone (Today passes nowMinutesInTz) supplies a
 * tz-aware value so the block matches the user's actual local time.
 */
export function currentBlock(
  settings: { wakeTime: string; bedtime: string },
  now: number = nowMinutes()
): TimeBlock {
  void settings;
  return blockForMinutes(now);
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
