"use client";

import { useState, useMemo, useRef } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { getTodayLog } from "@/lib/storage";
import { PILLAR_META } from "@/lib/constants";
import type {
  Pillar,
  ProtocolItem,
  ExerciseEntry,
  ScorecardAnswer,
  DailyLog,
} from "@/lib/types";

// ── Pillar tabs ───────────────────────────────────────────────────

const PILLAR_ORDER: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];

// ── Helpers ───────────────────────────────────────────────────────

function getDayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ── Sleep Tracker Card ────────────────────────────────────────────

function SleepTracker({
  log,
  items,
  onToggle,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onToggle: (itemId: string) => void;
}) {
  const morningItems = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "wake" && i.itemType === "task"
  );
  const eveningItems = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "bed" && i.itemType === "task"
  );
  const reminders = items.filter(
    (i) => i.isEnabled && i.itemType === "reminder"
  );

  const isCompleted = (itemId: string) =>
    log.sleepCompletions.find((c) => c.itemId === itemId)?.completed ?? false;

  const renderChecklist = (sectionItems: ProtocolItem[], label: string, emoji: string) => (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide flex items-center gap-1.5">
        <span>{emoji}</span> {label}
      </p>
      {sectionItems.map((item) => {
        const done = isCompleted(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-apple text-left ${
              done
                ? "bg-[#5e5ce6]/8 border border-[#5e5ce6]/15"
                : "bg-white border border-[#d2d2d7]/25 hover:border-[#5e5ce6]/20"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-apple ${
                done ? "border-[#5e5ce6] bg-[#5e5ce6]" : "border-[#d2d2d7]"
              }`}
            >
              {done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-medium leading-snug transition-apple ${
                done ? "text-[#5e5ce6]" : "text-[#1d1d1f]"
              }`}>
                {item.icon} {item.name}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Reminders as tips */}
      {reminders.length > 0 && (
        <div className="bg-[#5e5ce6]/5 border border-[#5e5ce6]/10 rounded-xl p-3.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-[#5e5ce6] uppercase tracking-wide">
            Reminders
          </p>
          {reminders.map((r) => (
            <p key={r.id} className="text-[13px] text-[#86868b] leading-relaxed">
              {r.icon} {r.name}
            </p>
          ))}
        </div>
      )}

      {morningItems.length > 0 && renderChecklist(morningItems, "Morning", "☀️")}
      {eveningItems.length > 0 && renderChecklist(eveningItems, "Evening", "🌙")}
    </div>
  );
}

// ── Exercise Tracker Card ─────────────────────────────────────────

function ExerciseTracker({
  log,
  items,
  onUpdate,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (itemId: string, updates: Partial<ExerciseEntry>) => void;
}) {
  const dayIndex = getDayIndex();
  const todayItems = items.filter(
    (i) => i.isEnabled && i.itemType === "task" && i.daysActive[dayIndex]
  );
  const reminders = items.filter(
    (i) => i.isEnabled && i.itemType === "reminder"
  );
  const restDayItems = items.filter(
    (i) => i.isEnabled && i.itemType === "task" && !i.daysActive[dayIndex]
  );

  const getEntry = (itemId: string): ExerciseEntry | undefined =>
    log.exerciseEntries.find((e) => e.itemId === itemId);

  const INTENSITY_LABELS = ["", "Light", "Moderate", "Hard"];
  const FEELING_EMOJIS = ["", "😫", "😕", "😐", "🙂", "💪"];

  return (
    <div className="space-y-5">
      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-[#ff453a]/5 border border-[#ff453a]/10 rounded-xl p-3.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-[#ff453a] uppercase tracking-wide">
            Reminders
          </p>
          {reminders.map((r) => (
            <p key={r.id} className="text-[13px] text-[#86868b] leading-relaxed">
              {r.icon} {r.name}
            </p>
          ))}
        </div>
      )}

      {/* Today's exercises */}
      {todayItems.length > 0 ? (
        <div className="space-y-3">
          {todayItems.map((item) => {
            const entry = getEntry(item.id);
            const done = entry?.completed ?? false;

            return (
              <div
                key={item.id}
                className={`rounded-xl border transition-apple overflow-hidden ${
                  done
                    ? "bg-[#ff453a]/5 border-[#ff453a]/15"
                    : "bg-white border-[#d2d2d7]/25"
                }`}
              >
                {/* Main toggle row */}
                <button
                  onClick={() =>
                    onUpdate(item.id, { completed: !done })
                  }
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-apple ${
                      done ? "border-[#ff453a] bg-[#ff453a]" : "border-[#d2d2d7]"
                    }`}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[14px] font-medium ${done ? "text-[#ff453a]" : "text-[#1d1d1f]"}`}>
                      {item.icon} {item.name}
                    </p>
                    <p className="text-[12px] text-[#86868b] mt-0.5">
                      {item.description.substring(0, 60)}...
                    </p>
                  </div>
                </button>

                {/* Mini-log (shown when completed) */}
                {done && (
                  <div className="px-3.5 pb-3.5 pt-0 flex items-center gap-2 flex-wrap animate-slide-up">
                    {/* Duration */}
                    <div className="flex items-center gap-1.5 bg-white rounded-lg border border-[#d2d2d7]/30 px-2.5 py-1.5">
                      <span className="text-[11px] text-[#86868b]">⏱️</span>
                      <input
                        type="number"
                        placeholder="min"
                        value={entry?.durationMinutes ?? ""}
                        onChange={(e) =>
                          onUpdate(item.id, {
                            durationMinutes: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        className="w-12 text-[13px] text-[#1d1d1f] bg-transparent outline-none"
                      />
                    </div>

                    {/* Intensity */}
                    <div className="flex gap-1">
                      {([1, 2, 3] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() =>
                            onUpdate(item.id, {
                              intensity: entry?.intensity === level ? null : level,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-apple ${
                            entry?.intensity === level
                              ? "bg-[#ff453a] text-white"
                              : "bg-white border border-[#d2d2d7]/30 text-[#86868b]"
                          }`}
                        >
                          {INTENSITY_LABELS[level]}
                        </button>
                      ))}
                    </div>

                    {/* Feeling */}
                    <div className="flex gap-0.5">
                      {([1, 2, 3, 4, 5] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() =>
                            onUpdate(item.id, {
                              feeling: entry?.feeling === level ? null : level,
                            })
                          }
                          className={`w-8 h-8 rounded-lg text-[16px] flex items-center justify-center transition-apple ${
                            entry?.feeling === level
                              ? "bg-[#ff453a]/10 scale-110"
                              : "opacity-40 hover:opacity-70"
                          }`}
                        >
                          {FEELING_EMOJIS[level]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-[32px] mb-2">🧘</p>
          <p className="text-[15px] font-medium text-[#1d1d1f]">Rest Day</p>
          <p className="text-[13px] text-[#86868b]">No exercises scheduled</p>
        </div>
      )}

      {/* Rest day items (dimmed) */}
      {restDayItems.length > 0 && (
        <div className="opacity-40 space-y-1">
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
            Scheduled Other Days
          </p>
          {restDayItems.map((item) => (
            <p key={item.id} className="text-[12px] text-[#86868b]">
              {item.icon} {item.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nutrition Tracker Card ────────────────────────────────────────

function NutritionTracker({
  log,
  onUpdate,
}: {
  log: DailyLog;
  onUpdate: (field: string, value: ScorecardAnswer) => void;
}) {
  const sc = log.nutritionScorecard;

  const questions: { key: string; label: string; icon: string; value: ScorecardAnswer }[] = [
    { key: "hitProteinTarget", label: "Hit protein target", icon: "🥩", value: sc.hitProteinTarget },
    { key: "ateFruitsVeggies", label: "Ate fruits & vegetables", icon: "🥦", value: sc.ateFruitsVeggies },
    { key: "stayedHydrated", label: "Stayed hydrated", icon: "💧", value: sc.stayedHydrated },
    { key: "avoidedProcessedSugar", label: "Avoided processed sugar", icon: "🍬", value: sc.avoidedProcessedSugar },
    { key: "finishedEatingOnTime", label: "Finished eating 3h before bed", icon: "🍽️", value: sc.finishedEatingOnTime },
    { key: "minimizedAlcohol", label: "Minimized alcohol", icon: "🚫", value: sc.minimizedAlcohol },
  ];

  const answerOptions: { value: ScorecardAnswer; label: string; color: string; bg: string }[] = [
    { value: "yes", label: "Yes", color: "#30d158", bg: "rgba(48, 209, 88, 0.1)" },
    { value: "mostly", label: "Mostly", color: "#ff9f0a", bg: "rgba(255, 159, 10, 0.1)" },
    { value: "no", label: "No", color: "#ff3b30", bg: "rgba(255, 59, 48, 0.1)" },
  ];

  return (
    <div className="space-y-2">
      {questions.map((q) => (
        <div
          key={q.key}
          className="bg-white border border-[#d2d2d7]/25 rounded-xl p-3.5 flex items-center justify-between gap-3"
        >
          <p className="text-[14px] text-[#1d1d1f] font-medium flex-1">
            {q.icon} {q.label}
          </p>
          <div className="flex gap-1.5 shrink-0">
            {answerOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onUpdate(q.key, q.value === opt.value ? null : opt.value)
                }
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-apple"
                style={{
                  backgroundColor:
                    q.value === opt.value ? opt.bg : "transparent",
                  color: q.value === opt.value ? opt.color : "#d2d2d7",
                  border: `1.5px solid ${
                    q.value === opt.value ? opt.color + "30" : "#d2d2d7"
                  }`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Supplements Tracker Card ──────────────────────────────────────

function SupplementsTracker({
  log,
  items,
  onUpdate,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (itemId: string, updates: { taken?: boolean; skipped?: boolean; skipReason?: string }) => void;
}) {
  const [expandedSkip, setExpandedSkip] = useState<string | null>(null);
  const morningItems = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "wake"
  );
  const eveningItems = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "bed"
  );

  const getEntry = (itemId: string) =>
    log.supplementEntries.find((s) => s.itemId === itemId);

  const renderItem = (item: ProtocolItem) => {
    const entry = getEntry(item.id);
    const taken = entry?.taken ?? false;
    const skipped = entry?.skipped ?? false;

    return (
      <div
        key={item.id}
        className={`rounded-xl border transition-apple ${
          taken
            ? "bg-[#ff9f0a]/5 border-[#ff9f0a]/15"
            : skipped
            ? "bg-[#f5f5f7] border-[#d2d2d7]/20 opacity-60"
            : "bg-white border-[#d2d2d7]/25"
        }`}
      >
        <div className="flex items-center gap-3 p-3.5">
          {/* Take button */}
          <button
            onClick={() =>
              onUpdate(item.id, {
                taken: !taken,
                skipped: false,
                skipReason: "",
              })
            }
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-apple ${
              taken ? "border-[#ff9f0a] bg-[#ff9f0a]" : "border-[#d2d2d7]"
            }`}
          >
            {taken && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-[14px] font-medium ${taken ? "text-[#ff9f0a]" : skipped ? "text-[#86868b] line-through" : "text-[#1d1d1f]"}`}>
              {item.icon} {item.name}
            </p>
          </div>

          {/* Skip button */}
          {!taken && (
            <button
              onClick={() => {
                if (skipped) {
                  onUpdate(item.id, { skipped: false, skipReason: "" });
                  setExpandedSkip(null);
                } else {
                  setExpandedSkip(expandedSkip === item.id ? null : item.id);
                }
              }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-apple ${
                skipped
                  ? "bg-[#86868b]/10 text-[#86868b]"
                  : "text-[#d2d2d7] hover:text-[#86868b]"
              }`}
            >
              {skipped ? "Skipped" : "Skip"}
            </button>
          )}
        </div>

        {/* Skip reason input */}
        {expandedSkip === item.id && !taken && (
          <div className="px-3.5 pb-3.5 pt-0 animate-slide-up">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Why skipping? (optional)"
                className="flex-1 px-3 py-2 rounded-lg bg-[#f5f5f7] text-[12px] text-[#1d1d1f] placeholder:text-[#d2d2d7] outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdate(item.id, {
                      skipped: true,
                      taken: false,
                      skipReason: (e.target as HTMLInputElement).value,
                    });
                    setExpandedSkip(null);
                  }
                }}
              />
              <button
                onClick={() => {
                  onUpdate(item.id, { skipped: true, taken: false });
                  setExpandedSkip(null);
                }}
                className="px-3 py-2 rounded-lg bg-[#86868b]/10 text-[12px] font-medium text-[#86868b]"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {morningItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
            🌅 Morning Stack
          </p>
          <div className="space-y-1.5">{morningItems.map(renderItem)}</div>
        </div>
      )}
      {eveningItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
            🌙 Evening Stack
          </p>
          <div className="space-y-1.5">{eveningItems.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Tracker Page ─────────────────────────────────────────────

export default function TrackPage() {
  const {
    state,
    loading,
    toggleSleepItem,
    updateExerciseEntry,
    updateNutritionScorecard,
    updateSupplementEntry,
  } = useAppState();
  const today = useToday();
  const [activePillar, setActivePillar] = useState<Pillar>("sleep");
  const scrollRef = useRef<HTMLDivElement>(null);

  const log = useMemo(() => getTodayLog(state), [state]);

  // Per-pillar progress
  const pillarProgress = useMemo(() => {
    const scores = log.pillarScores || { sleep: 0, exercise: 0, nutrition: 0, supplements: 0 };
    return scores;
  }, [log]);

  const handleScrollSnap = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const index = Math.round(scrollLeft / width);
    const pillar = PILLAR_ORDER[Math.min(index, PILLAR_ORDER.length - 1)];
    if (pillar !== activePillar) {
      setActivePillar(pillar);
    }
  };

  const scrollToPillar = (pillar: Pillar) => {
    const index = PILLAR_ORDER.indexOf(pillar);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.offsetWidth,
        behavior: "smooth",
      });
    }
    setActivePillar(pillar);
  };

  if (loading) {
    return (
      <Shell>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-[#f5f5f7] rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-20 bg-[#f5f5f7] rounded-full" />
            ))}
          </div>
          <div className="h-64 bg-[#f5f5f7] rounded-2xl" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-4 pb-4">
        {/* Header */}
        <div>
          <p className="text-[13px] font-medium text-[#86868b]">{today.displayDate}</p>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">
            Daily Tracker
          </h1>
        </div>

        {/* Pillar tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {PILLAR_ORDER.map((pillar) => {
            const meta = PILLAR_META[pillar];
            const isActive = activePillar === pillar;
            const score = pillarProgress[pillar];
            return (
              <button
                key={pillar}
                onClick={() => scrollToPillar(pillar)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-apple shrink-0 ${
                  isActive ? "text-white" : "bg-[#f5f5f7] text-[#86868b]"
                }`}
                style={isActive ? { backgroundColor: meta.color } : undefined}
              >
                <span className="text-[14px]">{meta.icon}</span>
                {meta.label}
                {score > 0 && (
                  <span
                    className={`text-[11px] font-bold ${
                      isActive ? "text-white/70" : "text-[#d2d2d7]"
                    }`}
                  >
                    {score}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Swipeable pillar cards */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4"
          onScroll={handleScrollSnap}
          style={{ scrollSnapType: "x mandatory" }}
        >
          {PILLAR_ORDER.map((pillar) => {
            const meta = PILLAR_META[pillar];
            return (
              <div
                key={pillar}
                className="w-full shrink-0 snap-center px-4"
                style={{ minWidth: "100%" }}
              >
                {/* Pillar card */}
                <div
                  className="rounded-2xl border p-5 min-h-[400px]"
                  style={{
                    borderColor: meta.color + "20",
                    backgroundColor: meta.bgLight.replace("0.1", "0.03"),
                  }}
                >
                  {/* Pillar header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[22px]">{meta.icon}</span>
                      <h2 className="text-[19px] font-bold text-[#1d1d1f]">
                        {meta.label}
                      </h2>
                    </div>
                    <div
                      className="text-[13px] font-bold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: meta.bgLight,
                        color: meta.color,
                      }}
                    >
                      {pillarProgress[pillar]}%
                    </div>
                  </div>

                  {/* Pillar-specific tracker */}
                  {pillar === "sleep" && (
                    <SleepTracker
                      log={log}
                      items={state.protocols.sleep}
                      onToggle={(itemId) =>
                        toggleSleepItem(log.date, itemId)
                      }
                    />
                  )}
                  {pillar === "exercise" && (
                    <ExerciseTracker
                      log={log}
                      items={state.protocols.exercise}
                      onUpdate={(itemId, updates) =>
                        updateExerciseEntry(log.date, itemId, updates)
                      }
                    />
                  )}
                  {pillar === "nutrition" && (
                    <NutritionTracker
                      log={log}
                      onUpdate={(field, value) =>
                        updateNutritionScorecard(log.date, {
                          [field]: value,
                        })
                      }
                    />
                  )}
                  {pillar === "supplements" && (
                    <SupplementsTracker
                      log={log}
                      items={state.protocols.supplements}
                      onUpdate={(itemId, updates) =>
                        updateSupplementEntry(log.date, itemId, updates)
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Swipe indicator dots */}
        <div className="flex justify-center gap-2">
          {PILLAR_ORDER.map((pillar) => (
            <button
              key={pillar}
              onClick={() => scrollToPillar(pillar)}
              className="w-2 h-2 rounded-full transition-apple"
              style={{
                backgroundColor:
                  activePillar === pillar
                    ? PILLAR_META[pillar].color
                    : "#d2d2d7",
              }}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}
