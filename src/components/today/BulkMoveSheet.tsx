"use client";

/**
 * BulkMoveSheet — the bottom sheet that picks a destination block for
 * a multi-selected group of behaviors in Today's edit mode. Built on the
 * shared accessible `Sheet` primitive (focus trap, Escape, focus restore,
 * role=dialog) so keyboard + screen-reader users are handled. Pure +
 * prop-driven; the parent keeps the move logic.
 */
import { Sheet } from "@/components/ui";
import { blockLabel } from "@/lib/engine";
import type { TimeBlock } from "@/lib/types";

interface BulkMoveSheetProps {
  open: boolean;
  /** How many behaviors are selected (drives the header copy). */
  count: number;
  /** Called with the chosen destination block. Parent does the move. */
  onSelectBlock: (block: TimeBlock) => void;
  onClose: () => void;
  /** Custom day-block display names (settings.blockLabels) so the
   *  destination labels match the user's renamed sections elsewhere. */
  blockLabels?: {
    morning?: string;
    afternoon?: string;
    evening?: string;
    anytime?: string;
  };
}

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

export default function BulkMoveSheet({
  open,
  count,
  onSelectBlock,
  onClose,
  blockLabels,
}: BulkMoveSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={`Move ${count} to`}>
      <div className="grid grid-cols-2 gap-2">
        {BLOCKS.map((b) => (
          <button
            key={b}
            onClick={() => onSelectBlock(b)}
            className="press tr-fast rounded-[var(--r-md)] py-3 text-[13.5px] font-semibold"
            style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
          >
            {blockLabel(b, blockLabels)}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="press tr-fast mt-3 w-full py-2 text-[12.5px] text-[var(--text-3)]"
      >
        Cancel
      </button>
    </Sheet>
  );
}
