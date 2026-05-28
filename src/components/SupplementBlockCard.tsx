"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import * as haptic from "@/lib/haptics";
import type { Supplement, TimeBlock } from "@/lib/types";

/**
 * SupplementBlockCard — the one-card-per-block surface for a user's
 * supplement bundle. Replaces the pre-refactor inline-row stack that
 * crowded Today with N rows showing the same minute.
 *
 * Anatomy:
 *   - Collapsed: pill icon, "Morning supplements", "3/5", chevron.
 *     A single tap toggles expanded.
 *   - Expanded: each supplement renders as a compact row (name +
 *     dose, no clock time), with its own tap-to-check. The "Take
 *     all" button at the top is the bulk action.
 *
 * Why no clock times in the expanded view:
 *   Per-supplement clock times are noise. Nobody takes Omega-3 at
 *   8:00:00 and Vitamin D at 8:00:30 — they take them together.
 *   The block (morning, afternoon, evening, anytime) is the
 *   meaningful time context. Per-supplement timing notes (e.g.
 *   "with breakfast") render below the dose when set.
 *
 * Inventory hint:
 *   When a supplement is running low (count < refillAt), a calm
 *   warm-tinted "X days left" badge appears next to the dose.
 */
export default function SupplementBlockCard({
  block,
  supplements,
  completions,
  onToggle,
  onBulkCheck,
  onOpenDetail,
}: {
  block: TimeBlock;
  supplements: Supplement[];
  completions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onBulkCheck: () => void;
  onOpenDetail?: (supp: Supplement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (supplements.length === 0) return null;
  const done = supplements.filter((s) => completions[s.id] === true).length;
  const total = supplements.length;
  const allDone = done === total;
  const blockLabel = block.charAt(0).toUpperCase() + block.slice(1);

  return (
    <div
      className="mt-1 rounded-[var(--r-md)]"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <button
        onClick={() => {
          haptic.light();
          setExpanded((v) => !v);
        }}
        className="press tr-fast flex w-full items-center gap-3 py-3 pl-3 pr-3 text-left"
        aria-expanded={expanded}
        aria-label={`${blockLabel} supplements, ${done} of ${total} taken`}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{
            background:
              allDone
                ? "color-mix(in srgb, var(--vitality) 22%, var(--surface-3))"
                : "color-mix(in srgb, var(--warm) 18%, var(--surface-3))",
            color: allDone ? "var(--vitality)" : "var(--warm)",
          }}
        >
          {allDone ? (
            <Icon name="check" size={18} />
          ) : (
            <Icon name="pill" size={18} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--text-1)]">
            {blockLabel} supplements
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
            {done}/{total}
            <span className="text-[var(--text-4)]">
              {" · "}
              {expanded ? "tap to collapse" : allDone ? "all done" : "tap to see all"}
            </span>
          </p>
        </div>
        <Icon
          name="chevron"
          size={14}
          className={`text-[var(--text-3)] tr-fast ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div
          className="space-y-1 px-3 pb-3"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
              Stack
            </span>
            <Link
              href="/supplements"
              className="press tr-fast text-[11.5px] font-semibold text-[var(--readiness)]"
            >
              Manage →
            </Link>
          </div>
          {!allDone && (
            <button
              onClick={() => {
                haptic.medium();
                onBulkCheck();
              }}
              className="press tr-fast mt-2.5 mb-1 flex w-full items-center justify-center gap-2 rounded-[var(--r-pill)] py-2 text-[12.5px] font-semibold"
              style={{
                background:
                  "color-mix(in srgb, var(--vitality) 16%, var(--surface-3))",
                color: "var(--vitality)",
              }}
            >
              <Icon name="check" size={14} />
              Take all ({total - done} left)
            </button>
          )}
          {supplements.map((s) => {
            const isDone = completions[s.id] === true;
            const lowStock =
              s.inventory &&
              s.inventory.refillAt != null &&
              s.inventory.count <= s.inventory.refillAt;
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 py-1.5"
              >
                <button
                  onClick={() => {
                    if (isDone) haptic.light();
                    else haptic.medium();
                    onToggle(s.id);
                  }}
                  aria-label={
                    isDone
                      ? `${s.name} — done`
                      : `Mark ${s.name} taken`
                  }
                  aria-pressed={isDone}
                  className="press grid min-h-[40px] w-10 shrink-0 place-items-center"
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full tr-fast"
                    style={{
                      background: isDone
                        ? "var(--vitality)"
                        : "transparent",
                      border: `2px solid ${
                        isDone ? "var(--vitality)" : "var(--text-4)"
                      }`,
                      color: "#08090B",
                    }}
                  >
                    {isDone && <Icon name="check" size={13} />}
                  </span>
                </button>
                <button
                  onClick={() => onOpenDetail?.(s)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={`text-[13.5px] font-medium ${
                      isDone
                        ? "text-[var(--text-3)] line-through decoration-[var(--text-4)]"
                        : "text-[var(--text-1)]"
                    }`}
                  >
                    {s.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
                    {s.dose && <span>{s.dose}</span>}
                    {s.dose && s.timing && <span>·</span>}
                    {s.timing && (
                      <span className="line-clamp-1">{s.timing}</span>
                    )}
                    {lowStock && (
                      <>
                        {(s.dose || s.timing) && <span>·</span>}
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, var(--alert) 18%, transparent)",
                            color: "var(--alert)",
                          }}
                          aria-label="Low stock"
                        >
                          {s.inventory!.count} left
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
