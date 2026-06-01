"use client";

/**
 * WorkoutSwapSheet — the bottom sheet for swapping a scheduled workout
 * for an alternative the user actually did today. Built on the shared
 * accessible `Sheet` primitive (focus trap, Escape, focus restore,
 * role=dialog). Pure + prop-driven: the parent computes alternatives and
 * owns the swap persistence.
 */
import { Sheet } from "@/components/ui";
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
  return (
    <Sheet
      open={!!swapForKey}
      onClose={onClose}
      title={`${originalTitle ?? "Workout"} → ?`}
    >
      <p className="t-caption mb-3 leading-relaxed">
        Pick what you actually did. We&apos;ll mark it complete for today; your
        original schedule is unchanged.
      </p>
      {alternatives.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)]">
          No other workouts available. Install another protocol pack from
          Library to unlock swaps.
        </p>
      ) : (
        <div className="space-y-1.5">
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
    </Sheet>
  );
}
