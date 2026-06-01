"use client";

/**
 * MonthlyReport — a calm month-in-review on Insights: active days, pillar
 * averages, and the habits you kept most this month, with one tap to save a
 * shareable card. Built on analytics.monthlyReport. Self-gates until there's
 * a few active days to summarize.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { monthlyReport } from "@/lib/analytics";
import { shareCardImage } from "@/lib/shareCard";
import { Eyebrow } from "@/components/ui";

export default function MonthlyReport({ state }: { state: AppState }) {
  const r = useMemo(() => monthlyReport(state), [state]);
  if (r.activeDays < 3) return null;

  const share = () =>
    shareCardImage({
      big: String(r.activeDays),
      label: `active days in ${r.monthShort}`,
      sub: r.topBehaviors[0]
        ? `Most kept: ${r.topBehaviors[0].title}`
        : "Consistency compounds.",
      filename: "protocolize-month.png",
      title: `${r.monthLabel} — my month`,
    });

  return (
    <div className="panel relative overflow-hidden p-6">
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(140% 100% at 50% 0%, color-mix(in srgb, var(--readiness) 20%, transparent), transparent 62%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Eyebrow color="var(--readiness)">{r.monthLabel}</Eyebrow>
          <span className="text-[12px] font-semibold text-[var(--text-3)]">
            {r.daysElapsed} days in
          </span>
        </div>
        <p className="mt-3 text-[20px] font-bold leading-snug text-[var(--text-1)]">
          <span className="text-[var(--readiness)]">
            {r.activeDays} active {r.activeDays === 1 ? "day" : "days"}
          </span>{" "}
          this month.
        </p>

        {r.pillars.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {r.pillars.map((p) => (
              <div key={p.pillar}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--text-2)]">{p.label}</span>
                  <span className="font-semibold tabular-nums text-[var(--text-2)]">
                    {p.avg}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.avg}%`, background: "var(--readiness)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {r.topBehaviors.length > 0 && (
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">
            Most kept:{" "}
            <span className="font-semibold text-[var(--text-1)]">
              {r.topBehaviors.map((b) => b.title).join(", ")}
            </span>
            .
          </p>
        )}

        <button
          onClick={share}
          className="press tr-fast mt-5 w-full rounded-[var(--r-pill)] py-3 text-[14px] font-semibold text-[var(--bg)]"
          style={{ background: "var(--readiness)" }}
        >
          Save this month
        </button>
      </div>
    </div>
  );
}
