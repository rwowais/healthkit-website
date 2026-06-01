"use client";

/**
 * MilestoneMoment — a calm celebration when the user freshly crosses a
 * meaningful mark (a 7/30/100-day streak, an active-day count, a completion
 * total). Only appears on the day it's crossed (analytics.freshMilestone), and
 * "Mark it" records the id so it doesn't re-appear. "Share" reuses the same
 * branded card as the progress share.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { freshMilestone, type Milestone } from "@/lib/analytics";
import { shareCardImage } from "@/lib/shareCard";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

const KIND_LABEL: Record<Milestone["kind"], string> = {
  streak: "day streak",
  active: "active days",
  completions: "behaviors done",
};

export default function MilestoneMoment({
  state,
  onCelebrate,
}: {
  state: AppState;
  onCelebrate: (id: string) => void;
}) {
  const m = useMemo(() => freshMilestone(state), [state]);
  if (!m) return null;

  const share = () =>
    shareCardImage({
      big: String(m.threshold),
      label: KIND_LABEL[m.kind],
      sub: "consistency compounds.",
      filename: "protocolize-milestone.png",
      title: m.headline,
    });

  return (
    <div className="panel relative overflow-hidden p-6">
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(140% 100% at 50% 0%, color-mix(in srgb, var(--warm) 26%, transparent), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Icon name="flame" size={15} className="text-[var(--warm)]" />
          <Eyebrow color="var(--warm)">Milestone</Eyebrow>
        </div>
        <p className="mt-3 text-[24px] font-bold leading-tight text-[var(--text-1)]">
          {m.headline}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
          {m.body}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={share}
            className="press tr-fast flex-1 rounded-[var(--r-pill)] py-3 text-[14px] font-semibold text-[var(--bg)]"
            style={{ background: "var(--warm)" }}
          >
            Share it
          </button>
          <button
            onClick={() => onCelebrate(m.id)}
            className="press tr-fast rounded-[var(--r-pill)] px-5 py-3 text-[14px] font-semibold text-[var(--text-1)]"
            style={{ background: "var(--surface-3)" }}
          >
            Mark it
          </button>
        </div>
      </div>
    </div>
  );
}
