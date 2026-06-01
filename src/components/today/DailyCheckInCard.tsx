"use client";

/**
 * DailyCheckInCard — the two-tap check-in (sleep + energy) that feeds the
 * adaptive engine, AND closes the loop: the instant both are set it morphs
 * into a calm "today's read" keyed to the engine's adaptation mode (so it
 * never contradicts the operating-summary banner). The voice is advisory —
 * on a low-recovery day it RECOMMENDS easing and leaves the call to the
 * user; it never claims to have silently rearranged their day. The parent
 * owns the per-day "acknowledged" dismissal so the read recedes once seen.
 */
import { Eyebrow } from "@/components/ui";
import type { AdaptMode } from "@/lib/engine";

interface DailyCheckInCardProps {
  /** Current sleep-quality value for the selected day (null = unset). */
  sleepQ: number | null;
  /** Current energy value for the selected day (null = unset). */
  energy: number | null;
  /** Current adaptation mode — drives the post-check-in read. */
  mode: AdaptMode;
  /** Persist a sleep-quality rating (1–5). */
  onSleep: (quality: number) => void;
  /** Persist an energy rating (1–5). */
  onEnergy: (energy: number) => void;
  /** Dismiss the read for today (parent persists per-day). */
  onAck: () => void;
}

export default function DailyCheckInCard({
  sleepQ,
  energy,
  mode,
  onSleep,
  onEnergy,
  onAck,
}: DailyCheckInCardProps) {
  const done = sleepQ != null && energy != null;

  // ── Loop closed: show the read, advisory voice, user decides ──
  if (done) {
    const ease =
      mode === "recovery" ||
      mode === "lighter" ||
      mode === "essentials" ||
      mode === "rebuild";
    const read = ease
      ? "You're running a little low today. Going easier would serve you — ease back on the harder blocks if they don't feel right. Your call."
      : mode === "primed"
      ? "You're well-recovered — a good day to go as planned."
      : "You're steady. Today stands as planned; adjust anything that doesn't fit.";
    return (
      <div className="card anim-rise p-5">
        <Eyebrow color={ease ? "var(--recovery)" : "var(--readiness)"}>
          Today&rsquo;s read
        </Eyebrow>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
          {read}
        </p>
        <button
          onClick={onAck}
          className="press tap-44 tr-fast mt-2 inline-flex items-center text-[13px] font-semibold text-[var(--text-3)]"
        >
          Got it
        </button>
      </div>
    );
  }

  // ── Prompts: the two-tap check-in ──
  return (
    <div className="card anim-rise p-5">
      <Eyebrow>Morning check-in</Eyebrow>
      <p className="t-caption mt-1.5">
        Two taps — so today can meet you where you are.
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
    </div>
  );
}
