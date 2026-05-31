"use client";

/**
 * ConsistencyCalendar — a calm, GitHub-style contribution grid of the days
 * the user showed up, over the last `weeks` weeks. Intensity = number of
 * completions that day (behaviors + supplements taken), bucketed into four
 * levels. It celebrates the PATTERN of showing up, not any single day — no
 * streak pressure, no precise % (a sparse system's full day reads the same
 * as a dense system's full day, honestly).
 *
 * Pure + presentational: reads DailyLogs (already in state) and renders. All
 * date math is timezone-aware via the same tz helpers the engine uses, so the
 * grid aligns to the user's local calendar week (Mon-first).
 */
import { useMemo } from "react";
import type { DailyLog } from "@/lib/types";
import { dateKeyInTz, addDaysToKey, dayIndexOfKeyInTz } from "@/lib/tz";
import { Eyebrow } from "@/components/ui";

function doneCount(log?: DailyLog): number {
  if (!log) return 0;
  const b = Object.values(log.behaviorCompletions ?? {}).filter(Boolean).length;
  const s = Object.values(log.supplementCompletions ?? {}).filter(
    Boolean
  ).length;
  return b + s;
}

function level(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

const FILL = [
  "var(--surface-2)",
  "color-mix(in srgb, var(--vitality) 32%, var(--surface-2))",
  "color-mix(in srgb, var(--vitality) 62%, var(--surface-2))",
  "var(--vitality)",
] as const;

export default function ConsistencyCalendar({
  logs,
  tz,
  weeks = 12,
}: {
  logs: DailyLog[];
  tz: string;
  weeks?: number;
}) {
  const grid = useMemo(() => {
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const today = dateKeyInTz(tz);
    const todayDow = dayIndexOfKeyInTz(tz, today); // Mon=0..Sun=6
    const mondayThisWeek = addDaysToKey(today, -todayDow);
    const cols: { key: string; count: number; future: boolean }[][] = [];
    let activeDays = 0;
    for (let c = 0; c < weeks; c++) {
      const colMonday = addDaysToKey(mondayThisWeek, -(weeks - 1 - c) * 7);
      const col: { key: string; count: number; future: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const key = addDaysToKey(colMonday, r);
        const count = doneCount(byDate.get(key));
        const future = key > today; // YYYY-MM-DD compares chronologically
        if (!future && count > 0) activeDays++;
        col.push({ key, count, future });
      }
      cols.push(col);
    }
    return { cols, activeDays };
  }, [logs, tz, weeks]);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <Eyebrow color="var(--vitality)">Your consistency</Eyebrow>
        <span className="text-[12px] font-semibold text-[var(--text-3)]">
          {grid.activeDays} active {grid.activeDays === 1 ? "day" : "days"}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        The days you showed up over the last {weeks} weeks. Consistency
        compounds — the pattern matters far more than any single day.
      </p>
      <div className="mt-4 flex gap-[3px] overflow-x-auto pb-1">
        {grid.cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <span
                key={cell.key}
                title={`${cell.key} · ${cell.count} done`}
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{
                  background: cell.future
                    ? "transparent"
                    : FILL[level(cell.count)],
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[11px] text-[var(--text-4)]">Less</span>
        {FILL.map((f, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-[3px]"
            style={{ background: f }}
          />
        ))}
        <span className="text-[11px] text-[var(--text-4)]">More</span>
      </div>
    </div>
  );
}
