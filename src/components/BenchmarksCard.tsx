"use client";

/**
 * BenchmarksCard — where the user falls within a built-in reference range
 * for habit consistency. Explicitly NOT peer data: the reference curves are
 * fixed and computed on-device, and the footnote says so plainly (honesty
 * over a flattering-but-false "vs other users" claim). Self-gates until
 * there's ~2 weeks of history.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { benchmarks } from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";

const BAND_COLOR: Record<string, string> = {
  top: "var(--vitality)",
  above: "var(--readiness)",
  typical: "var(--warm)",
  building: "var(--text-3)",
};
const BAND_LABEL: Record<string, string> = {
  top: "Top tier",
  above: "Above typical",
  typical: "Typical",
  building: "Building",
};

export default function BenchmarksCard({ state }: { state: AppState }) {
  const b = useMemo(() => benchmarks(state), [state]);
  if (!b.confident) return null;

  return (
    <div>
      <Eyebrow color="var(--vitality)">How you compare</Eyebrow>
      <div className="well mt-3 space-y-1.5 p-1.5">
        {b.items.map((it) => {
          const color = BAND_COLOR[it.band];
          return (
            <div key={it.key} className="row px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-[var(--text-1)]">
                  {it.label}
                </span>
                <span
                  className="shrink-0 text-[12px] font-bold uppercase tracking-wide"
                  style={{ color }}
                >
                  {BAND_LABEL[it.band]}
                </span>
              </div>
              {/* percentile bar */}
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--surface-3)" }}
              >
                <div
                  className="h-full rounded-full tr-base"
                  style={{ width: `${it.percentile}%`, background: color }}
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-3)]">
                {it.value}
                {it.unit} · {it.note}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-[var(--text-4)]">
        Compared with a built-in reference range for habit consistency — not
        other people&rsquo;s data. Computed entirely on your device.
      </p>
    </div>
  );
}
