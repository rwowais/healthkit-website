"use client";

/**
 * PillarDeepDives — tap a pillar (Sleep / Movement / Nutrition / Supplements)
 * to open its own 30-day trend chart + a tailored, calm line of guidance.
 * Built on analytics.pillarSummaries (which uses metrics.pillarScore, so it
 * never fabricates a number — untracked pillars simply don't appear).
 */
import { useMemo, useState } from "react";
import type { AppState, Pillar } from "@/lib/types";
import { pillarSummaries } from "@/lib/analytics";
import { TrendArea } from "@/components/ui/Charts";
import { Eyebrow, Sheet } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

const META: Record<Pillar, { color: string; icon: IconName; label: string }> = {
  sleep: { color: "var(--sleep)", icon: "moon", label: "Sleep" },
  exercise: { color: "var(--readiness)", icon: "pulse", label: "Movement" },
  nutrition: { color: "var(--vitality)", icon: "leaf", label: "Nutrition" },
  supplements: { color: "var(--warm)", icon: "pill", label: "Supplements" },
};

function trendChip(trend: "up" | "down" | "steady" | null) {
  if (trend === "up") return { label: "Improving", color: "var(--vitality)" };
  if (trend === "down") return { label: "Slipping", color: "var(--alert)" };
  if (trend === "steady") return { label: "Steady", color: "var(--text-3)" };
  return null;
}

export default function PillarDeepDives({ state }: { state: AppState }) {
  const sums = useMemo(
    () => pillarSummaries(state).filter((s) => s.tracked),
    [state]
  );
  const [open, setOpen] = useState<Pillar | null>(null);

  if (sums.length === 0) return null;
  const active = sums.find((s) => s.pillar === open) ?? null;

  return (
    <div>
      <Eyebrow color="var(--sleep)">Pillar deep-dives</Eyebrow>
      <div className="well mt-3 space-y-1.5 p-1.5">
        {sums.map((s) => {
          const m = META[s.pillar];
          const chip = trendChip(s.trend);
          return (
            <button
              key={s.pillar}
              onClick={() => setOpen(s.pillar)}
              className="press tr-fast row flex w-full items-center gap-3.5 px-3.5 py-3 text-left"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{
                  background: `color-mix(in srgb, ${m.color} 16%, var(--surface-3))`,
                  color: m.color,
                }}
              >
                <Icon name={m.icon} size={17} stroke={1.7} />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-[var(--text-1)]">
                {m.label}
              </span>
              {chip && (
                <span
                  className="shrink-0 text-[12px] font-semibold"
                  style={{ color: chip.color }}
                >
                  {chip.label}
                </span>
              )}
              {s.avg != null && (
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--text-2)]">
                  {s.avg}
                </span>
              )}
              <Icon name="chevron" size={14} className="shrink-0 text-[var(--text-4)]" />
            </button>
          );
        })}
      </div>

      <Sheet
        open={!!active}
        onClose={() => setOpen(null)}
        title={active ? META[active.pillar].label : ""}
      >
        {active && (
          <div className="pb-2">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-4)]">
                  30-day average
                </p>
                <p
                  className="text-[28px] font-bold leading-none"
                  style={{ color: META[active.pillar].color }}
                >
                  {active.avg ?? "—"}
                </p>
              </div>
              {active.latest != null && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-4)]">
                    Latest
                  </p>
                  <p className="text-[28px] font-bold leading-none text-[var(--text-2)]">
                    {active.latest}
                  </p>
                </div>
              )}
            </div>
            {active.series.length >= 2 ? (
              <div className="mt-4">
                <TrendArea
                  data={active.series}
                  color={META[active.pillar].color}
                  height={140}
                  max={100}
                />
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-[var(--text-3)]">
                A few more tracked days and a trend line will appear here.
              </p>
            )}
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-2)]">
              {active.guidance}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
