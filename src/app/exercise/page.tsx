"use client";

import { useState, useMemo, useCallback } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import type { ProtocolItem, TimeOfDay } from "@/lib/types";
import {
  formatDisplayTime,
  calculateDisplayTime,
  deriveTimeOfDay,
  sortByTime,
} from "@/lib/timing";
import { PILLAR_META } from "@/lib/constants";

// ── Constants ──────────────────────────────────────────────────────

const EX_COLOR = PILLAR_META.exercise.color;
const EX_BG = PILLAR_META.exercise.bgLight;

const EMOJI_OPTIONS = [
  "🏋️", "🏃", "🚶", "🚴", "🏊", "🧘", "🤸", "⚖️",
  "🔥", "✊", "💪", "🫀", "⛔", "🌆", "🧗", "🥊",
  "🎯", "⏱️", "🦵", "🏔️", "🧠", "🛹", "🏄", "⚡",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helper: group items by training vs recovery ───────────────────

type SectionKey = "training" | "recovery";

function getSectionKey(tod: TimeOfDay): SectionKey {
  return tod === "morning" || tod === "afternoon" ? "training" : "recovery";
}

// ── Day Selector Component ────────────────────────────────────────

function DaySelector({
  daysActive,
  onChange,
}: {
  daysActive: boolean[];
  onChange: (days: boolean[]) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {DAYS.map((day, i) => (
        <button
          key={day}
          onClick={() => {
            const next = [...daysActive];
            next[i] = !next[i];
            onChange(next);
          }}
          className={`w-8 h-8 rounded-full text-[11px] font-semibold transition-apple ${
            daysActive[i]
              ? "text-white"
              : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]"
          }`}
          style={daysActive[i] ? { backgroundColor: EX_COLOR } : undefined}
        >
          {day[0]}
        </button>
      ))}
    </div>
  );
}

// ── Add Item Form ─────────────────────────────────────────────────

interface AddItemFormProps {
  section: SectionKey;
  onAdd: (item: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => void;
  onCancel: () => void;
}

function AddItemForm({ section, onAdd, onCancel }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("💪");
  const [offsetMinutes, setOffsetMinutes] = useState(
    section === "training" ? 120 : -150
  );
  const [daysActive, setDaysActive] = useState([
    true, true, true, true, true, true, true,
  ]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const anchor = section === "training" ? "wake" : "bed";

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      pillar: "exercise",
      name: name.trim(),
      description: description.trim(),
      source: "custom",
      timingAnchor: anchor as "wake" | "bed",
      timingOffsetMinutes: offsetMinutes,
      timeOfDay: section === "training" ? "morning" : "evening",
      daysActive,
      isEnabled: true,
      icon,
      recommendedBy: [],
      evidenceNote: "",
    });
  };

  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">
          Add Custom Item
        </h4>
        <button
          onClick={onCancel}
          className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-apple"
        >
          Cancel
        </button>
      </div>

      {/* Icon picker */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Icon
        </label>
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-11 h-11 rounded-xl bg-white border border-[#d2d2d7]/40 flex items-center justify-center text-[20px] hover:border-[#ff453a]/40 transition-apple"
          >
            {icon}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-13 left-0 z-10 bg-white border border-[#d2d2d7]/40 rounded-xl p-2 grid grid-cols-8 gap-1 shadow-lg animate-slide-up">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setIcon(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-9 h-9 rounded-lg hover:bg-[#f5f5f7] flex items-center justify-center text-[18px] transition-apple"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Hip Mobility Drills"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#ff453a]/50 focus:ring-1 focus:ring-[#ff453a]/20 outline-none transition-apple"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this exercise"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#ff453a]/50 focus:ring-1 focus:ring-[#ff453a]/20 outline-none transition-apple"
        />
      </div>

      {/* Days active */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-2">
          Active Days
        </label>
        <DaySelector daysActive={daysActive} onChange={setDaysActive} />
      </div>

      {/* Timing */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Timing (
          {section === "training"
            ? "minutes after wake"
            : "minutes before bed"}
          )
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={Math.abs(offsetMinutes)}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setOffsetMinutes(section === "training" ? val : -val);
            }}
            min={0}
            max={720}
            className="w-24 px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] focus:border-[#ff453a]/50 focus:ring-1 focus:ring-[#ff453a]/20 outline-none transition-apple"
          />
          <span className="text-[13px] text-[#86868b]">
            {section === "training" ? "min after waking" : "min before bed"}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="w-full py-2.5 rounded-full text-[13px] font-semibold transition-apple disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: name.trim() ? EX_COLOR : "#e5e5ea",
          color: name.trim() ? "#ffffff" : "#86868b",
        }}
      >
        Add to Protocol
      </button>
    </div>
  );
}

