"use client";

/**
 * QuickAdd — drop a behavior in for TODAY only (DailyLog.oneOffs), without
 * touching the installed protocol. Pick from the behavior library or type a
 * custom one; one-offs render in their block on Today and are removable here.
 */
import { useMemo, useState } from "react";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import { listBehaviorAtoms } from "@/lib/packs";
import { Sheet, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { TimeBlock } from "@/lib/types";

const BLOCKS: { value: TimeBlock; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "anytime", label: "Anytime" },
];

export default function QuickAdd({ date }: { date: string }) {
  const { state, addOneOff, removeOneOff } = useAppState();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"library" | "custom">("library");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [block, setBlock] = useState<TimeBlock>("anytime");

  const oneOffs = getLogForDate(state, date).oneOffs ?? [];
  const atoms = useMemo(() => listBehaviorAtoms(), []);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = query
      ? atoms.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            (a.rationale ?? "").toLowerCase().includes(query)
        )
      : atoms;
    return base.slice(0, 40);
  }, [atoms, q]);

  const addAtom = (a: (typeof atoms)[number]) => {
    addOneOff(date, {
      key: a.canonicalKey,
      title: a.title,
      block: a.block,
      icon: a.icon,
      dose: a.dose,
    });
    setOpen(false);
  };
  const addCustom = () => {
    const t = title.trim();
    if (!t) return;
    const slug =
      t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24) || "item";
    const key = `oneoff:${slug}-${Math.random().toString(36).slice(2, 6)}`;
    addOneOff(date, { key, title: t, block, icon: "check" });
    setTitle("");
    setBlock("anytime");
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press tr-fast row flex w-full items-center justify-center gap-2 py-3 text-[13px] font-semibold text-[var(--text-3)]"
      >
        <Icon name="plus" size={15} /> Add something for today
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add for today">
        {oneOffs.length > 0 && (
          <div className="mb-4">
            <Eyebrow>Today&rsquo;s extras</Eyebrow>
            <div className="mt-2 space-y-1">
              {oneOffs.map((o) => (
                <div
                  key={o.key}
                  className="row flex items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-1)]">
                    {o.title}
                  </span>
                  <button
                    onClick={() => removeOneOff(date, o.key)}
                    className="press shrink-0 text-[12px] font-semibold text-[var(--alert)]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex gap-2">
          {(["library", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2 text-[13px] font-semibold"
              style={{
                background: mode === m ? "var(--text-1)" : "var(--surface-3)",
                color: mode === m ? "var(--bg)" : "var(--text-2)",
              }}
            >
              {m === "library" ? "From library" : "Custom"}
            </button>
          ))}
        </div>

        {mode === "library" ? (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search behaviors"
              aria-label="Search behaviors"
              className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)]"
            />
            <div className="mt-2 max-h-[44vh] space-y-1 overflow-y-auto">
              {filtered.map((a) => (
                <button
                  key={a.canonicalKey}
                  onClick={() => addAtom(a)}
                  className="press tr-fast row flex w-full items-center gap-3 px-3.5 py-3 text-left"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                  >
                    <Icon name={a.icon as IconName} size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-1)]">
                    {a.title}
                  </span>
                  <Icon
                    name="plus"
                    size={15}
                    className="shrink-0 text-[var(--text-3)]"
                  />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sauna, 15 min"
              aria-label="Behavior title"
              className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)]"
            />
            <div className="flex gap-2">
              {BLOCKS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBlock(b.value)}
                  className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2 text-[12px] font-semibold"
                  style={{
                    background:
                      block === b.value ? "var(--text-1)" : "var(--surface-3)",
                    color: block === b.value ? "var(--bg)" : "var(--text-2)",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <button
              onClick={addCustom}
              disabled={!title.trim()}
              className="press tr-fast w-full rounded-[var(--r-pill)] py-3 text-[14px] font-semibold text-[var(--bg)] disabled:opacity-40"
              style={{ background: "var(--vitality)" }}
            >
              Add for today
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
