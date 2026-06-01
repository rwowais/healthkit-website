"use client";

/**
 * WhenConsistent — surfaces WHEN the user actually follows through: which
 * weekdays they complete the most, and which time-of-day block most of their
 * behaviors land in. Honest, non-judgmental ("you tend to..."), gated on
 * enough history + a real spread (analytics.consistencyWindows.confident).
 */
import { useMemo } from "react";
import type { AppState, TimeBlock } from "@/lib/types";
import { consistencyWindows, WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/analytics";
import { BarWeek } from "@/components/ui/Charts";
import { Eyebrow } from "@/components/ui";

const BLOCK_LABEL: Record<TimeBlock, string> = {
  morning: "the morning",
  afternoon: "the afternoon",
  evening: "the evening",
  anytime: "no fixed time",
};

export default function WhenConsistent({ state }: { state: AppState }) {
  const c = useMemo(() => consistencyWindows(state), [state]);
  if (!c.confident) return null;

  const maxAvg = Math.max(
    ...c.byWeekday.map((v) => v ?? 0),
    0.0001
  );
  const bars = c.byWeekday.map((v, i) => ({
    label: WEEKDAY_SHORT[i],
    value: v == null ? 0 : Math.round((v / maxAvg) * 100),
    highlight: i === c.strongestWeekday,
  }));

  const topBlock = c.byBlock[0];

  return (
    <div className="panel p-5">
      <Eyebrow color="var(--readiness)">When you&rsquo;re consistent</Eyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        Where your follow-through actually lands — useful for deciding when to
        protect time, not a verdict on any single day.
      </p>
      <div className="mt-4">
        <BarWeek data={bars} height={120} />
      </div>
      {c.strongestWeekday != null && c.weakestWeekday != null && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-2)]">
          You complete the most on{" "}
          <span className="font-semibold text-[var(--text-1)]">
            {WEEKDAY_LABELS[c.strongestWeekday]}s
          </span>
          , the least on{" "}
          <span className="font-semibold text-[var(--text-1)]">
            {WEEKDAY_LABELS[c.weakestWeekday]}s
          </span>
          .
        </p>
      )}
      {topBlock && (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
          Most of your behaviors land in{" "}
          <span className="font-semibold text-[var(--text-1)]">
            {BLOCK_LABEL[topBlock.block]}
          </span>{" "}
          ({Math.round(topBlock.share * 100)}%).
        </p>
      )}
    </div>
  );
}
