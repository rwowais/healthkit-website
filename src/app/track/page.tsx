"use client";

import { useState, useMemo, useRef } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { getTodayLog } from "@/lib/storage";
import { PILLAR_META } from "@/lib/constants";
import { Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import type {
  Pillar,
  ProtocolItem,
  ExerciseEntry,
  ScorecardAnswer,
  DailyLog,
} from "@/lib/types";

const ORDER: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];
const COLOR: Record<string, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};

function dayIdx() {
  const j = new Date().getDay();
  return j === 0 ? 6 : j - 1;
}

function Check({ on, color }: { on: boolean; color: string }) {
  return (
    <div
      className="tr-fast grid h-7 w-7 shrink-0 place-items-center rounded-full border-2"
      style={{
        borderColor: on ? color : "var(--text-4)",
        background: on ? color : "transparent",
      }}
    >
      {on && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#08090B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

// ── Sleep ─────────────────────────────────────────────────────────
function SleepTracker({
  log,
  items,
  onToggle,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onToggle: (id: string) => void;
}) {
  const morning = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "wake" && i.itemType === "task"
  );
  const evening = items.filter(
    (i) => i.isEnabled && i.timingAnchor === "bed" && i.itemType === "task"
  );
  const reminders = items.filter((i) => i.isEnabled && i.itemType === "reminder");
  const done = (id: string) =>
    log.sleepCompletions.find((c) => c.itemId === id)?.completed ?? false;

  const section = (list: ProtocolItem[], label: string) =>
    list.length > 0 && (
      <div className="space-y-2.5">
        <Eyebrow>{label}</Eyebrow>
        {list.map((it) => {
          const on = done(it.id);
          return (
            <button
              key={it.id}
              onClick={() => onToggle(it.id)}
              className="press tr-fast flex w-full items-center gap-3.5 rounded-[var(--r-md)] border p-4 text-left"
              style={{
                borderColor: on ? "var(--sleep)" : "var(--hairline)",
                background: on ? "var(--sleep-soft)" : "var(--surface-2)",
              }}
            >
              <Check on={on} color="var(--sleep)" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[var(--text-1)]">
                  {it.icon} {it.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-7">
      {reminders.length > 0 && (
        <div className="rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--sleep-soft)] p-4">
          <Eyebrow color="var(--sleep)">Keep in mind</Eyebrow>
          <div className="mt-2.5 space-y-1.5">
            {reminders.map((r) => (
              <p key={r.id} className="t-label">
                {r.icon} {r.name}
              </p>
            ))}
          </div>
        </div>
      )}
      {section(morning, "Morning")}
      {section(evening, "Evening")}
    </div>
  );
}

// ── Exercise ──────────────────────────────────────────────────────
function ExerciseTracker({
  log,
  items,
  onUpdate,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (id: string, u: Partial<ExerciseEntry>) => void;
}) {
  const di = dayIdx();
  const todayItems = items.filter(
    (i) => i.isEnabled && i.itemType === "task" && i.daysActive[di]
  );
  const reminders = items.filter((i) => i.isEnabled && i.itemType === "reminder");
  const entry = (id: string) => log.exerciseEntries.find((e) => e.itemId === id);
  const INT = ["", "Light", "Moderate", "Hard"];
  const FEEL = ["", "😮‍💨", "😕", "😐", "🙂", "💪"];

  return (
    <div className="space-y-7">
      {reminders.length > 0 && (
        <div className="rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--readiness-soft)] p-4">
          <Eyebrow color="var(--readiness)">Keep in mind</Eyebrow>
          <div className="mt-2.5 space-y-1.5">
            {reminders.map((r) => (
              <p key={r.id} className="t-label">
                {r.icon} {r.name}
              </p>
            ))}
          </div>
        </div>
      )}

      {todayItems.length > 0 ? (
        <div className="space-y-3">
          {todayItems.map((it) => {
            const e = entry(it.id);
            const on = e?.completed ?? false;
            return (
              <div
                key={it.id}
                className="tr-fast overflow-hidden rounded-[var(--r-md)] border"
                style={{
                  borderColor: on ? "var(--readiness)" : "var(--hairline)",
                  background: on ? "var(--readiness-soft)" : "var(--surface-2)",
                }}
              >
                <button
                  onClick={() => onUpdate(it.id, { completed: !on })}
                  className="press flex w-full items-center gap-3.5 p-4 text-left"
                >
                  <Check on={on} color="var(--readiness)" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-[var(--text-1)]">
                      {it.icon} {it.name}
                    </p>
                    <p className="t-caption mt-0.5 line-clamp-1">
                      {it.description}
                    </p>
                  </div>
                </button>
                {on && (
                  <div className="anim-fade flex flex-wrap items-center gap-2 px-4 pb-4">
                    <div className="flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2">
                      <span className="text-[11px] text-[var(--text-3)]">min</span>
                      <input
                        type="number"
                        value={e?.durationMinutes ?? ""}
                        onChange={(ev) =>
                          onUpdate(it.id, {
                            durationMinutes: ev.target.value
                              ? parseInt(ev.target.value)
                              : null,
                          })
                        }
                        className="w-12 bg-transparent text-[14px] text-[var(--text-1)] outline-none"
                      />
                    </div>
                    <div className="flex gap-1">
                      {([1, 2, 3] as const).map((lv) => (
                        <button
                          key={lv}
                          onClick={() =>
                            onUpdate(it.id, {
                              intensity: e?.intensity === lv ? null : lv,
                            })
                          }
                          className="tr-fast rounded-[var(--r-sm)] px-3 py-2 text-[12px] font-semibold"
                          style={{
                            background:
                              e?.intensity === lv
                                ? "var(--readiness)"
                                : "var(--surface-1)",
                            color:
                              e?.intensity === lv ? "#08090B" : "var(--text-3)",
                          }}
                        >
                          {INT[lv]}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-0.5">
                      {([1, 2, 3, 4, 5] as const).map((lv) => (
                        <button
                          key={lv}
                          onClick={() =>
                            onUpdate(it.id, {
                              feeling: e?.feeling === lv ? null : lv,
                            })
                          }
                          className="tr-fast grid h-9 w-9 place-items-center rounded-[var(--r-sm)] text-[17px]"
                          style={{
                            background:
                              e?.feeling === lv
                                ? "var(--readiness-soft)"
                                : "transparent",
                            opacity: e?.feeling === lv ? 1 : 0.4,
                          }}
                        >
                          {FEEL[lv]}
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
        <div className="py-12 text-center">
          <p className="text-[34px]">🧘</p>
          <p className="t-section mt-3 text-[var(--text-1)]">Rest Day</p>
          <p className="t-caption mt-1">
            Recovery is part of the protocol. Move gently.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Nutrition ─────────────────────────────────────────────────────
function NutritionTracker({
  log,
  onUpdate,
}: {
  log: DailyLog;
  onUpdate: (f: string, v: ScorecardAnswer) => void;
}) {
  const sc = log.nutritionScorecard;
  const qs = [
    { k: "hitProteinTarget", l: "Hit protein target", i: "🥩" },
    { k: "ateFruitsVeggies", l: "Ate fruits & vegetables", i: "🥦" },
    { k: "stayedHydrated", l: "Stayed hydrated", i: "💧" },
    { k: "avoidedProcessedSugar", l: "Avoided processed sugar", i: "🍬" },
    { k: "finishedEatingOnTime", l: "Finished eating 3h before bed", i: "🍽️" },
    { k: "minimizedAlcohol", l: "Minimized alcohol", i: "🚫" },
  ] as const;
  const opts: { v: ScorecardAnswer; l: string; c: string }[] = [
    { v: "yes", l: "Yes", c: "var(--vitality)" },
    { v: "mostly", l: "Mostly", c: "var(--warm)" },
    { v: "no", l: "No", c: "var(--alert)" },
  ];

  return (
    <div className="space-y-2.5">
      {qs.map((q) => {
        const cur = sc[q.k] as ScorecardAnswer;
        return (
          <div
            key={q.k}
            className="rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--surface-2)] p-4"
          >
            <p className="text-[14px] font-medium text-[var(--text-1)]">
              {q.i} {q.l}
            </p>
            <div className="mt-3 flex gap-2">
              {opts.map((o) => {
                const on = cur === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => onUpdate(q.k, on ? null : o.v)}
                    className="tr-fast flex-1 rounded-[var(--r-sm)] py-2.5 text-[13px] font-semibold"
                    style={{
                      background: on ? o.c : "var(--surface-1)",
                      color: on ? "#08090B" : "var(--text-3)",
                    }}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Supplements ───────────────────────────────────────────────────
function SupplementsTracker({
  log,
  items,
  onUpdate,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (
    id: string,
    u: { taken?: boolean; skipped?: boolean; skipReason?: string }
  ) => void;
}) {
  const [skipId, setSkipId] = useState<string | null>(null);
  const morning = items.filter((i) => i.isEnabled && i.timingAnchor === "wake");
  const evening = items.filter((i) => i.isEnabled && i.timingAnchor === "bed");
  const entry = (id: string) =>
    log.supplementEntries.find((s) => s.itemId === id);

  const renderItem = (it: ProtocolItem) => {
    const e = entry(it.id);
    const taken = e?.taken ?? false;
    const skipped = e?.skipped ?? false;
    return (
      <div
        key={it.id}
        className="tr-fast overflow-hidden rounded-[var(--r-md)] border"
        style={{
          borderColor: taken ? "var(--warm)" : "var(--hairline)",
          background: taken
            ? "var(--warm-soft)"
            : skipped
            ? "var(--surface-1)"
            : "var(--surface-2)",
          opacity: skipped ? 0.55 : 1,
        }}
      >
        <div className="flex items-center gap-3.5 p-4">
          <button
            onClick={() =>
              onUpdate(it.id, { taken: !taken, skipped: false, skipReason: "" })
            }
            className="press"
          >
            <Check on={taken} color="var(--warm)" />
          </button>
          <p
            className="flex-1 text-[15px] font-medium"
            style={{
              color: taken
                ? "var(--text-1)"
                : skipped
                ? "var(--text-3)"
                : "var(--text-1)",
              textDecoration: skipped ? "line-through" : "none",
            }}
          >
            {it.icon} {it.name}
          </p>
          {!taken && (
            <button
              onClick={() => {
                if (skipped) {
                  onUpdate(it.id, { skipped: false, skipReason: "" });
                  setSkipId(null);
                } else {
                  setSkipId(skipId === it.id ? null : it.id);
                }
              }}
              className="tr-fast rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-medium"
              style={{
                background: skipped ? "var(--surface-3)" : "transparent",
                color: skipped ? "var(--text-2)" : "var(--text-4)",
              }}
            >
              {skipped ? "Skipped" : "Skip"}
            </button>
          )}
        </div>
        {skipId === it.id && !taken && (
          <div className="anim-fade flex gap-2 px-4 pb-4">
            <input
              type="text"
              placeholder="Reason (optional)"
              className="flex-1 rounded-[var(--r-sm)] bg-[var(--surface-1)] px-3 py-2.5 text-[13px] text-[var(--text-1)] outline-none"
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  onUpdate(it.id, {
                    skipped: true,
                    taken: false,
                    skipReason: (ev.target as HTMLInputElement).value,
                  });
                  setSkipId(null);
                }
              }}
            />
            <button
              onClick={() => {
                onUpdate(it.id, { skipped: true, taken: false });
                setSkipId(null);
              }}
              className="rounded-[var(--r-sm)] bg-[var(--surface-3)] px-4 text-[13px] font-medium text-[var(--text-2)]"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-7">
      {morning.length > 0 && (
        <div className="space-y-2.5">
          <Eyebrow>Morning Stack</Eyebrow>
          {morning.map(renderItem)}
        </div>
      )}
      {evening.length > 0 && (
        <div className="space-y-2.5">
          <Eyebrow>Evening Stack</Eyebrow>
          {evening.map(renderItem)}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
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
  const toast = useToast();
  const [active, setActive] = useState<Pillar>("sleep");
  const scrollRef = useRef<HTMLDivElement>(null);
  const log = useMemo(() => getTodayLog(state), [state]);
  const scores = log.pillarScores ?? {
    sleep: 0,
    exercise: 0,
    nutrition: 0,
    supplements: 0,
  };

  const onScroll = () => {
    const c = scrollRef.current;
    if (!c) return;
    const idx = Math.round(c.scrollLeft / c.offsetWidth);
    const p = ORDER[Math.min(idx, ORDER.length - 1)];
    if (p !== active) setActive(p);
  };

  const goTo = (p: Pillar) => {
    const i = ORDER.indexOf(p);
    scrollRef.current?.scrollTo({
      left: i * scrollRef.current.offsetWidth,
      behavior: "smooth",
    });
    setActive(p);
  };

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-8 w-48" rounded="rounded-full" />
          <Skeleton className="h-12 w-full" rounded="rounded-[var(--r-pill)]" />
          <Skeleton className="h-80 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="anim-rise">
          <Eyebrow>{today.displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Protocols</h1>
        </div>

        {/* Pillar selector */}
        <div className="anim-rise d1 flex gap-2 overflow-x-auto no-scrollbar">
          {ORDER.map((p) => {
            const on = active === p;
            const s = Math.round(scores[p]);
            return (
              <button
                key={p}
                onClick={() => goTo(p)}
                className="press tr-fast flex shrink-0 items-center gap-2 rounded-[var(--r-pill)] px-4 py-2.5 text-[13px] font-semibold"
                style={{
                  background: on ? COLOR[p] : "var(--surface-2)",
                  color: on ? "#08090B" : "var(--text-3)",
                }}
              >
                <span>{PILLAR_META[p].icon}</span>
                {PILLAR_META[p].label}
                <span
                  className="text-[11px] font-bold"
                  style={{ opacity: on ? 0.6 : 0.5 }}
                >
                  {s}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Swipeable cards */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="-mx-5 flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        >
          {ORDER.map((p) => (
            <div
              key={p}
              className="w-full shrink-0 snap-center px-5"
              style={{ minWidth: "100%" }}
            >
              <Card pad="p-5" className="min-h-[420px]">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[24px]">{PILLAR_META[p].icon}</span>
                    <h2 className="t-section text-[var(--text-1)]">
                      {PILLAR_META[p].label}
                    </h2>
                  </div>
                  <span
                    className="rounded-[var(--r-pill)] px-3 py-1.5 text-[13px] font-bold"
                    style={{
                      background: "var(--surface-3)",
                      color: COLOR[p],
                    }}
                  >
                    {Math.round(scores[p])}%
                  </span>
                </div>

                {p === "sleep" && (
                  <SleepTracker
                    log={log}
                    items={state.protocols.sleep}
                    onToggle={(id) => {
                      toggleSleepItem(log.date, id);
                    }}
                  />
                )}
                {p === "exercise" && (
                  <ExerciseTracker
                    log={log}
                    items={state.protocols.exercise}
                    onUpdate={(id, u) => updateExerciseEntry(log.date, id, u)}
                  />
                )}
                {p === "nutrition" && (
                  <NutritionTracker
                    log={log}
                    onUpdate={(f, v) =>
                      updateNutritionScorecard(log.date, { [f]: v })
                    }
                  />
                )}
                {p === "supplements" && (
                  <SupplementsTracker
                    log={log}
                    items={state.protocols.supplements}
                    onUpdate={(id, u) => {
                      updateSupplementEntry(log.date, id, u);
                      if (u.taken) toast.show("Logged");
                    }}
                  />
                )}
              </Card>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2">
          {ORDER.map((p) => (
            <button
              key={p}
              onClick={() => goTo(p)}
              className="tr-fast h-1.5 rounded-full"
              style={{
                width: active === p ? 22 : 6,
                background: active === p ? COLOR[p] : "var(--text-4)",
              }}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}
