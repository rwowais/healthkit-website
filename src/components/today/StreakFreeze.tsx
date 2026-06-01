"use client";

/**
 * StreakFreeze — a calm, opt-in way to protect a streak on a genuinely off
 * day, spending one token from a small rolling monthly allowance (softer
 * than a planned rest day; no all-or-nothing pressure). Self-gates: only
 * offers when there's a real streak at risk (≥3), today isn't already active,
 * and a token is available. Flips to a quiet confirmation once spent.
 */
import { useMemo } from "react";
import type { AppState, DailyLog } from "@/lib/types";
import { freezeStatus, hasAnyActivity } from "@/lib/scoring";
import { Icon } from "@/components/ui/icons";

export default function StreakFreeze({
  state,
  dateKey,
  streak,
  log,
  onUse,
}: {
  state: AppState;
  dateKey: string;
  streak: number;
  log: DailyLog | undefined;
  onUse: (dateKey: string) => void;
}) {
  const fz = useMemo(() => freezeStatus(state), [state]);
  const frozen = (state.settings.usedFreezeDates ?? []).includes(dateKey);
  const todayActive = !!log && hasAnyActivity(log);

  if (frozen) {
    return (
      <div className="panel flex items-center gap-3 p-4">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--sleep) 16%, var(--surface-3))",
            color: "var(--sleep)",
          }}
        >
          <Icon name="snowflake" size={17} />
        </span>
        <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
          <span className="font-semibold text-[var(--text-1)]">
            Streak protected today.
          </span>{" "}
          A freeze is holding your {streak}-day streak — do as much or as
          little as you like.
          {fz.available > 0 &&
            ` ${fz.available} freeze${fz.available === 1 ? "" : "s"} left this month.`}
        </p>
      </div>
    );
  }

  if (streak < 3 || todayActive || fz.available < 1) return null;

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--sleep) 16%, var(--surface-3))",
            color: "var(--sleep)",
          }}
        >
          <Icon name="snowflake" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--text-1)]">
            Protect your {streak}-day streak
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-3)]">
            Off day? Spend a freeze to keep the streak — no pressure to do
            everything. {fz.available} left this month.
          </p>
        </div>
      </div>
      <button
        onClick={() => onUse(dateKey)}
        className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] py-2.5 text-[13px] font-semibold"
        style={{ background: "var(--sleep)", color: "var(--bg)" }}
      >
        Freeze today
      </button>
    </div>
  );
}
