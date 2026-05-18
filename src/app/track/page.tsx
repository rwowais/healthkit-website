"use client";

import { useState, useMemo, useRef } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import { pillarScore } from "@/lib/metrics";
import { PILLAR_META } from "@/lib/constants";
import { Skeleton, useToast } from "@/components/ui";
import { Icon, iconForItem, type IconName } from "@/components/ui/icons";
import ProtocolDetailSheet from "@/components/ProtocolDetailSheet";
import type {
  Pillar,
  ProtocolItem,
  ExerciseEntry,
  ScorecardAnswer,
  DailyLog,
} from "@/lib/types";

const ORDER: Pillar[] = ["sleep", "exercise", "nutrition", "supplements"];
const C: Record<Pillar, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};
const RAIL_ICON: Record<Pillar, IconName> = {
  sleep: "moon",
  exercise: "pulse",
  nutrition: "leaf",
  supplements: "pill",
};

function dayIdx() {
  const j = new Date().getDay();
  return j === 0 ? 6 : j - 1;
}

// ── Tactile check ─────────────────────────────────────────────────
function Check({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
      style={{
        boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--text-4)",
      }}
    >
      {on && (
        <span
          className="anim-fill absolute inset-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {on && (
        <svg
          className="anim-check relative"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#08090B"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  );
}

// ── Icon chip ─────────────────────────────────────────────────────
function Chip({
  name,
  color,
  on,
}: {
  name: IconName;
  color: string;
  on: boolean;
}) {
  return (
    <span
      className="chip h-10 w-10 shrink-0"
      style={{
        background: on ? color : "var(--surface-3)",
        color: on ? "#08090B" : "var(--text-2)",
      }}
    >
      <Icon name={name} size={19} stroke={1.7} />
    </span>
  );
}

// ── Section eyebrow ───────────────────────────────────────────────
function Group({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <span className="t-eyebrow">{label}</span>
        {meta && (
          <span className="text-[11px] font-medium text-[var(--text-3)]">
            {meta}
          </span>
        )}
      </div>
      <div className="well space-y-1.5 p-1.5">{children}</div>
    </section>
  );
}

// ── Principles (reminders) ────────────────────────────────────────
function Principles({
  items,
  color,
}: {
  items: ProtocolItem[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon name="info" size={13} className="text-[var(--text-3)]" />
        <span className="t-eyebrow">Principles</span>
      </div>
      <div className="space-y-3 pl-4" style={{ borderLeft: `1.5px solid ${color}` }}>
        {items.map((r) => (
          <div key={r.id}>
            <p className="text-[14px] font-medium text-[var(--text-1)]">
              {r.name}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-3)]">
              {r.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Task row ──────────────────────────────────────────────────────
function TaskRow({
  item,
  on,
  color,
  onToggle,
  onInfo,
  children,
}: {
  item: ProtocolItem;
  on: boolean;
  color: string;
  onToggle: () => void;
  onInfo?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="row row-tap overflow-hidden"
      style={
        on
          ? {
              background: `linear-gradient(180deg, color-mix(in srgb, ${color} 9%, var(--surface-2)), var(--surface-1))`,
            }
          : undefined
      }
    >
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-3.5 text-left"
        >
          <Check on={on} color={color} />
          <Chip name={iconForItem(item)} color={color} on={on} />
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[14.5px] font-semibold tr-fast"
              style={{ color: on ? "var(--text-2)" : "var(--text-1)" }}
            >
              {item.name}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-3)]">
              {on ? "Completed" : item.description}
            </span>
          </span>
        </button>
        {onInfo && (
          <button
            onClick={onInfo}
            aria-label="Details"
            className="press tr-fast grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-4)] hover:text-[var(--text-2)]"
            style={{ marginRight: 8 }}
          >
            <Icon name="info" size={16} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Sleep ─────────────────────────────────────────────────────────
function SleepTracker({
  log,
  items,
  onToggle,
  onInfo,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onToggle: (id: string) => void;
  onInfo: (it: ProtocolItem) => void;
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
  const count = (l: ProtocolItem[]) =>
    `${l.filter((i) => done(i.id)).length}/${l.length}`;

  return (
    <div className="space-y-8">
      {morning.length > 0 && (
        <Group label="Morning" meta={count(morning)}>
          {morning.map((it) => (
            <TaskRow
              key={it.id}
              item={it}
              on={done(it.id)}
              color={C.sleep}
              onToggle={() => onToggle(it.id)}
              onInfo={() => onInfo(it)}
            />
          ))}
        </Group>
      )}
      {evening.length > 0 && (
        <Group label="Evening Wind-Down" meta={count(evening)}>
          {evening.map((it) => (
            <TaskRow
              key={it.id}
              item={it}
              on={done(it.id)}
              color={C.sleep}
              onToggle={() => onToggle(it.id)}
              onInfo={() => onInfo(it)}
            />
          ))}
        </Group>
      )}
      <Principles items={reminders} color={C.sleep} />
    </div>
  );
}

// ── Exercise ──────────────────────────────────────────────────────
function ExerciseTracker({
  log,
  items,
  onUpdate,
  onInfo,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (id: string, u: Partial<ExerciseEntry>) => void;
  onInfo: (it: ProtocolItem) => void;
}) {
  const di = dayIdx();
  const todayItems = items.filter(
    (i) => i.isEnabled && i.itemType === "task" && i.daysActive[di]
  );
  const reminders = items.filter((i) => i.isEnabled && i.itemType === "reminder");
  const entry = (id: string) => log.exerciseEntries.find((e) => e.itemId === id);
  const INT = ["", "Light", "Moderate", "Hard"];
  const FEEL = ["", "Drained", "Off", "Okay", "Good", "Strong"];

  if (todayItems.length === 0) {
    return (
      <div className="space-y-8">
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <span
            className="chip h-14 w-14"
            style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
          >
            <Icon name="moon" size={24} />
          </span>
          <p className="t-section mt-5 text-[var(--text-1)]">Rest Day</p>
          <p className="t-caption mt-1.5 max-w-[240px]">
            Recovery is part of the protocol. Move gently and let adaptation
            happen.
          </p>
        </div>
        <Principles items={reminders} color={C.exercise} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Group
        label="Today's Training"
        meta={`${todayItems.filter((i) => entry(i.id)?.completed).length}/${
          todayItems.length
        }`}
      >
        {todayItems.map((it) => {
          const e = entry(it.id);
          const on = e?.completed ?? false;
          return (
            <TaskRow
              key={it.id}
              item={it}
              on={on}
              color={C.exercise}
              onToggle={() => onUpdate(it.id, { completed: !on })}
              onInfo={() => onInfo(it)}
            >
              <div className={`reveal ${on ? "reveal-open" : ""}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5 pl-[68px]">
                    <div
                      className="flex items-center gap-2 rounded-[var(--r-sm)] px-3 py-2"
                      style={{ background: "var(--surface-1)" }}
                    >
                      <Icon
                        name="clock"
                        size={13}
                        className="text-[var(--text-3)]"
                      />
                      <input
                        type="number"
                        value={e?.durationMinutes ?? ""}
                        placeholder="min"
                        onChange={(ev) =>
                          onUpdate(it.id, {
                            durationMinutes: ev.target.value
                              ? parseInt(ev.target.value)
                              : null,
                          })
                        }
                        className="w-10 bg-transparent text-[13px] font-medium text-[var(--text-1)] outline-none"
                      />
                    </div>
                    <div
                      className="flex gap-0.5 rounded-[var(--r-sm)] p-0.5"
                      style={{ background: "var(--surface-1)" }}
                    >
                      {([1, 2, 3] as const).map((lv) => (
                        <button
                          key={lv}
                          onClick={() =>
                            onUpdate(it.id, {
                              intensity: e?.intensity === lv ? null : lv,
                            })
                          }
                          className="tr-fast rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
                          style={{
                            background:
                              e?.intensity === lv
                                ? "var(--readiness)"
                                : "transparent",
                            color:
                              e?.intensity === lv
                                ? "#08090B"
                                : "var(--text-3)",
                          }}
                        >
                          {INT[lv]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 px-3.5 pb-4 pl-[68px]">
                    {([1, 2, 3, 4, 5] as const).map((lv) => (
                      <button
                        key={lv}
                        onClick={() =>
                          onUpdate(it.id, {
                            feeling: e?.feeling === lv ? null : lv,
                          })
                        }
                        className="tr-fast flex-1 rounded-[9px] py-1.5 text-[11px] font-medium"
                        style={{
                          background:
                            e?.feeling === lv
                              ? "var(--readiness-soft)"
                              : "var(--surface-1)",
                          color:
                            e?.feeling === lv
                              ? "var(--readiness)"
                              : "var(--text-4)",
                        }}
                      >
                        {FEEL[lv]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TaskRow>
          );
        })}
      </Group>
      <Principles items={reminders} color={C.exercise} />
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
  const qs: { k: string; l: string; i: IconName }[] = [
    { k: "hitProteinTarget", l: "Protein target", i: "protein" },
    { k: "ateFruitsVeggies", l: "Fruits & vegetables", i: "leaf" },
    { k: "stayedHydrated", l: "Hydration", i: "droplet" },
    { k: "avoidedProcessedSugar", l: "Avoided processed sugar", i: "cube" },
    { k: "finishedEatingOnTime", l: "Ate 3h before bed", i: "clock" },
    { k: "minimizedAlcohol", l: "Minimized alcohol", i: "wine" },
  ];
  const opts: { v: ScorecardAnswer; l: string }[] = [
    { v: "yes", l: "Yes" },
    { v: "mostly", l: "Mostly" },
    { v: "no", l: "No" },
  ];
  const answered = qs.filter((q) => sc[q.k as keyof typeof sc] != null).length;

  return (
    <Group label="Daily Scorecard" meta={`${answered}/${qs.length}`}>
      {qs.map((q) => {
        const cur = sc[q.k as keyof typeof sc] as ScorecardAnswer;
        const idx = opts.findIndex((o) => o.v === cur);
        return (
          <div key={q.k} className="row px-3.5 py-3">
            <div className="mb-2.5 flex items-center gap-3">
              <span
                className="chip h-9 w-9"
                style={{
                  background: cur ? "var(--vitality-soft)" : "var(--surface-3)",
                  color: cur ? "var(--vitality)" : "var(--text-3)",
                }}
              >
                <Icon name={q.i} size={17} />
              </span>
              <span className="text-[14px] font-semibold text-[var(--text-1)]">
                {q.l}
              </span>
            </div>
            <div
              className="relative flex rounded-[11px] p-1"
              style={{ background: "var(--surface-1)" }}
            >
              {idx >= 0 && (
                <span
                  className="slide-ind absolute inset-y-1 rounded-[8px]"
                  style={{
                    width: "calc(33.333% - 2.7px)",
                    transform: `translateX(${idx * 100}%)`,
                    background:
                      cur === "no"
                        ? "var(--alert)"
                        : cur === "mostly"
                        ? "var(--warm)"
                        : "var(--vitality)",
                  }}
                />
              )}
              {opts.map((o) => {
                const active = cur === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => onUpdate(q.k, active ? null : o.v)}
                    className="relative z-10 flex-1 py-1.5 text-[12.5px] font-semibold tr-fast"
                    style={{
                      color: active ? "#08090B" : "var(--text-3)",
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
    </Group>
  );
}

// ── Supplements ───────────────────────────────────────────────────
function SupplementsTracker({
  log,
  items,
  onUpdate,
  onInfo,
}: {
  log: DailyLog;
  items: ProtocolItem[];
  onUpdate: (
    id: string,
    u: { taken?: boolean; skipped?: boolean; skipReason?: string }
  ) => void;
  onInfo: (it: ProtocolItem) => void;
}) {
  const [skipId, setSkipId] = useState<string | null>(null);
  const morning = items.filter((i) => i.isEnabled && i.timingAnchor === "wake");
  const evening = items.filter((i) => i.isEnabled && i.timingAnchor === "bed");
  const e = (id: string) => log.supplementEntries.find((s) => s.itemId === id);

  const renderItem = (it: ProtocolItem) => {
    const en = e(it.id);
    const taken = en?.taken ?? false;
    const skipped = en?.skipped ?? false;
    return (
      <div
        key={it.id}
        className="row overflow-hidden"
        style={{
          background: taken
            ? `linear-gradient(180deg, color-mix(in srgb, ${C.supplements} 9%, var(--surface-2)), var(--surface-1))`
            : undefined,
          opacity: skipped ? 0.5 : 1,
        }}
      >
        <div className="flex items-center gap-3.5 px-3.5 py-3">
          <button
            onClick={() =>
              onUpdate(it.id, { taken: !taken, skipped: false, skipReason: "" })
            }
            className="press"
          >
            <Check on={taken} color={C.supplements} />
          </button>
          <Chip
            name={iconForItem(it)}
            color={C.supplements}
            on={taken}
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[14.5px] font-semibold"
              style={{
                color: taken ? "var(--text-2)" : "var(--text-1)",
                textDecoration: skipped ? "line-through" : "none",
              }}
            >
              {it.name}
            </p>
            <p className="truncate text-[12px] text-[var(--text-3)]">
              {taken ? "Logged" : skipped ? "Skipped" : it.description}
            </p>
          </div>
          {!taken && (
            <button
              onClick={() => {
                if (skipped) {
                  onUpdate(it.id, { skipped: false, skipReason: "" });
                  setSkipId(null);
                } else setSkipId(skipId === it.id ? null : it.id);
              }}
              className="tr-fast shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{
                color: skipped ? "var(--text-2)" : "var(--text-4)",
                background: skipped ? "var(--surface-3)" : "transparent",
              }}
            >
              {skipped ? "Skipped" : "Skip"}
            </button>
          )}
          <button
            onClick={() => onInfo(it)}
            aria-label="Details"
            className="press tr-fast grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-4)] hover:text-[var(--text-2)]"
          >
            <Icon name="info" size={16} />
          </button>
        </div>
        <div className={`reveal ${skipId === it.id && !taken ? "reveal-open" : ""}`}>
          <div>
            <div className="flex gap-2 px-3.5 pb-3.5 pl-[68px]">
              <input
                type="text"
                placeholder="Reason (optional)"
                className="flex-1 rounded-[10px] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                style={{ background: "var(--surface-1)" }}
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
                className="rounded-[10px] px-4 text-[13px] font-semibold text-[var(--text-2)]"
                style={{ background: "var(--surface-3)" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const cnt = (l: ProtocolItem[]) =>
    `${l.filter((i) => e(i.id)?.taken).length}/${l.length}`;

  return (
    <div className="space-y-8">
      {morning.length > 0 && (
        <Group label="Morning Stack" meta={cnt(morning)}>
          {morning.map(renderItem)}
        </Group>
      )}
      {evening.length > 0 && (
        <Group label="Evening Stack" meta={cnt(evening)}>
          {evening.map(renderItem)}
        </Group>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrackPage() {
  const {
    state,
    loading,
    toggleSleepItem,
    updateExerciseEntry,
    updateNutritionScorecard,
    updateSupplementEntry,
    updateProtocols,
  } = useAppState();
  const toast = useToast();
  const [active, setActive] = useState<Pillar>("sleep");
  const [offset, setOffset] = useState(0); // days back from today
  const [detail, setDetail] = useState<ProtocolItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const todayKey = dateKey(new Date());
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return dateKey(d);
  }, [offset]);
  const isToday = offset === 0;
  const dateLabel = useMemo(() => {
    if (offset === 0) return "Today";
    if (offset === 1) return "Yesterday";
    return new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [offset, selectedDate]);

  const log = useMemo(
    () => getLogForDate(state, selectedDate),
    [state, selectedDate]
  );
  const scores: Record<Pillar, number> = {
    sleep: pillarScore(log, "sleep") ?? 0,
    exercise: pillarScore(log, "exercise") ?? 0,
    nutrition: pillarScore(log, "nutrition") ?? 0,
    supplements: pillarScore(log, "supplements") ?? 0,
  };
  const overall = Math.round(
    ORDER.reduce((s, p) => s + scores[p], 0) / ORDER.length
  );
  const activeIdx = ORDER.indexOf(active);

  const setSchedule = (item: ProtocolItem, days: boolean[]) => {
    const list = state.protocols[item.pillar].map((i) =>
      i.id === item.id ? { ...i, daysActive: days } : i
    );
    updateProtocols(item.pillar, list);
    setDetail({ ...item, daysActive: days });
  };
  const toggleEnabled = (item: ProtocolItem) => {
    const list = state.protocols[item.pillar].map((i) =>
      i.id === item.id ? { ...i, isEnabled: !i.isEnabled } : i
    );
    updateProtocols(item.pillar, list);
    setDetail(null);
    toast.show(item.isEnabled ? "Protocol disabled" : "Protocol enabled");
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
        <div className="space-y-6">
          <Skeleton className="h-8 w-40" rounded="rounded-full" />
          <Skeleton className="h-16 w-full" rounded="rounded-[var(--r-lg)]" />
          <Skeleton className="h-96 w-full" rounded="rounded-[var(--r-xl)]" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        {/* Header with focal progress */}
        <div className="anim-rise flex items-end justify-between">
          <div>
            <p className="t-eyebrow">Protocols</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setOffset((o) => Math.min(o + 1, 365))}
                aria-label="Previous day"
                className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)]"
                style={{ background: "var(--surface-2)" }}
              >
                <Icon name="chevron" size={15} className="rotate-180" />
              </button>
              <h1 className="t-title min-w-[120px] text-center text-[var(--text-1)]">
                {dateLabel}
              </h1>
              <button
                onClick={() => setOffset((o) => Math.max(o - 1, 0))}
                disabled={isToday}
                aria-label="Next day"
                className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)] disabled:opacity-30"
                style={{ background: "var(--surface-2)" }}
              >
                <Icon name="chevron" size={15} />
              </button>
            </div>
          </div>
          <div className="relative grid h-14 w-14 place-items-center">
            <svg width="56" height="56" className="-rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="3.5"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke={C[active]}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - overall / 100)}
                style={{ transition: "stroke-dashoffset 0.7s var(--ease), stroke 0.4s" }}
              />
            </svg>
            <span
              className="absolute text-[14px] font-bold text-[var(--text-1)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {overall}
            </span>
          </div>
        </div>

        {/* Pillar rail */}
        <div className="anim-rise d1 relative flex gap-1.5">
          {ORDER.map((p) => {
            const on = active === p;
            return (
              <button
                key={p}
                onClick={() => goTo(p)}
                className="press relative flex-1 overflow-hidden rounded-[var(--r-md)] py-3 tr"
                style={{
                  background: on ? "var(--surface-2)" : "transparent",
                  boxShadow: on ? "var(--shadow-row)" : "none",
                }}
              >
                {on && (
                  <span
                    className="ambient"
                    style={{
                      background: `radial-gradient(80% 60% at 50% 0%, ${C[p]}22, transparent)`,
                    }}
                  />
                )}
                <span className="relative flex flex-col items-center gap-1.5">
                  <Icon
                    name={RAIL_ICON[p]}
                    size={20}
                    stroke={on ? 1.9 : 1.6}
                    className={on ? "" : "text-[var(--text-3)]"}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-tight"
                    style={{ color: on ? C[p] : "var(--text-3)" }}
                  >
                    {PILLAR_META[p].label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Swipe panels */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="anim-rise d2 -mx-5 flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        >
          {ORDER.map((p) => (
            <div
              key={p}
              className="w-full shrink-0 snap-center px-5"
              style={{ minWidth: "100%" }}
            >
              <div className="panel relative overflow-hidden p-5">
                <span
                  className="ambient"
                  style={{
                    background: `radial-gradient(120% 70% at 50% -10%, ${C[p]}10, transparent 60%)`,
                  }}
                />
                <div className="relative mb-7 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="chip h-11 w-11"
                      style={{
                        background: `color-mix(in srgb, ${C[p]} 16%, var(--surface-3))`,
                        color: C[p],
                      }}
                    >
                      <Icon name={RAIL_ICON[p]} size={21} stroke={1.8} />
                    </span>
                    <div>
                      <h2 className="t-section text-[var(--text-1)]">
                        {PILLAR_META[p].label}
                      </h2>
                      <p className="text-[12px] text-[var(--text-3)]">
                        {Math.round(scores[p])}% complete
                      </p>
                    </div>
                  </div>
                  <div
                    className="h-1.5 w-16 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <div
                      className="h-full rounded-full tr"
                      style={{
                        width: `${Math.max(3, scores[p])}%`,
                        background: C[p],
                      }}
                    />
                  </div>
                </div>

                <div className="relative">
                  {p === "sleep" && (
                    <SleepTracker
                      log={log}
                      items={state.protocols.sleep}
                      onToggle={(id) => toggleSleepItem(log.date, id)}
                      onInfo={setDetail}
                    />
                  )}
                  {p === "exercise" && (
                    <ExerciseTracker
                      log={log}
                      items={state.protocols.exercise}
                      onUpdate={(id, u) =>
                        updateExerciseEntry(log.date, id, u)
                      }
                      onInfo={setDetail}
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
                      onInfo={setDetail}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {ORDER.map((p, i) => (
            <button
              key={p}
              onClick={() => goTo(p)}
              className="slide-ind h-1.5 rounded-full"
              style={{
                width: i === activeIdx ? 24 : 6,
                background: i === activeIdx ? C[p] : "var(--text-4)",
              }}
            />
          ))}
        </div>
      </div>

      <ProtocolDetailSheet
        item={detail}
        color={detail ? C[detail.pillar] : "var(--readiness)"}
        onClose={() => setDetail(null)}
        onScheduleChange={
          detail ? (days) => setSchedule(detail, days) : undefined
        }
        onToggleEnabled={detail ? () => toggleEnabled(detail) : undefined}
      />
    </Shell>
  );
}
