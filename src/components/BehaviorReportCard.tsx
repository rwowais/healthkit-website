"use client";

/**
 * BehaviorReportCard — "what's sticking vs slipping". A calm, non-judgmental
 * per-behavior adherence breakdown (computed by intel.behaviorAdherence) so
 * the user can see which habits held and which need re-engineering, rather
 * than a single blunt score. Pure + presentational.
 */
import type { BehaviorAdherence } from "@/lib/intel";
import { Eyebrow } from "@/components/ui";

function band(rate: number): string {
  if (rate >= 0.7) return "var(--vitality)";
  if (rate >= 0.4) return "var(--warm)";
  return "var(--alert)";
}

export default function BehaviorReportCard({
  rows,
}: {
  rows: BehaviorAdherence[];
}) {
  if (rows.length < 2) return null;

  return (
    <div className="panel p-5">
      <Eyebrow color="var(--vitality)">What&rsquo;s sticking</Eyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        How often you kept each behavior on the days it was scheduled, over the
        last 4 weeks. No judgment — just where your attention is paying off, and
        where a habit might need re-engineering.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.round(r.rate * 100);
          const c = band(r.rate);
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--text-1)]">
                  {r.title}
                </span>
                <span
                  className="shrink-0 text-[12px] font-semibold tabular-nums"
                  style={{ color: c }}
                  title={`${r.done} of ${r.scheduled} scheduled days`}
                >
                  {pct}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: "var(--surface-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: c }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
