"use client";

import { useState, useEffect } from "react";
import { Sheet, Eyebrow, Button } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import type { Supplement, TimeBlock } from "@/lib/types";

/**
 * SupplementSheet — full-detail editor for one supplement. Handles
 * both curated supplements (some fields auto-filled, name typically
 * fixed) and custom ones (everything editable). For curated rows the
 * user can still override dose, brand, timing notes, and inventory
 * without losing the link to the curated source (`derivedFrom`).
 *
 * Used by:
 *   - /supplements (the management surface) for direct edits
 *   - SupplementBlockCard tap-to-detail (future enhancement)
 *
 * Sections:
 *   1. Identity (name, dose, brand, block, timing note)
 *   2. Days active (Mon-Sun toggles)
 *   3. Inventory (count + refill threshold)
 *   4. Notes (free text)
 *   5. Curated context (rationale + evidence framing, read-only)
 *   6. Danger zone (remove)
 */
const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function SupplementSheet({
  supplement,
  onClose,
  onSave,
  onRemove,
}: {
  supplement: Supplement | null;
  onClose: () => void;
  onSave: (patch: Partial<Supplement>) => void;
  onRemove?: () => void;
}) {
  // Local working copy so edits don't fire on every keystroke; we
  // commit on Save. Reset whenever the supplement prop changes.
  const [draft, setDraft] = useState<Supplement | null>(supplement);
  useEffect(() => {
    setDraft(supplement);
  }, [supplement]);

  if (!supplement || !draft) return null;
  const isCustom = draft.source === "custom";
  const inv = draft.inventory;
  const days =
    draft.daysActive ?? new Array(7).fill(true);

  const patch = (p: Partial<Supplement>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <Sheet
      open={!!supplement}
      onClose={onClose}
      title={draft.name || "Supplement"}
    >
      <div className="space-y-6">
        {/* Identity */}
        <div>
          <Eyebrow>Name</Eyebrow>
          <input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            disabled={!isCustom}
            className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <Eyebrow>Dose</Eyebrow>
          <input
            value={draft.dose ?? ""}
            placeholder="e.g. 200 mg, 1 capsule, 5 g"
            onChange={(e) => patch({ dose: e.target.value || undefined })}
            className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
          />
        </div>

        <div>
          <Eyebrow>Brand or product</Eyebrow>
          <input
            value={draft.brand ?? ""}
            placeholder="Optional — e.g. Thorne, Pure Encapsulations"
            onChange={(e) =>
              patch({ brand: e.target.value || undefined })
            }
            className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
          />
        </div>

        <div>
          <Eyebrow>When</Eyebrow>
          <div
            className="mt-2 flex gap-1 rounded-[var(--r-pill)] p-1"
            style={{ background: "var(--surface-2)" }}
          >
            {BLOCKS.map((b) => {
              const on = draft.block === b;
              return (
                <button
                  key={b}
                  onClick={() => patch({ block: b })}
                  className="flex-1 rounded-[var(--r-pill)] py-2 text-[12px] font-semibold capitalize tr-fast"
                  style={{
                    background: on ? "var(--text-1)" : "transparent",
                    color: on ? "var(--bg)" : "var(--text-3)",
                  }}
                >
                  {b}
                </button>
              );
            })}
          </div>
          <input
            value={draft.timing ?? ""}
            placeholder="Timing note — e.g. with breakfast, before bed"
            onChange={(e) =>
              patch({ timing: e.target.value || undefined })
            }
            className="mt-2.5 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-2)] outline-none"
          />
        </div>

        <div>
          <Eyebrow>Days active</Eyebrow>
          <div className="mt-2.5 flex justify-between gap-1.5">
            {DAYS.map((d, i) => {
              const on = days[i];
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = [...days];
                    next[i] = !next[i];
                    // Require ≥1 active day. An all-off supplement disappears
                    // from the Stack on every weekday — a custom one would be
                    // stranded with no way to re-open, edit, or delete it.
                    if (next.every((d) => !d)) return;
                    patch({ daysActive: next });
                  }}
                  className="press tr-fast h-11 flex-1 rounded-[var(--r-sm)] text-[13px] font-bold"
                  style={{
                    background: on ? "var(--warm)" : "var(--surface-2)",
                    color: on ? "var(--bg)" : "var(--text-4)",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inventory */}
        <div>
          <Eyebrow>Inventory</Eyebrow>
          <p className="t-caption mt-1 mb-3 leading-relaxed">
            Track how many doses you have left so we can flag a
            refill before you run out. Leave it off if you don&apos;t
            want to track it.
          </p>
          {inv ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--text-3)] flex-1">
                  Doses remaining
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={inv.count}
                  min={0}
                  onChange={(e) =>
                    patch({
                      inventory: {
                        ...inv,
                        count: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                  className="w-24 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-right text-[14px] text-[var(--text-1)] outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--text-3)] flex-1">
                  Warn when below
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={inv.refillAt ?? 7}
                  min={0}
                  onChange={(e) =>
                    patch({
                      inventory: {
                        ...inv,
                        refillAt: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                  className="w-24 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-right text-[14px] text-[var(--text-1)] outline-none"
                />
              </div>
              <button
                onClick={() => patch({ inventory: undefined })}
                className="press tr-fast tap-44 text-[12.5px] font-semibold text-[var(--text-3)]"
              >
                Stop tracking inventory
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                patch({
                  inventory: {
                    count: 30,
                    refillAt: 7,
                    updatedAt: new Date().toISOString(),
                  },
                })
              }
              className="press tr-fast rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-2 text-[13px] font-semibold text-[var(--text-2)]"
            >
              Start tracking inventory
            </button>
          )}
        </div>

        {/* Notes */}
        <div>
          <Eyebrow>Notes</Eyebrow>
          <textarea
            value={draft.notes ?? ""}
            placeholder="Optional — anything you want to remember"
            onChange={(e) =>
              patch({ notes: e.target.value || undefined })
            }
            rows={2}
            className="mt-2 w-full resize-none rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-2)] outline-none"
          />
        </div>

        {/* Curated rationale — read-only context */}
        {draft.rationale && (
          <div>
            <Eyebrow>Why take it</Eyebrow>
            <p className="t-body mt-2.5 leading-relaxed text-[var(--text-2)]">
              {draft.rationale}
            </p>
          </div>
        )}

        {/* Save / Remove */}
        <div className="flex gap-3 pt-2">
          {onRemove && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${draft.name}? Your past completion history is kept.`
                  )
                ) {
                  onRemove();
                  onClose();
                }
              }}
              className="press tr-fast flex shrink-0 items-center gap-1 rounded-[var(--r-pill)] py-3 px-4 text-[13px] font-semibold text-[var(--alert)]"
            >
              <Icon name="ban" size={13} />
              Remove
            </button>
          )}
          <Button
            full
            onClick={() => {
              const { id: _id, source: _s, ...patch } = draft;
              onSave(patch);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
