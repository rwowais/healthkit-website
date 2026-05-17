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
  timeStringToMinutes,
} from "@/lib/timing";
import { PILLAR_META } from "@/lib/constants";

// ── Constants ──────────────────────────────────────────────────────

const SLEEP_COLOR = PILLAR_META.sleep.color;
const SLEEP_BG = PILLAR_META.sleep.bgLight;

const EMOJI_OPTIONS = [
  "☀️", "🌙", "🧊", "☕", "🍽️", "🔅", "📱", "❄️", "💊",
  "🧘", "😴", "⛔", "🏃", "📖", "🎧", "🧠", "💤", "🌿",
  "🫁", "🧴", "🛁", "✍️", "🕯️", "🫖",
];

// ── Helper: group items by morning vs evening/night ────────────────

type SectionKey = "morning" | "evening";

function getSectionKey(tod: TimeOfDay): SectionKey {
  return tod === "morning" || tod === "afternoon" ? "morning" : "evening";
}

// ── Add Item Form ──────────────────────────────────────────────────

interface AddItemFormProps {
  section: SectionKey;
  onAdd: (item: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => void;
  onCancel: () => void;
}

function AddItemForm({ section, onAdd, onCancel }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("✨");
  const [offsetMinutes, setOffsetMinutes] = useState(
    section === "morning" ? 30 : -60
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const anchor = section === "morning" ? "wake" : "bed";

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      pillar: "sleep",
      name: name.trim(),
      description: description.trim(),
      source: "custom",
      itemType: "task",
      timingAnchor: anchor as "wake" | "bed",
      timingOffsetMinutes: offsetMinutes,
      timeOfDay: section === "morning" ? "morning" : "evening",
      daysActive: [true, true, true, true, true, true, true],
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
            className="w-11 h-11 rounded-xl bg-white border border-[#d2d2d7]/40 flex items-center justify-center text-[20px] hover:border-[#5e5ce6]/40 transition-apple"
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
          placeholder="e.g., Evening Walk"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
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
          placeholder="Brief description of this habit"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
        />
      </div>

      {/* Timing */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Timing ({section === "morning" ? "minutes after wake" : "minutes before bed"})
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={Math.abs(offsetMinutes)}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setOffsetMinutes(section === "morning" ? val : -val);
            }}
            min={0}
            max={720}
            className="w-24 px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
          />
          <span className="text-[13px] text-[#86868b]">
            {section === "morning" ? "min after waking" : "min before bed"}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="w-full py-2.5 rounded-full text-[13px] font-semibold transition-apple disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: name.trim() ? SLEEP_COLOR : "#e5e5ea",
          color: name.trim() ? "#ffffff" : "#86868b",
        }}
      >
        Add to Protocol
      </button>
    </div>
  );
}

// ── Protocol Item Card ─────────────────────────────────────────────

