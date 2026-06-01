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

/**
 * Is a minutes-since-midnight time inside the user's quiet-hours window?
 * The window {start,end} is "HH:MM" and may wrap past midnight (e.g.
 * 22:00→07:00). Used to suppress reminders during do-not-disturb. An empty
 * or degenerate (start === end) window means "no quiet hours".
 */
export function inQuietHours(
  min: number,
  quietHours?: { start: string; end: string }
): boolean {
  if (!quietHours || !quietHours.start || !quietHours.end) return false;
  const s = parseHM(quietHours.start);
  const e = parseHM(quietHours.end);
  if (s === e) return false;
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * The day block for a clock time (minutes since midnight 0..1439), given
 * the user's wake/bed schedule.
 *
 * WAKING HOURS are split purely by the CLOCK — intuitive and wake-time
 * independent:
 *   Morning    5:00am – 11:59am
 *   Afternoon  12:00pm – 4:59pm
 *   Evening    5:00pm until bedtime (incl. a late night spent still awake)
 * so a behavior sits under the section that matches the time it's shown at
 * (11:30am → Morning, 12:30pm → Afternoon).
 *
 * The SLEEP window (past bedtime, before the next wake) is the only place
 * the schedule matters: the clock alone can't tell a late-night wind-down
 * from a pre-dawn run-up — only your bedtime/wake can. We split that window
 * 60/40 (wind-down tail → evening, pre-dawn → morning), matching
 * isOvernight(). In practice Today shows the "rest" state for those hours,
 * so this label only surfaces for a behavior actually scheduled in the
 * small hours — where it's now correct (a midnight wind-down reads as
 * evening; 5am reads as morning) instead of contradictory.
 *
 * Never returns "anytime" — callers handle untimed items separately.
 */
/** Settings shape the block helpers read. `blockBoundaries` is optional —
 *  absent (or invalid) falls back to the defaults 05:00 / 12:00 / 17:00. */
type BlockSettings = {
  wakeTime: string;
  bedtime: string;
  blockBoundaries?: { morning: string; afternoon: string; evening: string };
};

/** Resolve the three daytime block start-minutes, defaulting to
 *  05:00 / 12:00 / 17:00 and only honoring custom values when they're
 *  strictly ascending (a malformed set silently falls back to defaults). */
export function resolveBlockBounds(settings: {
  wakeTime?: string;
  bedtime?: string;
  blockBoundaries?: { morning: string; afternoon: string; evening: string };
}): { morning: number; afternoon: number; evening: number } {
  const d = { morning: 300, afternoon: 720, evening: 1020 };
  const bb = settings.blockBoundaries;
  if (!bb) return d;
  const mo = parseHM(bb.morning);
  const af = parseHM(bb.afternoon);
  const ev = parseHM(bb.evening);
  // Ascending + in-range (guards malformed/out-of-range values too).
  if (!(mo >= 0 && mo < af && af < ev && ev < 1440)) return d;
  // For a normal same-day awake window (wake before bed), the afternoon and
  // evening starts must fall inside it so every block stays reachable while
  // awake — otherwise an ascending-but-degenerate set (e.g. an evening
  // boundary past bedtime, or all three before wake) would silently collapse
  // the whole day into one block. Wrap schedules (bed past midnight) skip
  // this extra check rather than risk a wrong rejection.
  if (settings.wakeTime && settings.bedtime) {
    const wake = parseHM(settings.wakeTime);
    const bed = parseHM(settings.bedtime);
    if (bed > wake && !(af > wake && ev < bed)) return d;
  }
  return { morning: mo, afternoon: af, evening: ev };
}

/**
 * A representative "HH:MM" clock time for a block — its start boundary. Used
 * when a behavior is MOVED into a block (via the WHEN picker / Today move /
 * drag) so it shows a time that actually sits in the new block, instead of
 * keeping a stale clock time from where it used to live. Returns undefined for
 * "anytime" (those carry no clock).
 */
export function blockStartClock(
  block: TimeBlock,
  settings: BlockSettings
): string | undefined {
  if (block === "anytime") return undefined;
  const start = resolveBlockBounds(settings)[block];
  const h = Math.floor(start / 60);
  const m = start % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockForMinutes(min: number, settings: BlockSettings): TimeBlock {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const wake = parseHM(settings.wakeTime);
  let bed = parseHM(settings.bedtime);
  if (bed <= wake) bed += 1440;
  // Place m on the same [wake, wake+1440) timeline to test awake vs asleep.
  const t = m < wake ? m + 1440 : m;
  if (t >= bed) {
    // Sleep window — judge by proximity to bed vs the next wake.
    const night = wake + 1440 - bed;
    const sinceBed = t - bed;
    return sinceBed > night * 0.6 ? "morning" : "evening";
  }
  // Awake — pure clock, split by the (configurable) block boundaries.
  // Anything before the morning boundary while awake is the evening
  // wind-down / pre-dawn tail.
  const b = resolveBlockBounds(settings);
  if (m >= b.morning && m < b.afternoon) return "morning";
  if (m >= b.afternoon && m < b.evening) return "afternoon";
  return "evening";
}

/**
 * The user's current day block (see blockForMinutes). This is the live
 * "NOW" block on Today, and it uses the SAME rule as the section a behavior
 * is filed under, so the header and the NOW highlight can never disagree
 * (an 11:30am item and the NOW marker are both "morning").
 *
 * The post-bedtime "rest / the day is done" state is a SEPARATE concern,
 * handled by isOvernight(); when that's true the Today surface shows the
 * rest state and ignores this value for the NOW highlight.
 *
 * `now` is minutes since local midnight — a caller in another timezone
 * (Today passes nowMinutesInTz) supplies a tz-aware value so the block
 * matches the user's actual local time, not the device clock.
 */
export function currentBlock(
  settings: BlockSettings,
  now: number = nowMinutes()
): TimeBlock {
  return blockForMinutes(now, settings);
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
