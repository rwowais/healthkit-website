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
