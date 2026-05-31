"use client";

/**
 * MoodEnergyTrends — how the user has FELT over recent days, charted from the
 * 1–5 energy (morning check-in) and mood (evening reflection) they already
 * log. The body-trends surface charts the body; this charts the inner state.
 * Pure + presentational; renders only with enough signal to be honest.
 */
import { useMemo } from "react";
import type { DailyLog } from "@/lib/types";
import { TrendArea } from "@/components/ui/Charts";
import { Eyebrow } from "@/components/ui";

export default function MoodEnergyTrends({ logs }: { logs: DailyLog[] }) {
  const { energy, mood, enough } = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-21); // last ~3 weeks of check-ins
    const lbl = (d: string) => d.slice(5); // MM-DD
    const energy = recent
      .filter((l) => l.energyLevel != null)
      .map((l) => ({ label: lbl(l.date), value: l.energyLevel as number }));
    const mood = recent
      .filter((l) => l.moodLevel != null)
      .map((l) => ({ label: lbl(l.date), value: l.moodLevel as number }));
    return { energy, mood, enough: Math.max(energy.length, mood.length) >= 4 };
  }, [logs]);

  if (!enough) return null;

  return (
    <div className="panel p-5">
      <Eyebrow color="var(--readiness)">How you&rsquo;ve felt</Eyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        Your energy and mood from your check-ins over recent days — the
        subjective signal behind the numbers.
      </p>
      {energy.length >= 2 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-2)]">
              Energy
            </span>
            <span className="text-[11px] text-[var(--text-4)]">1&ndash;5</span>
          </div>
          <TrendArea data={energy} color="var(--readiness)" height={92} max={5} />
        </div>
      )}
      {mood.length >= 2 && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-2)]">
              Mood
            </span>
            <span className="text-[11px] text-[var(--text-4)]">1&ndash;5</span>
          </div>
          <TrendArea data={mood} color="var(--vitality)" height={92} max={5} />
        </div>
      )}
    </div>
  );
}
