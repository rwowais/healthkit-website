"use client";

import { Sheet, Button, Eyebrow } from "@/components/ui";
import { Icon, iconForItem } from "@/components/ui/icons";
import type { ProtocolItem } from "@/lib/types";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function ProtocolDetailSheet({
  item,
  color,
  onClose,
  onScheduleChange,
  onToggleEnabled,
  onDelete,
}: {
  item: ProtocolItem | null;
  color: string;
  onClose: () => void;
  onScheduleChange?: (days: boolean[]) => void;
  onToggleEnabled?: () => void;
  onDelete?: () => void;
}) {
  if (!item) return null;
  const days = item.daysActive ?? new Array(7).fill(true);

  return (
    <Sheet open={!!item} onClose={onClose} title={item.name}>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span
            className="chip h-12 w-12 shrink-0"
            style={{
              background: `color-mix(in srgb, ${color} 16%, var(--surface-3))`,
              color,
            }}
          >
            <Icon name={iconForItem(item)} size={22} />
          </span>
          <p className="t-body leading-relaxed text-[var(--text-1)]">
            {item.description}
          </p>
        </div>

        {item.evidenceNote && (
          <div
            className="rounded-[var(--r-md)] p-4"
            style={{ background: "var(--surface-2)" }}
          >
            <Eyebrow color={color}>Why this works</Eyebrow>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
              {item.evidenceNote}
            </p>
          </div>
        )}

        {item.recommendedBy && item.recommendedBy.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.recommendedBy.map((r) => (
              <span
                key={r}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)]"
                style={{ background: "var(--surface-3)" }}
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {onScheduleChange && (
          <div>
            <Eyebrow>Active Days</Eyebrow>
            <div className="mt-3 flex justify-between gap-1.5">
              {DAYS.map((d, i) => {
                const on = days[i];
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const next = [...days];
                      next[i] = !next[i];
                      onScheduleChange(next);
                    }}
                    className="press tr-fast h-11 flex-1 rounded-[var(--r-sm)] text-[13px] font-bold"
                    style={{
                      background: on ? color : "var(--surface-2)",
                      color: on ? "#08090B" : "var(--text-4)",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {onToggleEnabled && (
            <Button
              full
              variant={item.isEnabled ? "ghost" : "primary"}
              onClick={onToggleEnabled}
            >
              {item.isEnabled ? "Disable" : "Enable"}
            </Button>
          )}
          {onDelete && item.source === "custom" && (
            <button
              onClick={onDelete}
              className="press tr-fast rounded-[var(--r-pill)] border border-[var(--hairline-strong)] px-5 text-[14px] font-semibold text-[var(--alert)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
