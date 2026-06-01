"use client";

/**
 * WhatChangedCard — a calm week-over-week read: what moved (trailing 7 days
 * vs the 7 before), a one-line headline, and the single slip most worth a
 * gentle nudge. Self-gates: renders nothing until both weeks carry enough
 * data to compare honestly (whatChanged.hasData).
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { whatChanged } from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";

export default function WhatChangedCard({ state }: { state: AppState }) {
  const wc = useMemo(() => whatChanged(state), [state]);
  if (!wc.hasData) return null;

  return (
    <div className="panel relative overflow-hidden p-6">
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(140% 100% at 0% 0%, color-mix(in srgb, var(--readiness) 18%, transparent), transparent 62%)",
        }}
      />
      <div className="relative">
        <Eyebrow color="var(--readiness)">What changed this week</Eyebrow>
        <p className="mt-3 text-[18px] font-bold leading-snug text-[var(--text-1)]">
          {wc.headline}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {wc.changes.map((c) => {
            const color =
              c.dir === "flat"
                ? "var(--text-3)"
                : c.good
                ? "var(--vitality)"
                : "var(--alert)";
            const glyph = c.dir === "up" ? "↑" : c.dir === "down" ? "↓" : "→";
            return (
              <div
                key={c.key}
                className="rounded-[var(--r-md)] p-3"
                style={{ background: "var(--surface-2)" }}
              >
                <p className="text-[11.5px] font-medium text-[var(--text-3)]">
                  {c.label}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className="text-[18px] font-bold tabular-nums text-[var(--text-1)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {c.now}
                    <span className="text-[11px] font-medium text-[var(--text-4)]">
                      {c.unit}
                    </span>
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color }}
                    aria-label={c.dir === "flat" ? "steady" : c.dir}
                  >
                    {glyph}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-4)] tabular-nums">
                  was {c.prev}
                  {c.unit}
                </p>
              </div>
            );
          })}
        </div>

        {wc.attention && (
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">
            {wc.attention}
          </p>
        )}
      </div>
    </div>
  );
}
