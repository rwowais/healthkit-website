"use client";

/**
 * DailyReflection — the calm end-of-day prompt.
 *
 * Surfaces on Today once the user is most of the way through the
 * day (60%+ completion OR evening block has started). Collects:
 *   - mood (3 options: rough / okay / good)
 *   - optional one-line note ("what mattered today")
 *
 * Why a separate reflection from the morning check-in:
 *   The morning check-in's job is to feed the adaptive engine —
 *   "how recovered are you?" → mode picker. The evening reflection
 *   is a different ritual: closing the day, building a journal-like
 *   trail, and giving Insights a sentiment dimension over weeks/
 *   months. Same DailyLog row; different question.
 *
 * Self-dismissing: once moodLevel is set on the day's log, the
 * card disappears (parent guards on log.moodLevel == null). The
 * note is optional — recording mood alone is enough to close the
 * ritual.
 *
 * Voice: warm, low-pressure, "no wrong answer." A user who had a
 * hard day should feel met, not judged.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Eyebrow } from "@/components/ui";
import * as haptic from "@/lib/haptics";

interface DailyReflectionProps {
  date: string;
  currentNote: string;
  onMood: (mood: number) => void;
  onNote: (note: string) => void;
}

const MOODS: { label: string; value: number; emoji: string }[] = [
  { label: "Rough", value: 2, emoji: "🌫" },
  { label: "Okay", value: 3, emoji: "🌤" },
  { label: "Good", value: 5, emoji: "🌅" },
];

export default function DailyReflection({
  currentNote,
  onMood,
  onNote,
}: DailyReflectionProps) {
  const [note, setNote] = useState(currentNote);
  const [showNote, setShowNote] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 rounded-[var(--r-xl)] p-5"
      style={{
        background:
          "linear-gradient(155deg, color-mix(in srgb, var(--warm) 10%, var(--surface-1)), var(--surface-1) 70%)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <Eyebrow color="var(--warm)">Reflection</Eyebrow>
      <p className="mt-2 text-[18px] font-bold leading-snug text-[var(--text-1)]">
        How was today?
      </p>
      <p className="t-caption mt-1 leading-relaxed">
        One tap. No wrong answer. This becomes your trail over time.
      </p>
      <div className="mt-4 flex gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => {
              haptic.light();
              onMood(m.value);
            }}
            className="press tr-fast flex-1 rounded-[var(--r-md)] py-3 text-[13px] font-semibold"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-1)",
            }}
          >
            <span className="block text-[18px] leading-none">{m.emoji}</span>
            <span className="mt-1.5 block">{m.label}</span>
          </button>
        ))}
      </div>
      {/* Optional one-line journal note. Tucked behind a disclosure
          so the primary action stays a single tap. The textarea
          uses onBlur to persist (no every-keystroke writes), keeping
          input snappy on slow devices. */}
      {!showNote ? (
        <button
          onClick={() => setShowNote(true)}
          className="press tr-fast mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-3)] underline-offset-2 hover:underline"
        >
          + Add a one-line note
        </button>
      ) : (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onNote(note.trim())}
            placeholder="What mattered today?"
            rows={2}
            maxLength={280}
            className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)]"
          />
          <p className="t-caption mt-1 text-right">
            {note.length}/280
          </p>
        </div>
      )}
    </motion.div>
  );
}
