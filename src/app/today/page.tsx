"use client";

import { useCallback, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import type { DailyLog, Pillar, ProtocolItem, TimeOfDay } from "@/lib/types";
import {
  calculateDisplayTime,
  deriveTimeOfDay,
  formatDisplayTime,
  sortByTime,
  timeStringToMinutes,
} from "@/lib/timing";
import { calculateDailyScore, calculateStreak } from "@/lib/scoring";

// ── Helpers ─────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getEnabledItemsForDate(
  protocols: Record<Pillar, ProtocolItem[]>,
  dateStr: string
): ProtocolItem[] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun

  return PILLARS.flatMap((p) =>
    protocols[p].filter((item) => item.isEnabled && item.daysActive[isoDay])
  );
}

function getOrCreateLog(
  logs: DailyLog[],
  dateStr: string,
  enabledItems: ProtocolItem[]
): DailyLog {
  const existing = logs.find((l) => l.date === dateStr);
  if (existing) return existing;
  return {
    date: dateStr,
    completions: enabledItems.map((item) => ({
      itemId: item.id,
      completedAt: null,
      note: "",
      skipped: false,
    })),
    sleepLog: {
      actualBedtime: null,
      actualWakeTime: null,
      sleepQuality: null,
      sleepDurationMinutes: null,
    },
    energyLevel: null,
    moodLevel: null,
    dayNote: "",
    score: 0,
  };
}

function computeSleepDuration(
  bedtime: string | null,
  wakeTime: string | null
): number | null {
  if (!bedtime || !wakeTime) return null;
  const bedMinutes = timeStringToMinutes(bedtime);
  const wakeMinutes = timeStringToMinutes(wakeTime);
  let duration = wakeMinutes - bedMinutes;
  if (duration <= 0) duration += 1440;
  return duration;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function generateInsight(
  state: { dailyLogs: DailyLog[]; currentStreak: number },
  enabledItems: ProtocolItem[],
  settings: { wakeTime: string; bedtime: string }
): string {
  const logs = state.dailyLogs;
  const last7 = logs
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  if (last7.length < 2) {
    return "Start checking off your protocols to unlock personalized insights about your routine patterns.";
  }

  // Check morning completion correlation with energy
  const morningItems = enabledItems.filter((item) => {
    const time = calculateDisplayTime(item, settings as any);
    return deriveTimeOfDay(time) === "morning";
  });

  if (morningItems.length > 0) {
    const daysWithAllMorning = last7.filter((log) =>
      morningItems.every((item) =>
        log.completions.some(
          (c) => c.itemId === item.id && c.completedAt !== null
        )
      )
    );
    if (daysWithAllMorning.length >= 3) {
      const avgEnergy =
        daysWithAllMorning
          .filter((l) => l.energyLevel !== null)
          .reduce((s, l) => s + (l.energyLevel ?? 0), 0) /
        Math.max(
          1,
          daysWithAllMorning.filter((l) => l.energyLevel !== null).length
        );
      if (avgEnergy >= 3.5) {
        return `Your energy averages ${avgEnergy.toFixed(1)}/5 on days you complete all morning protocols. Keep that morning routine strong.`;
      }
    }
  }

  // Evening wind-down streak
  const eveningItems = enabledItems.filter((item) => {
    const time = calculateDisplayTime(item, settings as any);
    return deriveTimeOfDay(time) === "evening";
  });
  if (eveningItems.length > 0) {
    const daysWithEvening = last7.filter((log) =>
      eveningItems.every((item) =>
        log.completions.some(
          (c) => c.itemId === item.id && c.completedAt !== null
        )
      )
    );
    if (daysWithEvening.length >= 4) {
      return `You've completed your evening wind-down ${daysWithEvening.length} of the last ${last7.length} days. Consistency here drives better sleep quality.`;
    }
  }

  // Streak-based
  if (state.currentStreak >= 7) {
    return `${state.currentStreak}-day streak and counting. Research shows habit formation accelerates after the first week of consistency.`;
  }

  // Completion rate
  const avgCompletion =
    last7.reduce((sum, log) => {
      const completed = log.completions.filter(
        (c) => c.completedAt !== null
      ).length;
      const total = log.completions.length || 1;
      return sum + completed / total;
    }, 0) / last7.length;

  if (avgCompletion >= 0.8) {
    return `You're averaging ${Math.round(avgCompletion * 100)}% completion over the past week. That level of adherence drives real physiological adaptation.`;
  }

  return "Track your protocols consistently to unlock personalized insights about what's working for you.";
}

// ── Time-of-day section config ──────────────────────────────────

const TIME_SECTIONS: {
  key: TimeOfDay;
  label: string;
  icon: string;
}[] = [
  { key: "morning", label: "Morning", icon: "sunrise" },
  { key: "afternoon", label: "Afternoon", icon: "sun" },
  { key: "evening", label: "Evening", icon: "sunset" },
  { key: "night", label: "Night", icon: "moon" },
];

// ── Score Ring Component ────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  const offset = circumference * (1 - progress);

  let color = "#0071e3"; // blue default
  if (score >= 100) color = "#30d158";
  else if (score > 70) color = "#0071e3";
  else if (score >= 30) color = "#ff9f0a";
  else if (score > 0) color = "#ff453a";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f5f5f7"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="animate-score-ring"
            style={
              {
                "--ring-circumference": circumference,
                "--ring-offset": offset,
              } as React.CSSProperties
            }
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[36px] font-bold text-[#1d1d1f] leading-none"
            style={{ color: score > 0 ? color : "#1d1d1f" }}
          >
            {score}
          </span>
          <span className="text-[13px] text-[#86868b] -mt-0.5">/100</span>
        </div>
      </div>
    </div>
  );
}

