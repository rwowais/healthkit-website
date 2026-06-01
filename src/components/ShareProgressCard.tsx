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

  const share = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const F = "system-ui, -apple-system, 'Segoe UI', sans-serif";
      const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
      bg.addColorStop(0, "#0E1014");
      bg.addColorStop(1, "#171A21");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1080);
      const glow = ctx.createRadialGradient(880, 200, 0, 880, 200, 760);
      glow.addColorStop(0, "rgba(134,217,156,0.22)");
      glow.addColorStop(1, "rgba(134,217,156,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = "#86D99C";
      ctx.font = `600 34px ${F}`;
      ctx.fillText("PROTOCOLIZE", 90, 140);
      ctx.fillStyle = "#F4F5F7";
      ctx.font = `800 240px ${F}`;
      ctx.fillText(String(activeDays), 84, 600);
      ctx.fillStyle = "#D6DAE0";
      ctx.font = `600 46px ${F}`;
      ctx.fillText("active days in the last month", 92, 678);
      ctx.fillStyle = "#8A8F99";
      ctx.font = `400 36px ${F}`;
      ctx.fillText(
        streak >= 2
          ? `${streak}-day streak · consistency compounds.`
          : "Consistency compounds.",
        92,
        762
      );
      ctx.fillStyle = "#5A5F68";
      ctx.font = `400 30px ${F}`;
      ctx.fillText("your longevity operating system", 92, 1000);

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, "image/png")
      );
      if (!blob) return;
      const file = new File([blob], "protocolize-progress.png", {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: "My progress" });
          return;
        } catch {
          /* user cancelled or share failed → fall through to download */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "protocolize-progress.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* canvas/share unavailable — no-op rather than crash */
    }
  };

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
