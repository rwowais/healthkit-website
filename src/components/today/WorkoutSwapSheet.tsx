"use client";

/**
 * WorkoutSwapSheet — the bottom sheet for swapping a scheduled workout
 * for an alternative the user actually did today (e.g. strength →
 * 60-min walk on a sore-shoulder day). Pure + prop-driven: the parent
 * computes the alternatives + original title and owns the swap
 * persistence (swapBehavior + haptic), so behavior is identical to the
 * inline version this replaced.
 */
import { Icon, type IconName } from "@/components/ui/icons";
import type { BehaviorDef } from "@/lib/types";

interface WorkoutSwapSheetProps {
  /** The canonicalKey being swapped FROM; null = sheet closed. */
  swapForKey: string | null;
  /** Display title of the original behavior (for the "X → ?" header). */
  originalTitle?: string;
  /** Workout alternatives the user can swap TO (parent pre-filters). */
  alternatives: BehaviorDef[];
  /** Called with the chosen alternative's key. Parent does the swap. */
  onSelect: (altKey: string) => void;
  onClose: () => void;
}

export default function WorkoutSwapSheet({
  swapForKey,
  originalTitle,
  alternatives,
  onSelect,
  onClose,
}: WorkoutSwapSheetProps) {
  if (!swapForKey) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
      style={{ background: "color-mix(in srgb, #000 60%, transparent)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-t-[var(--r-xl)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--hairline-strong)",
          borderBottom: "none",
          maxHeight: "82vh",
          overflowY: "auto",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--text-4)]" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Swap for today
        </p>
        <h3 className="mt-1 text-[18px] font-bold text-[var(--text-1)]">
          {originalTitle ?? "Workout"} → ?
        </h3>
        <p className="t-caption mt-1 leading-relaxed">
          Pick what you actually did. We&apos;ll mark it complete for today;
          your original schedule is unchanged.
        </p>
        {alternatives.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--text-3)]">
            No other workouts available. Install another protocol pack from
            Library to unlock swaps.
          </p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {alternatives.map((alt) => (
              <button
                key={alt.canonicalKey}
                onClick={() => onSelect(alt.canonicalKey)}
                className="press tr-fast flex w-full items-center gap-3 rounded-[var(--r-md)] p-3 text-left"
                style={{ background: "var(--surface-3)" }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background:
                      "color-mix(in srgb, var(--readiness) 14%, var(--surface-3))",
                    color: "var(--readiness)",
                  }}
                >
                  <Icon name={alt.icon as IconName} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-[var(--text-1)]">
                    {alt.title}
                  </span>
                  {alt.dose && (
                    <span className="mt-0.5 block text-[11.5px] text-[var(--text-3)]">
                      {alt.dose}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="press tr-fast mt-4 w-full py-2 text-[12.5px] text-[var(--text-3)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