// ── Checkbox Component ──────────────────────────────────────────

function CheckCircle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex-shrink-0 w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-apple"
      style={{
        borderColor: checked ? "#30d158" : "#d2d2d7",
        backgroundColor: checked ? "#30d158" : "transparent",
      }}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
    >
      {checked && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="animate-check"
        >
          <path
            d="M3 7.5L5.5 10L11 4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ── Rating Components ───────────────────────────────────────────

function EnergyRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-3 flex-1 min-w-0">
      <div className="text-[11px] text-[#86868b] font-medium mb-1.5 text-center">
        Energy
      </div>
      <div className="flex justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className="text-[18px] transition-apple hover:scale-110 active:scale-95 p-0.5"
            style={{
              opacity: value !== null && level <= value ? 1 : 0.25,
              filter:
                value !== null && level <= value ? "none" : "grayscale(1)",
            }}
            aria-label={`Energy level ${level}`}
          >
            {"⚡"}
          </button>
        ))}
      </div>
    </div>
  );
}

function MoodRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const faces = ["😞", "😕", "😐", "🙂", "😊"];
  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-3 flex-1 min-w-0">
      <div className="text-[11px] text-[#86868b] font-medium mb-1.5 text-center">
        Mood
      </div>
      <div className="flex justify-center gap-0.5">
        {faces.map((face, i) => (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            className="text-[18px] transition-apple hover:scale-110 active:scale-95 p-0.5"
            style={{
              opacity: value !== null && i + 1 <= value ? 1 : 0.25,
              filter:
                value !== null && i + 1 <= value ? "none" : "grayscale(1)",
            }}
            aria-label={`Mood level ${i + 1}`}
          >
            {face}
          </button>
        ))}
      </div>
    </div>
  );
}

function SleepQualityRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-3 flex-1 min-w-0">
      <div className="text-[11px] text-[#86868b] font-medium mb-1.5 text-center">
        Sleep
      </div>
      <div className="flex justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className="text-[18px] transition-apple hover:scale-110 active:scale-95 p-0.5"
            style={{
              opacity: value !== null && level <= value ? 1 : 0.25,
              filter:
                value !== null && level <= value ? "none" : "grayscale(1)",
            }}
            aria-label={`Sleep quality ${level}`}
          >
            {"⭐"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Protocol Row Component ──────────────────────────────────────

function ProtocolRow({
  item,
  displayTime,
  isCompleted,
  note,
  onToggle,
  onNoteChange,
}: {
  item: ProtocolItem;
  displayTime: string;
  isCompleted: boolean;
  note: string;
  onToggle: () => void;
  onNoteChange: (note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localNote, setLocalNote] = useState(note);
  const pillarMeta = PILLAR_META[item.pillar];

  return (
    <div
      className="rounded-xl transition-apple overflow-hidden"
      style={{
        backgroundColor: isCompleted
          ? "rgba(48, 209, 88, 0.05)"
          : "transparent",
        border: isCompleted
          ? "1px solid rgba(48, 209, 88, 0.2)"
          : "1px solid transparent",
      }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle checked={isCompleted} onToggle={onToggle} />

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#86868b]">
              {formatDisplayTime(displayTime)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px]">{item.icon}</span>
            <span
              className="text-[15px] font-medium text-[#1d1d1f] truncate"
              style={{
                textDecoration: isCompleted ? "line-through" : "none",
                opacity: isCompleted ? 0.6 : 1,
              }}
            >
              {item.name}
            </span>
          </div>
        </div>

        {/* Pillar dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: pillarMeta.color }}
          title={pillarMeta.label}
        />

        {/* Expand chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 transition-apple text-[#86868b]"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Expanded notes */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <textarea
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={() => {
              if (localNote !== note) {
                onNoteChange(localNote);
              }
            }}
            placeholder="Add a note..."
            className="w-full text-[13px] text-[#1d1d1f] placeholder:text-[#86868b]/50 bg-white border border-[#d2d2d7]/30 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#0071e3]/40 transition-apple"
            rows={2}
          />
          {item.description && (
            <p className="text-[11px] text-[#86868b] mt-1.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function TodayPage() {
  const { state, loading, toggleCompletion, updateNote, updateSleepLog, updateRatings } =
    useAppState();
  const today = useToday();

  // Date navigation state
  const [dateOffset, setDateOffset] = useState(0);

  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return formatDateKey(d);
  }, [dateOffset]);

  const isToday = dateOffset === 0;

  const displayDate = useMemo(
    () => formatDisplayDate(selectedDate),
    [selectedDate]
  );

  // Get enabled items for selected date
  const enabledItems = useMemo(
    () => getEnabledItemsForDate(state.protocols, selectedDate),
    [state.protocols, selectedDate]
  );

  // Get or create the daily log
  const dailyLog = useMemo(
    () => getOrCreateLog(state.dailyLogs, selectedDate, enabledItems),
    [state.dailyLogs, selectedDate, enabledItems]
  );

  // Compute score
  const score = useMemo(
    () => calculateDailyScore(dailyLog, enabledItems, state.settings),
    [dailyLog, enabledItems, state.settings]
  );

  // Streak
  const streak = useMemo(
    () => calculateStreak(state.dailyLogs),
    [state.dailyLogs]
  );

  // Group items by time of day
  const groupedItems = useMemo(() => {
    const sorted = sortByTime(enabledItems, state.settings);
    const groups: Record<
      TimeOfDay,
      { item: ProtocolItem; time: string }[]
    > = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    for (const item of sorted) {
      const time = calculateDisplayTime(item, state.settings);
      const tod = deriveTimeOfDay(time);
      groups[tod].push({ item, time });
    }

    return groups;
  }, [enabledItems, state.settings]);

  // Check if sleep protocols exist
  const hasSleepProtocols = useMemo(
    () => enabledItems.some((item) => item.pillar === "sleep"),
    [enabledItems]
  );

  // Sleep log section state
  const [sleepExpanded, setSleepExpanded] = useState(false);

  // Sleep duration
  const sleepDuration = useMemo(
    () =>
      computeSleepDuration(
        dailyLog.sleepLog.actualBedtime,
        dailyLog.sleepLog.actualWakeTime
      ),
    [dailyLog.sleepLog.actualBedtime, dailyLog.sleepLog.actualWakeTime]
  );

  // AI insight
  const insight = useMemo(
    () => generateInsight(state, enabledItems, state.settings),
    [state, enabledItems, state.settings]
  );

  // Handlers
  const handleToggle = useCallback(
    (itemId: string) => {
      toggleCompletion(selectedDate, itemId);
    },
    [selectedDate, toggleCompletion]
  );

  const handleNoteChange = useCallback(
    (itemId: string, note: string) => {
      updateNote(selectedDate, itemId, note);
    },
    [selectedDate, updateNote]
  );

  const handleSleepLogChange = useCallback(
    (field: string, value: string | null) => {
      const update: any = { [field]: value };

      // Auto-calculate duration when both times are set
      if (field === "actualBedtime" || field === "actualWakeTime") {
        const bedtime =
          field === "actualBedtime"
            ? value
            : dailyLog.sleepLog.actualBedtime;
        const wakeTime =
          field === "actualWakeTime"
            ? value
            : dailyLog.sleepLog.actualWakeTime;
        const duration = computeSleepDuration(bedtime, wakeTime);
        update.sleepDurationMinutes = duration;
      }

      updateSleepLog(selectedDate, update);
    },
    [selectedDate, dailyLog.sleepLog, updateSleepLog]
  );

  // Loading skeleton
  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 py-8 animate-pulse">
          <div className="h-5 w-40 bg-[#f5f5f7] rounded-lg" />
          <div className="w-[140px] h-[140px] rounded-full bg-[#f5f5f7]" />
          <div className="h-4 w-32 bg-[#f5f5f7] rounded-lg" />
          <div className="w-full space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-[#f5f5f7] rounded-xl" />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6 pb-4">
        {/* ── Date Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setDateOffset((prev) => prev - 1)}
            className="p-2 rounded-full hover:bg-[#f5f5f7] transition-apple text-[#86868b] hover:text-[#1d1d1f]"
            aria-label="Previous day"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M11 4L6 9L11 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[19px] font-semibold text-[#1d1d1f]">
              {displayDate}
            </span>
            {isToday && (
              <span className="text-[11px] font-semibold text-[#0071e3] mt-0.5">
                Today
              </span>
            )}
          </div>

          <button
            onClick={() => setDateOffset((prev) => Math.min(prev + 1, 0))}
            disabled={isToday}
            className="p-2 rounded-full hover:bg-[#f5f5f7] transition-apple disabled:opacity-20 disabled:cursor-not-allowed text-[#86868b] hover:text-[#1d1d1f]"
            aria-label="Next day"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M7 4L12 9L7 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Score Ring ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={score} />

          {/* Streak badge */}
          {streak > 0 ? (
            <div className="bg-[#ff9f0a]/10 text-[#ff9f0a] rounded-full px-3 py-1 text-[13px] font-medium">
              {"🔥"} {streak} day streak
            </div>
          ) : (
            <div className="bg-[#f5f5f7] text-[#86868b] rounded-full px-3 py-1 text-[13px] font-medium">
              Start your streak!
            </div>
          )}
        </div>

        {/* ── Timeline Sections ────────────────────────────────── */}
        {TIME_SECTIONS.map(({ key, label }) => {
          const items = groupedItems[key];
          if (items.length === 0) return null;

          const completedCount = items.filter(({ item }) =>
            dailyLog.completions.some(
              (c) => c.itemId === item.id && c.completedAt !== null
            )
          ).length;

          return (
            <div key={key}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[12px] text-[#86868b]">
                  {completedCount} of {items.length}
                </span>
              </div>

              {/* Protocol items */}
              <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden divide-y divide-[#d2d2d7]/15">
                {items.map(({ item, time }) => {
                  const completion = dailyLog.completions.find(
                    (c) => c.itemId === item.id
                  );
                  const isCompleted = completion?.completedAt !== null && completion?.completedAt !== undefined;
                  const noteValue = completion?.note ?? "";

                  return (
                    <ProtocolRow
                      key={item.id}
                      item={item}
                      displayTime={time}
                      isCompleted={isCompleted}
                      note={noteValue}
                      onToggle={() => handleToggle(item.id)}
                      onNoteChange={(note) =>
                        handleNoteChange(item.id, note)
                      }
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Empty state ──────────────────────────────────────── */}
        {enabledItems.length === 0 && (
          <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-8 text-center">
            <div className="text-[32px] mb-3">{"🧬"}</div>
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">
              No protocols scheduled
            </h3>
            <p className="text-[13px] text-[#86868b] leading-relaxed">
              Visit the pillar pages to enable protocols for this day.
            </p>
          </div>
        )}

        {/* ── Quick Ratings ────────────────────────────────────── */}
        {enabledItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">
                How are you feeling?
              </span>
            </div>
            <div className="flex gap-2">
              <EnergyRating
                value={dailyLog.energyLevel}
                onChange={(v) =>
                  updateRatings(selectedDate, { energy: v })
                }
              />
              <MoodRating
                value={dailyLog.moodLevel}
                onChange={(v) =>
                  updateRatings(selectedDate, { mood: v })
                }
              />
              {hasSleepProtocols && (
                <SleepQualityRating
                  value={dailyLog.sleepLog.sleepQuality}
                  onChange={(v) =>
                    updateSleepLog(selectedDate, { sleepQuality: v })
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ── Sleep Log ────────────────────────────────────────── */}
        {hasSleepProtocols && (
          <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
            <button
              onClick={() => setSleepExpanded(!sleepExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[15px]">{"🌙"}</span>
                <span className="text-[15px] font-medium text-[#1d1d1f]">
                  Sleep Data
                </span>
                {sleepDuration !== null && (
                  <span className="text-[12px] text-[#86868b] ml-1">
                    {formatDuration(sleepDuration)}
                  </span>
                )}
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-[#86868b] transition-apple"
                style={{
                  transform: sleepExpanded
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                }}
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {sleepExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#d2d2d7]/15">
                <div className="flex gap-3 pt-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-[#86868b] font-medium block mb-1">
                      Bedtime
                    </label>
                    <input
                      type="time"
                      value={dailyLog.sleepLog.actualBedtime ?? ""}
                      onChange={(e) =>
                        handleSleepLogChange(
                          "actualBedtime",
                          e.target.value || null
                        )
                      }
                      className="w-full bg-white border border-[#d2d2d7]/30 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]/40 transition-apple"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-[#86868b] font-medium block mb-1">
                      Wake time
                    </label>
                    <input
                      type="time"
                      value={dailyLog.sleepLog.actualWakeTime ?? ""}
                      onChange={(e) =>
                        handleSleepLogChange(
                          "actualWakeTime",
                          e.target.value || null
                        )
                      }
                      className="w-full bg-white border border-[#d2d2d7]/30 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]/40 transition-apple"
                    />
                  </div>
                </div>

                {sleepDuration !== null && (
                  <div className="flex items-center gap-2 bg-[#5e5ce6]/5 rounded-lg px-3 py-2">
                    <span className="text-[13px] text-[#5e5ce6] font-medium">
                      Duration: {formatDuration(sleepDuration)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AI Insight Card ──────────────────────────────────── */}
        <div className="relative bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 overflow-hidden">
          {/* Gradient accent border on left */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{
              background:
                "linear-gradient(180deg, #0071e3 0%, #5e5ce6 50%, #30d158 100%)",
            }}
          />

          <div className="pl-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                Insight
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z"
                  fill="#ff9f0a"
                  stroke="#ff9f0a"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
            <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
              {insight}
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