interface ItemCardProps {
  item: ProtocolItem;
  displayTime: string;
  isEditMode: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

function ItemCard({
  item,
  displayTime,
  isEditMode,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
}: ItemCardProps) {
  const [noteValue, setNoteValue] = useState("");

  return (
    <div
      className={`bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl transition-apple overflow-hidden ${
        !item.isEnabled ? "opacity-40" : ""
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
          style={{ backgroundColor: SLEEP_BG }}
        >
          {item.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-0.5">
            {formatDisplayTime(displayTime)}
          </p>
          <p className="text-[15px] font-semibold text-[#1d1d1f] leading-snug">
            {item.name}
          </p>
          <p className="text-[13px] text-[#86868b] leading-relaxed mt-0.5 line-clamp-2">
            {item.description}
          </p>

          {/* Source badges */}
          {item.recommendedBy && item.recommendedBy.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.recommendedBy.map((source) => (
                <span
                  key={source}
                  className="text-[10px] font-medium bg-[#f5f5f7] text-[#86868b] rounded-full px-2 py-0.5"
                >
                  {source}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: edit controls or expand chevron */}
        {isEditMode ? (
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {/* Toggle switch */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled();
              }}
              className={`relative w-[44px] h-[26px] rounded-full transition-apple ${
                item.isEnabled ? "" : "bg-[#e5e5ea]"
              }`}
              style={{
                backgroundColor: item.isEnabled ? SLEEP_COLOR : undefined,
              }}
              aria-label={item.isEnabled ? "Disable item" : "Enable item"}
            >
              <span
                className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-apple ${
                  item.isEnabled ? "left-[21px]" : "left-[3px]"
                }`}
              />
            </button>

            {/* Delete button (custom items only) */}
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
              style={{ backgroundColor: SLEEP_BG }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: SLEEP_COLOR }}>
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/30 text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] resize-none focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Component ──────────────────────────────────────────────

interface SectionProps {
  sectionKey: SectionKey;
  items: (ProtocolItem & { _displayTime: string })[];
  isEditMode: boolean;
  expandedId: string | null;
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
  onToggleExpand,
  onToggleEnabled,
  onDelete,
  onAddItem,
}: SectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const isMorning = sectionKey === "morning";
  const enabledCount = items.filter((i) => i.isEnabled).length;
  const totalCount = items.length;

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[20px]">{isMorning ? "☀️" : "🌙"}</span>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
            {isMorning ? "Morning Routine" : "Evening Wind-Down"}
          </h2>
        </div>
        <span className="text-[13px] text-[#86868b] font-medium">
          {enabledCount} of {totalCount}
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
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[#d2d2d7]/40 text-[13px] font-semibold text-[#86868b] hover:border-[#5e5ce6]/30 hover:text-[#5e5ce6] transition-apple"
            >
              + Add Custom Item
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function SleepPage() {
  const { state, loading, updateSettings, updateProtocols } = useAppState();
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditingTimes, setIsEditingTimes] = useState(false);
  const [tempBedtime, setTempBedtime] = useState("");
  const [tempWakeTime, setTempWakeTime] = useState("");

  const settings = state.settings;
  const sleepItems = state.protocols.sleep;

  // Compute display times and group items
  const { morningItems, eveningItems } = useMemo(() => {
    const withTimes = sleepItems.map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, settings),
    }));

    const sorted = sortByTime(withTimes, settings).map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, settings),
    }));

    const morning: (ProtocolItem & { _displayTime: string })[] = [];
    const evening: (ProtocolItem & { _displayTime: string })[] = [];

    for (const item of sorted) {
      const tod = deriveTimeOfDay(item._displayTime);
      const section = getSectionKey(tod);
      if (section === "morning") {
        morning.push(item);
      } else {
        evening.push(item);
      }
    }

    return { morningItems: morning, eveningItems: evening };
  }, [sleepItems, settings]);

  const handleToggleExpand = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const handleToggleEnabled = useCallback(
    (id: string) => {
      const updated = sleepItems.map((item) =>
        item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
      );
      updateProtocols("sleep", updated);
    },
    [sleepItems, updateProtocols]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = sleepItems.filter((item) => item.id !== id);
      updateProtocols("sleep", updated);
    },
    [sleepItems, updateProtocols]
  );

  const handleAddItem = useCallback(
    (itemData: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => {
      const newItem: ProtocolItem = {
        ...itemData,
        id: `sleep-custom-${Date.now()}`,
        sortOrder: sleepItems.length + 1,
        createdAt: new Date().toISOString(),
      };
      updateProtocols("sleep", [...sleepItems, newItem]);
    },
    [sleepItems, updateProtocols]
  );

  const handleStartEditTimes = () => {
    setTempBedtime(settings.bedtime);
    setTempWakeTime(settings.wakeTime);
    setIsEditingTimes(true);
  };

  const handleSaveTimes = () => {
    updateSettings({ bedtime: tempBedtime, wakeTime: tempWakeTime });
    setIsEditingTimes(false);
  };

  // Calculate sleep duration
  const sleepDuration = useMemo(() => {
    const bedMin = timeStringToMinutes(settings.bedtime);
    const wakeMin = timeStringToMinutes(settings.wakeTime);
    let diff = wakeMin - bedMin;
    if (diff <= 0) diff += 1440;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [settings.bedtime, settings.wakeTime]);

  // Loading skeleton
  if (loading) {
    return (
      <Shell>
        <div className="space-y-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-9 w-52 bg-[#f5f5f7] rounded-xl" />
            <div className="h-5 w-72 bg-[#f5f5f7] rounded-lg" />
            <div className="h-12 w-full bg-[#f5f5f7] rounded-2xl mt-4" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#f5f5f7] rounded-2xl" />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8 pb-4">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                Sleep Protocol
              </h1>
              <p className="text-[15px] text-[#86868b] mt-1">
                Your evening wind-down and morning routine
              </p>
            </div>

            {/* Edit button */}
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
              style={
                isEditMode ? { backgroundColor: SLEEP_COLOR } : undefined
              }
            >
              {isEditMode ? "Done" : "Edit"}
            </button>
          </div>

          {/* Bedtime / Wake time display */}
          {!isEditingTimes ? (
            <button
              onClick={handleStartEditTimes}
              className="w-full bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 flex items-center justify-between transition-apple hover:border-[#5e5ce6]/30 group"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">🌙</span>
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                      Bedtime
                    </p>
                    <p className="text-[17px] font-semibold text-[#1d1d1f]">
                      {formatDisplayTime(settings.bedtime)}
                    </p>
                  </div>
                </div>

                <div className="w-px h-8 bg-[#d2d2d7]/30" />

                <div className="flex items-center gap-2">
                  <span className="text-[18px]">☀️</span>
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                      Wake
                    </p>
                    <p className="text-[17px] font-semibold text-[#1d1d1f]">
                      {formatDisplayTime(settings.wakeTime)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#86868b]">
                  {sleepDuration}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#86868b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-0 group-hover:opacity-100 transition-apple"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </button>
          ) : (
            <div className="bg-[#fbfbfd] border border-[#5e5ce6]/30 rounded-2xl p-5 space-y-4 animate-slide-up">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                Edit Sleep Schedule
              </h3>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
                    🌙 Bedtime
                  </label>
                  <input
                    type="time"
                    value={tempBedtime}
                    onChange={(e) => setTempBedtime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[17px] font-medium text-[#1d1d1f] focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
                    ☀️ Wake Time
                  </label>
                  <input
                    type="time"
                    value={tempWakeTime}
                    onChange={(e) => setTempWakeTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[17px] font-medium text-[#1d1d1f] focus:border-[#5e5ce6]/50 focus:ring-1 focus:ring-[#5e5ce6]/20 outline-none transition-apple"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveTimes}
                  className="flex-1 py-2.5 rounded-full text-[13px] font-semibold text-white transition-apple"
                  style={{ backgroundColor: SLEEP_COLOR }}
                >
                  Save Schedule
                </button>
                <button
                  onClick={() => setIsEditingTimes(false)}
                  className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#86868b] bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-apple"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Morning Routine ─────────────────────────────────── */}
        <ProtocolSection
          sectionKey="morning"
          items={morningItems}
          isEditMode={isEditMode}
          expandedId={expandedId}
          onToggleExpand={handleToggleExpand}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
          onAddItem={handleAddItem}
        />

        {/* ── Section divider ─────────────────────────────────── */}
        <div className="flex items-center gap-4 px-1">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
          <span className="text-[11px] font-medium text-[#d2d2d7] uppercase tracking-widest">
            {formatDisplayTime(settings.bedtime)} bedtime
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
        </div>

        {/* ── Evening Wind-Down ───────────────────────────────── */}
        <ProtocolSection
          sectionKey="evening"
          items={eveningItems}
          isEditMode={isEditMode}
          expandedId={expandedId}
          onToggleExpand={handleToggleExpand}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
          onAddItem={handleAddItem}
        />

        {/* ── AI Insight Card ─────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#fbfbfd] to-[#f5f5f7] border border-[#d2d2d7]/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px]"
              style={{ backgroundColor: SLEEP_BG }}
            >
              ✨
            </div>
            <div>
              <p
                className="text-[13px] font-semibold mb-1"
                style={{ color: SLEEP_COLOR }}
              >
                AI Insight
              </p>
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                Completing your evening wind-down consistently is the single
                biggest predictor of sleep quality improvement. Focus on the
                last 2 hours before bed for maximum impact.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
