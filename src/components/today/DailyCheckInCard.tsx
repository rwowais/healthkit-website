"use client";

/**
 * DailyCheckInCard — the two-tap check-in (sleep + energy) that feeds the
 * adaptive engine.
 *
 * It used to ALSO morph into a "today's read" once both taps landed. That read
 * was keyed to the same adaptation mode as the Operating Summary above it, so
 * the two cards said the same thing in near-identical words — on a
 * welcome-back day, right down to a shared closing sentence. The summary is
 * now the single voice for the day's read, and the parent unmounts this card
 * the moment the check-in is complete, so there is nothing left to dismiss.
 */
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

  // ── Prompts: the two-tap check-in — compact two-row layout so the
  // checklist below stays reachable without scrolling. Each row: a fixed
  // label on the left, three tappable pills filling the rest.
  return (
    <div className="card anim-rise p-4">
      <Eyebrow>Morning check-in</Eyebrow>
      <div className="mt-3 flex items-center gap-3">
        <span className="w-14 shrink-0 text-[12.5px] font-medium text-[var(--text-3)]">
          Sleep
        </span>
        <div className="flex flex-1 gap-1.5">
          {[
            { l: "Poor", q: 2 },
            { l: "OK", q: 3 },
            { l: "Great", q: 5 },
          ].map((o) => (
            <button
              key={o.l}
              onClick={() => onSleep(o.q)}
              aria-pressed={sleepQ === o.q}
              className="press tr-fast min-h-[40px] flex-1 rounded-[var(--r-sm)] py-2 text-[12.5px] font-semibold"
              style={{
                background:
                  sleepQ === o.q ? "var(--sleep)" : "var(--surface-2)",
                color: sleepQ === o.q ? "var(--bg)" : "var(--text-3)",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="w-14 shrink-0 text-[12.5px] font-medium text-[var(--text-3)]">
          Energy
        </span>
        <div className="flex flex-1 gap-1.5">
          {[
            { l: "Low", e: 2 },
            { l: "Steady", e: 3 },
            { l: "High", e: 5 },
          ].map((o) => (
            <button
              key={o.l}
              onClick={() => onEnergy(o.e)}
              aria-pressed={energy === o.e}
              className="press tr-fast min-h-[40px] flex-1 rounded-[var(--r-sm)] py-2 text-[12.5px] font-semibold"
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
      </div>
    </div>
  );
}
