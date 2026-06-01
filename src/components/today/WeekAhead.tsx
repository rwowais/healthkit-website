"use client";

/**
 * WeekAhead — the next seven days of the protocol at a glance, so the user can
 * plan around travel/events. Today is single-day; this is the planning view.
 * Compiles the timeline per upcoming weekday (so N×/week behaviors land on
 * their real days) and lists each day's scheduled actions. Pure read.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { compileTimeline } from "@/lib/engine";
import { isActionable } from "@/lib/intel";
import { effectiveMinutes, fmtClock } from "@/lib/time";
import {
  getTz,
  dateKeyInTz,
  addDaysToKey,
  dayIndexOfKeyInTz,
} from "@/lib/tz";

export default function WeekAhead({ state }: { state: AppState }) {
  const days = useMemo(() => {
    const tz = getTz(state.settings);
    const today = dateKeyInTz(tz);
    const out: {
      key: string;
      label: string;
      sub: string;
      items: { key: string; title: string; time: string }[];
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const key = addDaysToKey(today, i);
      const di = dayIndexOfKeyInTz(tz, key);
      const items = compileTimeline(state, di)
        .filter((it) => isActionable(it))
        .map((it) => {
          const m = effectiveMinutes(it, state.settings);
          return {
            key: it.canonicalKey,
            title: it.title,
            time: m == null ? "" : fmtClock(m),
          };
        });
      const d = new Date(key + "T00:00:00");
      out.push({
        key,
        label:
          i === 0
            ? "Today"
            : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", { weekday: "long" }),
        sub: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        items,
      });
    }
    return out;
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-[var(--text-3)]">
        What&rsquo;s scheduled across the next seven days — so you can plan
        around travel, events, or a lighter week.
      </p>
      {days.map((d) => (
        <div key={d.key}>
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-[var(--text-1)]">
              {d.label}
            </span>
            <span className="text-[12px] text-[var(--text-4)]">
              {d.sub} · {d.items.length}{" "}
              {d.items.length === 1 ? "behavior" : "behaviors"}
            </span>
          </div>
          {d.items.length === 0 ? (
            <p className="mt-1 text-[12.5px] italic text-[var(--text-4)]">
              Open day — nothing scheduled.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1">
              {d.items.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center gap-2.5 text-[13px]"
                >
                  <span className="w-[64px] shrink-0 tabular-nums text-[var(--text-4)]">
                    {it.time || "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">
                    {it.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
