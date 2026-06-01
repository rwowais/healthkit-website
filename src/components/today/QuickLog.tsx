"use client";

/**
 * QuickLog — type one line ("slept 7h, energy low, felt good") and the
 * parser fills your check-in. Faster than tapping through forms. Heuristic,
 * on-device (no API); it only applies what it's confident about and keeps
 * the full text as your day note so nothing is lost. Collapsed by default
 * so it never competes with the tap-based check-in.
 */
import { useState } from "react";
import { parseQuickLog } from "@/lib/quicklog";
import { useToast } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

export default function QuickLog({
  onApply,
}: {
  /** Apply parsed values. Each field is set only if recognized. */
  onApply: (v: {
    energy?: number;
    mood?: number;
    sleepQuality?: number;
    sleepDurationMinutes?: number;
    note: string;
  }) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    const parsed = parseQuickLog(text);
    if (!text.trim()) return;
    onApply({
      energy: parsed.energy,
      mood: parsed.mood,
      sleepQuality: parsed.sleepQuality,
      sleepDurationMinutes:
        parsed.sleepHours != null ? Math.round(parsed.sleepHours * 60) : undefined,
      note: parsed.note,
    });
    const summary = parsed.understood.length
      ? `Logged — ${parsed.understood.join(", ")}`
      : "Saved to your day note";
    toast.show(summary);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press tr-fast inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-3)]"
      >
        <Icon name="sparkle" size={13} />
        Quick log in words
      </button>
    );
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <Icon name="sparkle" size={14} className="text-[var(--readiness)]" />
        <p className="text-[13px] font-semibold text-[var(--text-1)]">
          Quick log
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="e.g. slept 7h, energy low, felt good"
        rows={2}
        autoFocus
        className="mt-2 w-full resize-none rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)]"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-4)]">
        Fills your sleep, energy, and mood from plain words. The full line is
        kept as today&rsquo;s note.
      </p>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="press tr-fast rounded-[var(--r-pill)] px-3.5 py-2 text-[13px] font-semibold text-[var(--text-3)]"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="press tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: "var(--readiness)", color: "var(--bg)" }}
        >
          Log it
        </button>
      </div>
    </div>
  );
}
