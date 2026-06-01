"use client";

/**
 * ShareProgressCard — a calm entry point to save/share a beautiful image of
 * your progress ("I showed up N of the last 30 days"). Draws the card to a
 * canvas (no deps), then uses the Web Share API with the PNG when available,
 * else downloads it. Self-gates on having enough activity to be worth sharing.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { calculateStreak } from "@/lib/scoring";
import { getVacationDates } from "@/lib/storage";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";
import { shareCardImage } from "@/lib/shareCard";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

export default function ShareProgressCard({ state }: { state: AppState }) {
  const { activeDays, streak } = useMemo(() => {
    const tz = getTz(state.settings);
    const today = dateKeyInTz(tz);
    const byDate = new Map((state.dailyLogs ?? []).map((l) => [l.date, l]));
    let active = 0;
    for (let i = 0; i < 30; i++) {
      const log = byDate.get(addDaysToKey(today, -i));
      if (!log) continue;
      const c =
        Object.values(log.behaviorCompletions ?? {}).filter(Boolean).length +
        Object.values(log.supplementCompletions ?? {}).filter(Boolean).length;
      if (c > 0) active++;
    }
    return {
      activeDays: active,
      streak: calculateStreak(
        state.dailyLogs ?? [],
        getVacationDates(state),
        state.settings
      ),
    };
  }, [state]);

  if (activeDays < 5) return null;

  const share = () =>
    shareCardImage({
      big: String(activeDays),
      label: "active days in the last month",
      sub:
        streak >= 2
          ? `${streak}-day streak · consistency compounds.`
          : "Consistency compounds.",
    });

  return (
    <button
      onClick={share}
      className="press tr-fast panel relative w-full overflow-hidden p-5 text-left"
    >
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(130% 90% at 100% 0%, color-mix(in srgb, var(--vitality) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow color="var(--vitality)">Share your progress</Eyebrow>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
            You showed up{" "}
            <span className="font-bold text-[var(--text-1)]">
              {activeDays} of the last 30 days
            </span>
            . Save a card to mark it.
          </p>
        </div>
        <Icon
          name="chevron"
          size={16}
          className="shrink-0 text-[var(--text-3)]"
        />
      </div>
    </button>
  );
}
