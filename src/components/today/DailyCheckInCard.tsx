"use client";

/**
 * DailyCheckInCard — the morning two-tap check-in (sleep quality +
 * energy) that feeds the adaptive engine. Extracted verbatim from
 * today/page.tsx; pure + prop-driven so behavior is identical. The
 * parent keeps the visibility guard (isToday && !checkedIn &&
 * !firstDaySoft) and owns the persistence handlers.
 */
import { motion } from "framer-motion";
import { Eyebrow } from "@/components/ui";

interface DailyCheckInCardProps {
  /** Current sleep-quality value for the selected day (null = unset). */
  sleepQ: number | null;
  /** Current energy value for the selected day (null = unset). */
  energy: number | null;
  /** Persist a sleep-quality rating (1–5). */
  onSleep: (quality: number) => void;
  /** Persist an energy rating (1–5). */
  onEnergy: (energy: number) => void;
}

export default function DailyCheckInCard({
  sleepQ,
  energy,
  onSleep,
  onEnergy,
}: DailyCheckInCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <Eyebrow>Morning check-in</Eyebrow>
      <p className="t-caption mt-1.5">
        Two taps. This is what makes tomorrow adapt to you.
      </p>
      <p className="mt-4 mb-2 text-[13px] font-medium text-[var(--text-2)]">
        How did you sleep?
      </p>
      <div className="flex gap-2">
        {[
          { l: "Poor", q: 2 },
          { l: "OK", q: 3 },
          { l: "Great", q: 5 },
        ].map((o) => (
          <button
            key={o.l}
            onClick={() => onSleep(o.q)}
            className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[13px] font-semibold"
            style={{
              background: sleepQ === o.q ? "var(--sleep)" : "var(--surface-2)",
              color: sleepQ === o.q ? "var(--bg)" : "var(--text-3)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
      <p className="mt-4 mb-2 text-[13px] font-medium text-[var(--text-2)]">
        Energy right now?
      </p>
      <div className="flex gap-2">
        {[
          { l: "Low", e: 2 },
          { l: "Steady", e: 3 },
          { l: "High", e: 5 },
        ].map((o) => (
          <button
            key={o.l}
            onClick={() => onEnergy(o.e)}
            className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[13px] font-semibold"
            style={{
              background:
                energy === o.e ? "var(--readiness)" : "var(--surface-2)",
              color: energy === o.e ? "var(--bg)" : "var(--text-3)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
