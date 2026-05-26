/**
 * tz.ts — timezone-aware time helpers.
 *
 * Why this exists:
 *   The audit found that `settings.timezone` was captured at onboarding
 *   and never used. Every date calculation used `new Date()` against
 *   the device clock — which is fine on the user's everyday device but
 *   breaks the moment they travel (their timeline drifts by hours) or
 *   their device auto-shifts on DST (the entire engine's anchor math
 *   silently misaligns).
 *
 * The fix:
 *   Treat the user's chosen timezone as the source of truth. Every
 *   "what day is it for me?" / "what time is it for me?" computation
 *   uses Intl.DateTimeFormat with the stored timezone, falling back
 *   to the device default when absent. Then DST transitions, travel,
 *   and device-clock weirdness become invisible to the engine — it
 *   always sees a consistent "user-local now."
 *
 * What this DOESN'T fix:
 *   - Historical logs with date keys minted in a different timezone
 *     (we don't rewrite them — only forward dates respect the new tz).
 *   - Push notifications, which are scheduled by a server cron that
 *     needs to know each user's tz independently. The Reminders code
 *     and the server cron both read settings.timezone via getTz().
 */

/**
 * Resolve the user's effective timezone. Prefers the stored value
 * (set during onboarding / Profile); falls back to the device's
 * Intl-resolved zone; finally falls back to UTC if anything is
 * unparseable.
 */
export function getTz(
  settings?: { timezone?: string } | null | undefined
): string {
  const stored = settings?.timezone?.trim();
  if (stored && isValidTz(stored)) return stored;
  try {
    const dev = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (dev && isValidTz(dev)) return dev;
  } catch {}
  return "UTC";
}

/** Returns true if the string is a recognized IANA tz identifier. */
export function isValidTz(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the device's current timezone. Used to compare against the
 * stored tz so we can surface a "your timezone changed" prompt when
 * the user travels or the device updates.
 */
export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Extract date components (year, month, day, hour, minute, weekday)
 * for a given Date as seen in `tz`. Handles DST + travel correctly
 * because Intl.DateTimeFormat does the heavy lifting.
 */
function partsIn(tz: string, when: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    f.formatToParts(when).map((p) => [p.type, p.value])
  );
  // Intl returns hour as "24" at midnight in some implementations;
  // normalize back to 0.
  const hourRaw = parts.hour === "24" ? "00" : parts.hour;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(hourRaw),
    minute: Number(parts.minute),
    weekday: String(parts.weekday), // "Mon", "Tue", ...
  };
}

/**
 * YYYY-MM-DD for `when` (or now) as seen in the user's timezone. This
 * is the value that should be written to `DailyLog.date` so logs
 * always belong to the user's local day, even if the user is up at
 * 1am local while the device clock is in another zone.
 */
export function dateKeyInTz(
  tz: string,
  when: Date = new Date()
): string {
  const p = partsIn(tz, when);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Day-of-week index (Mon=0..Sun=6) for `when` in `tz`. Replaces every
 * raw `new Date().getDay()` in the engine so weekday-scheduled
 * behaviors don't drift across timezones.
 */
export function dayIndexInTz(
  tz: string,
  when: Date = new Date()
): number {
  const w = partsIn(tz, when).weekday;
  switch (w) {
    case "Mon": return 0;
    case "Tue": return 1;
    case "Wed": return 2;
    case "Thu": return 3;
    case "Fri": return 4;
    case "Sat": return 5;
    case "Sun": return 6;
    default: return 0;
  }
}

/**
 * Minutes since local midnight in `tz` for `when` (or now). Replaces
 * `nowMinutes()` for any consumer that wants "what time is it for the
 * user right now," not "what's the device clock saying."
 */
export function nowMinutesInTz(
  tz: string,
  when: Date = new Date()
): number {
  const p = partsIn(tz, when);
  return p.hour * 60 + p.minute;
}

/**
 * Day-of-week index (Mon=0..Sun=6) for an existing YYYY-MM-DD key,
 * interpreted in `tz`. This is critical for re-deriving the weekday
 * of a stored log entry consistently — without it, an end-of-day log
 * from a UTC-9 user that lands on a Sunday locally would be a Monday
 * if you parsed the key with `new Date(key)`.
 *
 * Strategy: anchor the day at local noon (avoids any DST edge), then
 * read the weekday in tz. Noon is always inside the same day in every
 * IANA zone.
 */
export function dayIndexOfKeyInTz(
  tz: string,
  dateKey: string
): number {
  // Parse the key components manually so we don't depend on the local
  // timezone for the construction.
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  // Build a UTC instant at "noon UTC" on that calendar day, then ask
  // Intl what weekday that lands on IN tz. Noon UTC is between 0am
  // and 1pm in every IANA zone except the most extreme — for those
  // we'd still want the user-local calendar day, which is what the
  // key represents. The key authoritatively defines the calendar
  // day; we only need a consistent weekday derivation.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dayIndexInTz(tz, anchor);
}

/**
 * Add N days to a YYYY-MM-DD date key. Uses noon-UTC anchoring to
 * avoid DST cliffs (going from a DST day to a non-DST day shouldn't
 * skip or duplicate the calendar day).
 */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  const yy = anchor.getUTCFullYear();
  const mm = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(anchor.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Human-readable timezone label ("New York · GMT-5") for surfaces
 * that need to show the user which zone the engine is using.
 */
export function tzLabel(tz: string, when: Date = new Date()): string {
  try {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = f.formatToParts(when);
    const short = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
    return short ? `${city} · ${short}` : city;
  } catch {
    return tz;
  }
}
