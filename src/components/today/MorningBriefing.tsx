"use client";

/**
 * MorningBriefing — a calm, tone-setting card at the top of Today during the
 * morning block: how the day is shaped and one thing to anchor on. Emotional,
 * not tactical (Up Next handles "what's next") — it frames the day rather than
 * directing it. Self-gates to morning / today / not-overnight / has-behaviors.
 */
import { useMemo } from "react";
import type { AppState, TimeBlock } from "@/lib/types";
import type { TimelineItem } from "@/lib/engine";
import { isActionable } from "@/lib/intel";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

export default function MorningBriefing({
  state,
  items,
  cb,
  overnight,
  isToday,
}: {
  state: AppState;
  items: TimelineItem[];
  cb: TimeBlock;
  overnight: boolean;
  isToday: boolean;
}) {
  const { total, focus } = useMemo(() => {
    const actionable = items.filter((i) => !i.muted && isActionable(i));
    const focus = [...actionable].sort(
      (a, b) => (b.leverage ?? 1) - (a.leverage ?? 1)
    )[0];
    return { total: actionable.length, focus };
  }, [items]);

  if (!isToday || overnight || cb !== "morning" || total === 0) return null;

  const headline =
    total <= 2
      ? `A light day — ${total} ${total === 1 ? "thing" : "things"} to anchor it.`
      : total <= 5
      ? `${total} behaviors today. You don't have to be perfect — just present.`
      : "A full day ahead. Start with one, and the rest follows.";

  return (
    <div className="panel relative overflow-hidden p-5">
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--warm) 20%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-start gap-3.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--warm) 16%, var(--surface-3))",
            color: "var(--warm)",
          }}
        >
          <Icon name="sun" size={19} />
        </span>
        <div className="min-w-0">
          <Eyebrow color="var(--warm)">Your morning</Eyebrow>
          <p className="mt-1.5 text-[16px] font-bold leading-snug text-[var(--text-1)]">
            {headline}
          </p>
          {focus && (
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-2)]">
              Anchor on{" "}
              <span className="font-semibold text-[var(--text-1)]">
                {focus.title}
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
