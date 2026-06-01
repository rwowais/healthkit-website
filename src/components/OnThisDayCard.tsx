"use client";

/**
 * OnThisDayCard — a gentle look back: a habit you started a month / season /
 * year ago and are STILL doing. Reinforces identity over time ("this is who
 * I've become"). analytics.onThisDay only returns a still-active habit on a
 * lookback anniversary, so this is quiet and rare by design.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { onThisDay } from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

export default function OnThisDayCard({ state }: { state: AppState }) {
  const r = useMemo(() => onThisDay(state), [state]);
  if (!r) return null;

  const cap = r.ago.charAt(0).toUpperCase() + r.ago.slice(1);

  return (
    <div className="panel relative overflow-hidden p-5">
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--recovery) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-start gap-3.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--recovery) 16%, var(--surface-3))",
            color: "var(--recovery)",
          }}
        >
          <Icon name="clock" size={18} />
        </span>
        <div className="min-w-0">
          <Eyebrow color="var(--recovery)">On this day</Eyebrow>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-1)]">
            {cap} you started{" "}
            <span className="font-bold">{r.title}</span>
            {" "}&mdash; and you&rsquo;re still doing it. That&rsquo;s not a
            streak; that&rsquo;s a change.
          </p>
        </div>
      </div>
    </div>
  );
}
