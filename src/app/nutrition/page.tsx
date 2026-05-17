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

const NUT_COLOR = PILLAR_META.nutrition.color;
const NUT_BG = PILLAR_META.nutrition.bgLight;

const EMOJI_OPTIONS = [
  "💧", "🥩", "🍗", "🥦", "🐟", "🍽️", "🚫", "🍬",
  "🥑", "🍳", "🥗", "🫐", "🍠", "🥜", "🫒", "🧄",
  "🍵", "🍎", "🥕", "🥚", "🌾", "🫘", "🧀", "🍋",
];

type SectionKey = "meals" | "guidelines";

function getSectionKey(tod: TimeOfDay): SectionKey {
  return tod === "morning" || tod === "afternoon" ? "meals" : "guidelines";
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
  const [icon, setIcon] = useState("🥗");
  const [offsetMinutes, setOffsetMinutes] = useState(
    section === "meals" ? 90 : -180
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const anchor = section === "meals" ? "wake" : "bed";

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      pillar: "nutrition",
      name: name.trim(),
      description: description.trim(),
      source: "custom",
      itemType: "task",
      timingAnchor: anchor as "wake" | "bed",
      timingOffsetMinutes: offsetMinutes,
      timeOfDay: section === "meals" ? "morning" : "evening",
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
            className="w-11 h-11 rounded-xl bg-white border border-[#d2d2d7]/40 flex items-center justify-center text-[20px] hover:border-[#30d158]/40 transition-apple"
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
          placeholder="e.g., Post-Workout Shake"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#30d158]/50 focus:ring-1 focus:ring-[#30d158]/20 outline-none transition-apple"
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
          placeholder="Brief description"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:border-[#30d158]/50 focus:ring-1 focus:ring-[#30d158]/20 outline-none transition-apple"
        />
      </div>

      {/* Timing */}
      <div>
        <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">
          Timing (
          {section === "meals" ? "minutes after wake" : "minutes before bed"})
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={Math.abs(offsetMinutes)}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setOffsetMinutes(section === "meals" ? val : -val);
            }}
            min={0}
            max={720}
            className="w-24 px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/40 text-[15px] text-[#1d1d1f] focus:border-[#30d158]/50 focus:ring-1 focus:ring-[#30d158]/20 outline-none transition-apple"
          />
          <span className="text-[13px] text-[#86868b]">
            {section === "meals" ? "min after waking" : "min before bed"}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="w-full py-2.5 rounded-full text-[13px] font-semibold transition-apple disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: name.trim() ? NUT_COLOR : "#e5e5ea",
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
        {isEditMode && (
          <div className="flex flex-col items-center justify-center gap-[3px] pt-2 cursor-grab opacity-30">
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
            <span className="block w-4 h-[2px] bg-[#86868b] rounded-full" />
          </div>
        )}

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
          style={{ backgroundColor: NUT_BG }}
        >
          {item.icon}
        </div>

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
                backgroundColor: item.isEnabled ? NUT_COLOR : undefined,
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <div className="w-7" />
            )}
          </div>
        ) : (
          <div className="shrink-0 pt-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-apple ${isExpanded ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>

      {isExpanded && !isEditMode && (
        <div className="px-4 pb-4 pt-0 space-y-3 animate-slide-up">
          <div className="h-px bg-[#d2d2d7]/20 mx-0" />
          {item.evidenceNote && (
            <div className="rounded-xl p-3.5" style={{ backgroundColor: NUT_BG }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: NUT_COLOR }}>Evidence</p>
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{item.evidenceNote}</p>
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide block mb-1.5">Personal Notes</label>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add your notes here..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d2d2d7]/30 text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] resize-none focus:border-[#30d158]/50 focus:ring-1 focus:ring-[#30d158]/20 outline-none transition-apple"
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
  onToggleExpand: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (item: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => void;
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

  const isMeals = sectionKey === "meals";
  const enabledCount = items.filter((i) => i.isEnabled).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[20px]">{isMeals ? "🥗" : "🌙"}</span>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
            {isMeals ? "Meals & Timing" : "Evening Guidelines"}
          </h2>
        </div>
        <span className="text-[13px] text-[#86868b] font-medium">
          {enabledCount} of {items.length}
        </span>
      </div>

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

      {isEditMode && (
        <div className="pt-1">
          {showAddForm ? (
            <AddItemForm
              section={sectionKey}
              onAdd={(item) => { onAddItem(item); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[#d2d2d7]/40 text-[13px] font-semibold text-[#86868b] hover:border-[#30d158]/30 hover:text-[#30d158] transition-apple"
            >
              + Add Custom Item
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function NutritionPage() {
  const { state, loading, updateProtocols } = useAppState();
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nutritionItems = state.protocols.nutrition;

  const { mealItems, guidelineItems } = useMemo(() => {
    const withTimes = nutritionItems.map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, state.settings),
    }));

    const sorted = sortByTime(withTimes, state.settings).map((item) => ({
      ...item,
      _displayTime: calculateDisplayTime(item, state.settings),
    }));

    const meals: (ProtocolItem & { _displayTime: string })[] = [];
    const guidelines: (ProtocolItem & { _displayTime: string })[] = [];

    for (const item of sorted) {
      const tod = deriveTimeOfDay(item._displayTime);
      const section = getSectionKey(tod);
      if (section === "meals") {
        meals.push(item);
      } else {
        guidelines.push(item);
      }
    }

    return { mealItems: meals, guidelineItems: guidelines };
  }, [nutritionItems, state.settings]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleToggleEnabled = useCallback(
    (id: string) => {
      const updated = nutritionItems.map((item) =>
        item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
      );
      updateProtocols("nutrition", updated);
    },
    [nutritionItems, updateProtocols]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = nutritionItems.filter((item) => item.id !== id);
      updateProtocols("nutrition", updated);
    },
    [nutritionItems, updateProtocols]
  );

  const handleAddItem = useCallback(
    (itemData: Omit<ProtocolItem, "id" | "createdAt" | "sortOrder">) => {
      const newItem: ProtocolItem = {
        ...itemData,
        id: `nutrition-custom-${Date.now()}`,
        sortOrder: nutritionItems.length + 1,
        createdAt: new Date().toISOString(),
      };
      updateProtocols("nutrition", [...nutritionItems, newItem]);
    },
    [nutritionItems, updateProtocols]
  );

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

  return (
    <Shell>
      <div className="space-y-8 pb-4">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                Nutrition Protocol
              </h1>
              <p className="text-[15px] text-[#86868b] mt-1">
                Meal timing, macros &amp; dietary guidelines
              </p>
            </div>
            <button
              onClick={() => { setIsEditMode(!isEditMode); setExpandedId(null); }}
              className={`mt-1 px-4 py-1.5 rounded-full text-[13px] font-medium transition-apple ${
                isEditMode ? "text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
              }`}
              style={isEditMode ? { backgroundColor: NUT_COLOR } : undefined}
            >
              {isEditMode ? "Done" : "Edit"}
            </button>
          </div>

          {/* Quick protein target */}
          <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px]" style={{ backgroundColor: NUT_BG }}>
                🎯
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Daily Protein Target</p>
                <p className="text-[12px] text-[#86868b]">
                  1g per pound of lean body mass &middot; Split across 3-4 meals
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Meals Section */}
        <ProtocolSection
          sectionKey="meals"
          items={mealItems}
          isEditMode={isEditMode}
          expandedId={expandedId}
          onToggleExpand={handleToggleExpand}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
          onAddItem={handleAddItem}
        />

        {/* Divider */}
        {guidelineItems.length > 0 && (
          <div className="flex items-center gap-4 px-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
            <span className="text-[11px] font-medium text-[#d2d2d7] uppercase tracking-widest">
              Evening
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d2d2d7]/30 to-transparent" />
          </div>
        )}

        {/* Guidelines Section */}
        {guidelineItems.length > 0 && (
          <ProtocolSection
            sectionKey="guidelines"
            items={guidelineItems}
            isEditMode={isEditMode}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDelete}
            onAddItem={handleAddItem}
          />
        )}

        {/* AI Insight Card */}
        <div className="bg-gradient-to-br from-[#fbfbfd] to-[#f5f5f7] border border-[#d2d2d7]/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px]" style={{ backgroundColor: NUT_BG }}>
              ✨
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: NUT_COLOR }}>AI Insight</p>
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                Protein distribution matters as much as total intake. Spreading
                30-50g across each meal triggers muscle protein synthesis
                multiple times per day, rather than just once at dinner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
