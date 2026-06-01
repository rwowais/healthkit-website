"use client";

/**
 * WeeklyGoal — a calm progress ring on Today toward the user's weekly
 * active-days target (settings.weeklyGoal). Self-gates when no goal is set.
 * Uses weeklyActiveDays (trailing 7 days) so it reflects momentum, not a
 * rigid Mon–Sun reset.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { weeklyActiveDays } from "@/lib/scoring";
import { MiniRing } from "@/components/ui/Ring";
import { Eyebrow } from "@/components/ui";

export default function WeeklyGoal({ state }: { state: AppState }) {
  const goal = state.settings.weeklyGoal ?? 0;
  const done = useMemo(
    () => weeklyActiveDays(state.dailyLogs ?? []),
    [state.dailyLogs]
  );
  if (!goal || goal < 1) return null;

  const met = done >= goal;
  const pct = Math.min(100, (done / goal) * 100);
  const color = met ? "var(--vitality)" : "var(--readiness)";

  return (
    <div className="panel flex items-center gap-4 p-4">
      <MiniRing value={pct} size={56} stroke={5} color={color} />
      <div className="min-w-0">
        <Eyebrow color={color}>This week</Eyebrow>
        <p className="mt-1 text-[14px] font-semibold text-[var(--text-1)]">
          {done} of {goal} active days
        </p>
        <p className="text-[12px] text-[var(--text-3)]">
          {met
            ? "Goal met — beautifully done."
            : `${goal - done} to go. Every day counts.`}
        </p>
      </div>
    </div>
  );
}
