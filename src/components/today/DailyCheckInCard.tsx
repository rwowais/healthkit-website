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
    // A "lightened" day uses the calm recovery hue — but the COPY must match
    // WHY it's lighter. recovery/lighter are genuinely low-recovery reads;
    // rebuild is about time away and essentials is about rebuilding consistency
    // — neither implies low recovery, so claiming "you're running low" there
    // flatly contradicts a user who just tapped Great sleep + High energy.
    const lightened =
      mode === "recovery" ||
      mode === "lighter" ||
      mode === "essentials" ||
      mode === "rebuild";
    const read =
      mode === "recovery" || mode === "lighter"
        ? "You're running a little low today. Going easier would serve you — ease back on the harder blocks if they don't feel right. Your call."
        : mode === "rebuild"
        ? "Easing you back in after some time away — today's trimmed so restarting feels light. Build from here."
        : mode === "essentials"
        ? "Keeping today focused on a few essentials while your consistency rebuilds. Small wins compound."
        : mode === "primed"
        ? "You're well-recovered — a good day to go as planned."
        : "You're steady. Today stands as planned; adjust anything that doesn't fit.";
    return (
      <div className="card anim-rise p-5">
        <Eyebrow color={lightened ? "var(--recovery)" : "var(--readiness)"}>
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
