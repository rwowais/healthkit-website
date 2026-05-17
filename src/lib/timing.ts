import type { ProtocolItem, TimeOfDay, UserSettings } from "./types";

/**
 * Convert "HH:MM" string to minutes since midnight.
 */
export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to "HH:MM" string.
 * Handles overflow past midnight (wraps at 1440).
 */
export function minutesToTimeString(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Format 24h time string to 12h display format.
 * "14:30" -> "2:30 PM", "00:00" -> "12:00 AM"
 */
export function formatDisplayTime(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Calculate the actual display time for a protocol item based on its
 * timing anchor (wake/bed/fixed) and offset.
 */
export function calculateDisplayTime(
  item: ProtocolItem,
  settings: UserSettings
): string {
  if (item.timingAnchor === "fixed" && item.fixedTime) {
    return item.fixedTime;
  }

  const anchorTime =
    item.timingAnchor === "wake"
      ? timeStringToMinutes(settings.wakeTime)
      : timeStringToMinutes(settings.bedtime);

  const totalMinutes = anchorTime + item.timingOffsetMinutes;
  return minutesToTimeString(totalMinutes);
}

/**
 * Classify a 24h time string into a time-of-day bucket.
 * Morning: 5:00-11:59, Afternoon: 12:00-16:59,
 * Evening: 17:00-20:59, Night: 21:00-4:59
 */
export function deriveTimeOfDay(time24: string): TimeOfDay {
  const minutes = timeStringToMinutes(time24);
  const hour = Math.floor(minutes / 60);

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/**
 * Sort protocol items by their computed display time (earliest first).
 */
export function sortByTime(
  items: ProtocolItem[],
  settings: UserSettings
): ProtocolItem[] {
  return [...items].sort((a, b) => {
    const timeA = calculateDisplayTime(a, settings);
    const timeB = calculateDisplayTime(b, settings);
    const minutesA = timeStringToMinutes(timeA);
    const minutesB = timeStringToMinutes(timeB);

    // Items before 5 AM are considered "late night" and sort after 9 PM items
    const adjustedA = minutesA < 300 ? minutesA + 1440 : minutesA;
    const adjustedB = minutesB < 300 ? minutesB + 1440 : minutesB;

    if (adjustedA !== adjustedB) return adjustedA - adjustedB;
    return a.sortOrder - b.sortOrder;
  });
}
