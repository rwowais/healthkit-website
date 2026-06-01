"use client";

/**
 * ForecastCard — a calm "where you're heading" projection for body metrics
 * with a confident, meaningful trend. Honest by construction: it renders
 * nothing unless biomarkerForecasts found a real, well-fit trend (≥6
 * readings over ≥3 weeks). Projections are framed as conditional, never
 * promised.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { biomarkerForecasts } from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

const DIR = {
  improving: "var(--vitality)",
  worsening: "var(--alert)",
  drifting: "var(--readiness)",
} as const;

export default function ForecastCard({ state }: { state: AppState }) {
  const forecasts = useMemo(() => biomarkerForecasts(state), [state]);
  if (!forecasts.length) return null;

  return (
    <div>
      <Eyebrow color="var(--readiness)">Where you&rsquo;re heading</Eyebrow>
      <div className="well mt-3 space-y-1.5 p-1.5">
        {forecasts.map((f) => {
          const color = DIR[f.direction];
          return (
            <div key={f.metric} className="row px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-1)]">
                  <span style={{ color }}>
                    <Icon name="pulse" size={15} stroke={1.8} />
                  </span>
                  {f.label}
                </span>
                <span
                  className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold"
                  style={{ color, fontVariantNumeric: "tabular-nums" }}
                >
                  {f.current}
                  <Icon name="arrowRight" size={12} />
                  {f.projected}
                  <span className="text-[11px] font-medium text-[var(--text-4)]">
                    {f.unit}
                  </span>
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-3)]">
                {f.note}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-[var(--text-4)]">
        Projections assume your current trend continues — a gentle nudge, not
        a promise.
      </p>
    </div>
  );
}
