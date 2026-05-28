"use client";

/**
 * BulkMoveSheet — the bottom sheet that picks a destination block for
 * a multi-selected group of behaviors in Today's edit mode. Replaced
 * the four inline pills that overflowed the action bar on narrow
 * screens. Pure + prop-driven; the parent keeps the move logic
 * (timeline lookup, requestBlockMove, selection clearing) and wires
 * it through onSelectBlock so behavior is identical to the inline
 * version it replaced.
 */
import { blockLabel } from "@/lib/engine";
import type { TimeBlock } from "@/lib/types";

interface BulkMoveSheetProps {
  open: boolean;
  /** How many behaviors are selected (drives the header copy). */
  count: number;
  /** Called with the chosen destination block. Parent does the move. */
  onSelectBlock: (block: TimeBlock) => void;
  onClose: () => void;
}

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

export default function BulkMoveSheet({
  open,
  count,
  onSelectBlock,
  onClose,
}: BulkMoveSheetProps) {
  if (!open) return null;
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
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--text-4)]" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Move {count} to
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BLOCKS.map((b) => (
            <button
              key={b}
              onClick={() => onSelectBlock(b)}
              className="press tr-fast rounded-[var(--r-md)] py-3 text-[13.5px] font-semibold"
              style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
            >
              {blockLabel(b)}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="press tr-fast mt-3 w-full py-2 text-[12.5px] text-[var(--text-3)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
