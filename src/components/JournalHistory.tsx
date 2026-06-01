"use client";

/**
 * JournalHistory — a calm, scrollable trail of the days the user reflected
 * (the mood + one-line note from the evening reflection they already write).
 * The reflections were being collected but had no home to look back on; this
 * gives the trail a place. Pure + presentational.
 */
import { useMemo } from "react";
import type { DailyLog } from "@/lib/types";
import { Eyebrow } from "@/components/ui";

const MOOD = [
  { min: 4, label: "Good", color: "var(--vitality)" },
  { min: 3, label: "Okay", color: "var(--warm)" },
  { min: 1, label: "Rough", color: "var(--alert)" },
] as const;

function moodOf(level?: number | null) {
  if (level == null) return null;
  return MOOD.find((m) => level >= m.min) ?? MOOD[MOOD.length - 1];
}

function prettyDate(key: string) {
  // Anchor at noon UTC and format in UTC so the weekday/day reflects the
  // log's own calendar day, not the device tz (which would shift it by a day
  // for a traveler or across a DST jump).
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
  );
}

export default function JournalHistory({ logs }: { logs: DailyLog[] }) {
  const entries = useMemo(
    () =>
      [...logs]
        .filter((l) => (l.dayNote && l.dayNote.trim()) || l.moodLevel != null)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
    [logs]
  );

  if (entries.length < 2) return null;

  return (
    <div className="panel p-5">
      <Eyebrow color="var(--warm)">Your journal</Eyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        The days you reflected — a quiet record of how it actually went.
      </p>
      <div className="mt-4 flex flex-col gap-3.5">
        {entries.map((e) => {
          const m = moodOf(e.moodLevel);
          return (
            <div key={e.date} className="flex gap-3">
              <span
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: m?.color ?? "var(--surface-3)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text-2)]">
                    {prettyDate(e.date)}
                  </span>
                  {m && (
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </span>
                  )}
                </div>
                {e.dayNote && e.dayNote.trim() && (
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                    {e.dayNote.trim()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