// ── Protocol Item Card ────────────────────────────────────────────

interface ItemCardProps {
  item: ProtocolItem;
  displayTime: string;
  isEditMode: boolean;
  isExpanded: boolean;
  todayIsActive: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

function ItemCard({
  item,
  displayTime,
  isEditMode,
  isExpanded,
  todayIsActive,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
}: ItemCardProps) {
  const [noteValue, setNoteValue] = useState("");

  const activeDayCount = item.daysActive.filter(Boolean).length;
  const daysSummary =
    activeDayCount === 7
      ? "Every day"
      : activeDayCount === 0
      ? "No days"
      : item.daysActive
          .map((active, i) => (active ? DAYS[i] : null))
          .filter(Boolean)
          .join(", ");

  return (
    <div
      className={`bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl transition-apple overflow-hidden ${
        !item.isEnabled ? "opacity-40" : !todayIsActive ? "opacity-60" : ""
      }`}
    >
      <div
        className="flex items-start gap-3.5 p-4 cursor-pointer"
        onClick={() => !isEditMode && onToggleExpand()}
      >
        {/* Edit mode: drag handle */}
        {isEditMode && (
          <div className="flex flex-col items-center justify-center gap-[3px] pt-2 cursor-grab opacity-30">
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
          </div>
        )}

        {/* Icon circle */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
          style={{ backgroundColor: EX_BG }}
        >
          {item.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
              {formatDisplayTime(displayTime)}
            </p>
            {!todayIsActive && item.isEnabled && (
              <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] rounded-full px-2 py-0.5">
                Rest day
              </span>
            )}
          </div>
          <p className="text-[15px] font-semibold text-[#1d1d1f] leading-snug">
            {item.name}
          </p>
          <p className="text-[13px] text-[#86868b] leading-relaxed mt-0.5 line-clamp-2">
            {item.description}
          </p>

          {/* Day schedule + source badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span
              className="text-[10px] font-medium rounded-full px-2 py-0.5"
              style={{ backgroundColor: EX_BG, color: EX_COLOR }}
            >
              {daysSummary}
            </span>
            {item.recommendedBy &&
              item.recommendedBy.map((source) => (
                <span
                  key={source}
                  className="text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] rounded-full px-2 py-0.5"
                >
                  {source}
                </span>
              ))}
          </div>
        </div>

        {/* Right side: edit controls or expand chevron */}
        {isEditMode ? (
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled();
              }}
              className={`relative w-[44px] h-[26px] rounded-full transition-apple ${
                item.isEnabled ? "" : "bg-[#e5e5ea]"
              }`}
              style={{
                backgroundColor: item.isEnabled ? EX_COLOR : undefined,
              }}
              aria-label={item.isEnabled ? "Disable item" : "Enable item"}
            >
              <span
                className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-apple ${
                  item.isEnabled ? "left-[21px]" : "left-[3px]"
                }`}
              />
            </button>

            {item.source === "custom" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-7 h-7 rounded-full bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30] hover:bg-[#ff3b30]/20 transition-apple"
                aria-label="Delete item"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <div className="w-7" />
            )}
          </div>
        ) : (
          <div className="shrink-0 pt-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#86868b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-apple ${isExpanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && !isEditMode && (
        <div className="px-4 pb-4 pt-0 space-y-3 animate-slide-up">
          <div className="h-px bg-[#d2d2d7]/20 mx-0" />

          {/* Evidence note */}
          {item.evidenceNote && (
            <div
              className="rounded-xl p-3.5"
              style={{ backgroundColor: EX_BG }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: EX_COLOR }}
              >
                Evidence
              </p>
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                {item.evidenceNote}
              </p>
            </div>
          )}

          {/* Notes input */}
          <div>
            <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
              Personal Notes
            </label>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add your notes here..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/30 text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] resize-none focus:border-[#ff453a]/50 focus:ring-1 focus:ring-[#ff453a]/20 outline-none transition-apple"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Component ─────────────────────────────────────────────

interface SectionProps {
  sectionKey: SectionKey;
  items: (ProtocolItem & { _displayTime: string })[];
  isEditMode: boolean;
  expandedId: string | null;
  todayIndex: number;
  onToggleExpand: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (
    item: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">
  ) => void;
}

function ProtocolSection({
  sectionKey,
  items,
  isEditMode,
  expandedId,
  todayIndex,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
  onAddItem,
}: SectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const isTraining = sectionKey === "training";
  const enabledCount = items.filter((i) => i.isEnabled).length;
  const todayActive = items.filter(
    (i) => i.isEnabled && i.daysActive[todayIndex]
  ).length;

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[20px]">{isTraining ? "💪" : "🌆"}</span>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
            {isTraining ? "Training" : "Recovery & Wind-Down"}
          </h2>
        </div>
        <span className="text-[13px] text-[#86868b] font-medium">
          {todayActive} today &middot; {enabledCount} total
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2.5">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            displayTime={item._displayTime}
            isEditMode={isEditMode}
            isExpanded={expandedId === item.id}
            todayIsActive={item.daysActive[todayIndex]}
            onToggleExpand={() => onToggleExpand(item.id)}
            onToggleEnabled={() => onToggleEnabled(item.id)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>

      {/* Add custom item */}
      {isEditMode && (
        <div className="pt-1">
          {showAddForm ? (
            <AddItemForm
              section={sectionKey}
              onAdd={(item) => {
                onAddItem(item);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[#d2d2d7]/40 text-[13px] font-semibold text-[#86868b] hover:border-[#ff453a]/30 hover:text-[#ff453a] transition-apple"
            >
              + Add Custom Item
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Weekly Overview Component ─────────────────────────────────────

function WeeklyOverview({ items }: { items: ProtocolItem[] }) {
  const enabled = items.filter((i) => i.isEnabled);

  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4">
      <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">
        Weekly Schedule
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, dayIndex) => {
          const count = enabled.filter((i) => i.daysActive[dayIndex]).length;
          const intensity =
            count === 0
              ? 0
              : count <= 2
              ? 1
              : count <= 4
              ? 2
              : 3;
          return (
            <div key={day} className="text-center">
              <p className="text-[10px] font-medium text-[#86868b] mb-1">
                {day}
              </p>
              <div
                className="w-full aspect-square rounded-lg flex items-center justify-center text-[12px] font-semibold transition-apple"
                style={{
                  backgroundColor:
                    intensity === 0
                      ? "#f5f5f7"
                      : intensity === 1
                      ? "rgba(255, 69, 58, 0.1)"
                      : intensity === 2
                      ? "rgba(255, 69, 58, 0.2)"
                      : "rgba(255, 69, 58, 0.35)",
                  color:
                    intensity === 0
                      ? "#d2d2d7"
                      : intensity === 3
                      ? EX_COLOR
                      : "#86868b",
                }}
              >
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ExercisePage() {
  const { state, loading, updateProtocols } = useAppState();
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const exerciseItems = state.protocols.exercise;

  // Get today's day index (Mon=0 ... Sun=6)
  const todayIndex = useMemo(() => {
    const jsDay = new Date().getDay(); // Sun=0
    return jsDay === 0 ? 6 : jsDay - 1;
  }, []);

  // Compute display times and group items
  const { trainingItems, recoveryItems } = useMemo(() => {
    const withTimes = exerciseItems.map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, state.settings),
    }));

    const sorted = sortByTime(withTimes, state.settings).map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, state.settings),
    }));

    const training: (ProtocolItem & { _displayTime: string })[] = [];
    const recovery: (ProtocolItem & { _displayTime: string })[] = [];

    for (const item of sorted) {
      const tod = deriveTimeOfDay(item._displayTime);
      const section = getSectionKey(tod);
      if (section === "training") {
        training.push(item);
      } else {
        recovery.push(item);
      }
    }

    return { trainingItems: training, recoveryItems: recovery };
  }, [exerciseItems, state.settings]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleToggleEnabled = useCallback(
    (id: string) => {
      const updated = exerciseItems.map((item) =>
        item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
      );
      updateProtocols("exercise", updated);
    },
    [exerciseItems, updateProtocols]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = exerciseItems.filter((item) => item.id !== id);
      updateProtocols("exercise", updated);
    },
    [exerciseItems, updateProtocols]
  );

  const handleAddItem = useCallback(
    (itemData: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => {
      const newItem: ProtocolItem = {
        ...itemData,
        id: `exercise-custom-${Date.now()}`,
        sortOrder: exerciseItems.length + 1,
        createdAt: new Date().toISOString(),
      };
      updateProtocols("exercise", [...exerciseItems, newItem]);
    },
    [exerciseItems, updateProtocols]
  );

  // Loading skeleton
  if (loading) {
    return (
      <Shell>
        <div className="space-y-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-9 w-52 bg-[#f5f5f7] rounded-xl" />
            <div className="h-5 w-72 bg-[#f5f5f7] rounded-lg" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#f5f5f7] rounded-2xl" />
          ))}
        </div>
      </Shell>
    );
  }

  const enabledCount = exerciseItems.filter((i) => i.isEnabled).length;
  const todayCount = exerciseItems.filter(
    (i) => i.isEnabled && i.daysActive[todayIndex]
  ).length;

  return (
    <Shell>
      <div className="space-y-8 pb-4">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                Exercise Protocol
              </h1>
              <p className="text-[15px] text-[#86868b] mt-1">
                Strength, cardio, mobility &amp; recovery
              </p>
            </div>

            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setExpandedId(null);
              }}
              className={`mt-1 px-4 py-1.5 rounded-full text-[13px] font-medium transition-apple ${
                isEditMode
                  ? "text-white"
                  : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
              }`}
              style={isEditMode ? { backgroundColor: EX_COLOR } : undefined}
            >
              {isEditMode ? "Done" : "Edit"}
            </button>
          </div>

          {/* Today summary */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold"
              style={{ backgroundColor: EX_BG, color: EX_COLOR }}
            >
              <span className="text-[15px]">🏋️</span>
              {todayCount} items today
            </div>
            <span className="text-[13px] text-[#86868b]">
              {enabledCount} total across the week
            </span>
          </div>
        </div>

        {/* ── Weekly Overview ─────────────────────────────────── */}
        <WeeklyOverview items={exerciseItems} />

        {/* ── Training Section ────────────────────────────────── */}
        <ProtocolSection
          sectionKey="training"
          items={trainingItems}
          isEditMode={isEditMode}
          expandedId={expandedId}
          todayIndex={todayIndex}
          onToggleExpand={handleToggleExpand}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
          onAddItem={handleAddItem}
        />

        {/* ── Section divider ─────────────────────────────────── */}
        {recoveryItems.length > 0 && (
          <div className="flex items-center gap-4 px-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
            <span className="text-[11px] font-medium text-[#d2d2d7] uppercase tracking-widest">
              Evening
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
          </div>
        )}

        {/* ── Recovery Section ────────────────────────────────── */}
        {recoveryItems.length > 0 && (
          <ProtocolSection
            sectionKey="recovery"
            items={recoveryItems}
            isEditMode={isEditMode}
            expandedId={expandedId}
            todayIndex={todayIndex}
            onToggleExpand={handleToggleExpand}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDelete}
            onAddItem={handleAddItem}
          />
        )}

        {/* ── AI Insight Card ─────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#fbfbfd] to-[#f5f5f7] border border-[#d2d2d7]/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px]"
              style={{ backgroundColor: EX_BG }}
            >
              ✨
            </div>
            <div>
              <p
                className="text-[13px] font-semibold mb-1"
                style={{ color: EX_COLOR }}
              >
                AI Insight
              </p>
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                VO2 max and muscle mass are the two strongest predictors of
                longevity. Prioritize Zone 2 cardio and compound strength
                training — even 150 minutes of moderate activity per week
                reduces all-cause mortality by 31%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
