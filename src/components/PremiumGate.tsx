"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";

/** Calm upgrade card — used at free-tier caps. Never a hard wall. */
export function UpgradeCTA({
  title,
  line,
}: {
  title: string;
  line: string;
}) {
  const router = useRouter();
  return (
    <div
      className="relative overflow-hidden rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface-2)" }}
    >
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--readiness) 16%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-start gap-3.5">
        <span
          className="chip h-10 w-10 shrink-0"
          style={{
            background:
              "color-mix(in srgb, var(--readiness) 16%, var(--surface-3))",
            color: "var(--readiness)",
          }}
        >
          <Icon name="bulb" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-[var(--text-1)]">
            {title}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-3)]">
            {line}
          </p>
          <button
            onClick={() => router.push("/upgrade")}
            className="press tr-fast mt-3 rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2.5 text-[13px] font-semibold text-[var(--bg)]"
          >
            See Premium
          </button>
        </div>
      </div>
    </div>
  );
}

// (PremiumPeek removed 2026-08-16: zero importers — the blur-peek pattern it
// implemented was never rendered anywhere. The live peek model is the
// insights 3-day delay + CorrelationExplorer's locked teaser row.)
