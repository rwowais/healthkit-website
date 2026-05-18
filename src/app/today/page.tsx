"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import {
  compileTimeline,
  adapt,
  shapeTimeline,
  isDone,
  timelineProgress,
  blockLabel,
  type TimelineItem,
} from "@/lib/engine";
import {
  currentBlock,
  resolveMinutes,
  fmtClock,
  behaviorStats,
  suggestions,
  dueRank,
  type Suggestion,
} from "@/lib/intel";
import { Skeleton, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { TimeBlock } from "@/lib/types";

const MODE_ACCENT: Record<string, string> = {
  normal: "var(--readiness)",
  essentials: "var(--warm)",
  recovery: "var(--recovery)",
  primed: "var(--vitality)",
};
const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Check({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
      style={{ boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--text-4)" }}
    >
      {on && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {on && (
        <svg
          className="relative"
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

export default function TodayPage() {
  const {
    state,
    loading,
    toggleBehavior,
    updateSleepLog,
    updateRatings,
    installPack,
    setBehaviorOverride,
  } = useAppState();
  const settings = state.settings;
  const cb = useMemo(() => currentBlock(settings), [settings]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [offset, setOffset] = useState(0);
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return dateKey(d);
  }, [offset]);
  const isToday = offset === 0;
  const selDayIdx = useMemo(() => {
    const j = new Date(selectedDate + "T00:00:00").getDay();
    return j === 0 ? 6 : j - 1;
  }, [selectedDate]);
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
  const [detail, setDetail] = useState<TimelineItem | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const sleepQ = log.sleepLog?.sleepQuality ?? null;
  const energy = log.energyLevel ?? null;
  const checkedIn = sleepQ != null && energy != null;

  const adaptation = useMemo(() => adapt(state), [state]);
  const timeline = useMemo(() => {
    const items = compileTimeline(state, selDayIdx);
    return shapeTimeline(items, isToday ? adaptation.mode : "normal");
  }, [state, adaptation.mode, selDayIdx, isToday]);

  const prog = useMemo(
    () => timelineProgress(timeline, log),
    [timeline, log]
  );

  const upNext = useMemo(() => {
    const candidates = timeline.filter(
      (i) => !i.muted && !isDone(log, i.canonicalKey)
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort(
      (a, b) => dueRank(a, settings) - dueRank(b, settings)
    )[0];
  }, [timeline, log, settings]);

  const activeSuggestions = useMemo<Suggestion[]>(
    () => suggestions(state).filter((s) => !dismissed.includes(s.id)),
    [state, dismissed]
  );

  const displayDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-44" rounded="rounded-full" />
          <Skeleton className="h-28 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-40 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  if (timeline.length === 0) {
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <div>
            <Eyebrow>{displayDate}</Eyebrow>
            <h1 className="t-title mt-2 text-[var(--text-1)]">
              {greeting()}
              {state.settings.name ? `, ${state.settings.name}` : ""}
            </h1>
          </div>
          <div className="panel flex flex-col items-center px-6 py-14 text-center">
            <span
              className="chip mb-5 h-14 w-14"
              style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
            >
              <Icon name="compass" size={24} />
            </span>
            <p className="t-section text-[var(--text-1)]">
              Your day is a blank canvas
            </p>
            <p className="t-caption mt-2 max-w-[260px] leading-relaxed">
              Install a protocol and Protocolize will assemble an adaptive
              daily system for you.
            </p>
            <Link
              href="/library"
              className="press tr-fast mt-6 rounded-[var(--r-pill)] bg-[var(--text-1)] px-6 py-3 text-[14px] font-semibold text-[#08090B]"
            >
              Browse the Library
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const accent = MODE_ACCENT[adaptation.mode];

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        {/* Greeting + date scrubber */}
        <div>
          <Eyebrow>{displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {greeting()}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setOffset((o) => Math.min(o + 1, 30))}
              aria-label="Previous day"
              className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)]"
              style={{ background: "var(--surface-2)" }}
            >
              <Icon name="chevron" size={14} className="rotate-180" />
            </button>
            <span className="min-w-[110px] text-center text-[13px] font-semibold text-[var(--text-2)]">
              {dateLabel}
            </span>
            <button
              onClick={() => setOffset((o) => Math.max(o - 1, 0))}
              disabled={isToday}
              aria-label="Next day"
              className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)] disabled:opacity-30"
              style={{ background: "var(--surface-2)" }}
            >
              <Icon name="chevron" size={14} />
            </button>
            {!isToday && (
              <button
                onClick={() => setOffset(0)}
                className="press text-[12px] font-semibold text-[var(--readiness)]"
              >
                Back to today
              </button>
            )}
          </div>
        </div>

        {/* Adaptive banner — focal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="panel relative overflow-hidden p-6"
        >
          <span
            className="ambient"
            style={{
              background: `radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, ${accent} 22%, transparent), transparent 60%)`,
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full anim-pulse"
                style={{ background: accent }}
              />
              <Eyebrow color={accent}>{adaptation.headline}</Eyebrow>
            </div>
            <p className="t-body mt-3 leading-relaxed text-[var(--text-1)]">
              {adaptation.tone}
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--surface-3)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: accent }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      prog.total
                        ? Math.max(3, (prog.done / prog.total) * 100)
                        : 0
                    }%`,
                  }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="text-[12px] font-semibold text-[var(--text-2)]">
                {prog.done}/{prog.total}
              </span>
            </div>
            {prog.essentials > 0 && (
              <p className="t-caption mt-2">
                {prog.essentialsDone}/{prog.essentials} high-leverage
                essentials done — momentum over perfection.
              </p>
            )}
            {adaptation.reasons.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowWhy((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-3)]"
                >
                  <Icon name="info" size={12} />
                  Why today looks like this
                  <Icon
                    name="chevron"
                    size={12}
                    className={showWhy ? "rotate-90" : ""}
                  />
                </button>
                {showWhy && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2.5 space-y-1.5 overflow-hidden"
                  >
                    {adaptation.reasons.map((r) => (
                      <li
                        key={r}
                        className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]"
                      >
                        <span
                          className="h-1 w-1 rounded-full"
                          style={{ background: accent }}
                        />
                        {r}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Daily check-in — feeds the adaptive engine */}
        {isToday && !checkedIn && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5"
          >
            <Eyebrow>Morning check-in</Eyebrow>
            <p className="t-caption mt-1.5">
              Two taps. This is what makes tomorrow adapt to you.
            </p>
            <p className="mt-4 mb-2 text-[13px] font-medium text-[var(--text-2)]">
              How did you sleep?
            </p>
            <div className="flex gap-2">
              {[
                { l: "Poor", q: 2 },
                { l: "OK", q: 3 },
                { l: "Great", q: 5 },
              ].map((o) => (
                <button
                  key={o.l}
                  onClick={() =>
                    updateSleepLog(selectedDate, { sleepQuality: o.q })
                  }
                  className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[13px] font-semibold"
                  style={{
                    background:
                      sleepQ === o.q ? "var(--sleep)" : "var(--surface-2)",
                    color: sleepQ === o.q ? "#08090B" : "var(--text-3)",
                  }}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-4 mb-2 text-[13px] font-medium text-[var(--text-2)]">
              Energy right now?
            </p>
            <div className="flex gap-2">
              {[
                { l: "Low", e: 2 },
                { l: "Steady", e: 3 },
                { l: "High", e: 5 },
              ].map((o) => (
                <button
                  key={o.l}
                  onClick={() => updateRatings(selectedDate, { energy: o.e })}
                  className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[13px] font-semibold"
                  style={{
                    background:
                      energy === o.e
                        ? "var(--readiness)"
                        : "var(--surface-2)",
                    color: energy === o.e ? "#08090B" : "var(--text-3)",
                  }}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Up next — single focal action */}
        {isToday && upNext && (
          <div>
            <Eyebrow color="var(--text-3)">Up next</Eyebrow>
            <motion.button
              key={upNext.canonicalKey}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={() => toggleBehavior(selectedDate, upNext.canonicalKey)}
              className="press mt-3 w-full overflow-hidden rounded-[var(--r-xl)] p-5 text-left"
              style={{
                background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 12%, var(--surface-1)), var(--surface-1))`,
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="chip h-14 w-14 shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${accent} 22%, var(--surface-3))`,
                    color: accent,
                  }}
                >
                  <Icon
                    name={upNext.icon as IconName}
                    size={26}
                    stroke={1.7}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[18px] font-bold text-[var(--text-1)]">
                    {upNext.title}
                  </p>
                  {upNext.dose && (
                    <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                      {upNext.dose}
                    </p>
                  )}
                </div>
                <Check on={false} color={accent} />
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-3)]">
                {upNext.rationale}
              </p>
            </motion.button>
          </div>
        )}

        {/* Adaptive suggestion — calm, dismissible */}
        {isToday &&
          activeSuggestions.length > 0 &&
          (() => {
            const sug = activeSuggestions[0];
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card relative overflow-hidden p-5"
              >
                <span
                  className="ambient"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--vitality) 16%, transparent), transparent 60%)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Icon
                      name="bulb"
                      size={14}
                      className="text-[var(--vitality)]"
                    />
                    <Eyebrow color="var(--vitality)">Suggestion</Eyebrow>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-[var(--text-1)]">
                    {sug.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                    {sug.body}
                  </p>
                  <div className="mt-4 flex gap-2.5">
                    <button
                      onClick={() => {
                        if (sug.action.type === "install")
                          installPack(sug.action.packId);
                        else if (sug.action.type === "pause")
                          setBehaviorOverride(sug.action.key, {
                            disabled: true,
                          });
                        setDismissed((d) => [...d, sug.id]);
                      }}
                      className="press tr-fast rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2.5 text-[13px] font-semibold text-[#08090B]"
                    >
                      {sug.cta}
                    </button>
                    <button
                      onClick={() =>
                        setDismissed((d) => [...d, sug.id])
                      }
                      className="press tr-fast rounded-[var(--r-pill)] px-4 py-2.5 text-[13px] font-semibold text-[var(--text-3)]"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })()}

        {/* Live, time-aware timeline */}
        <div className="flex flex-col gap-7">
          {BLOCKS.map((block, bIdx) => {
            const items = timeline.filter((i) => i.block === block);
            if (items.length === 0) return null;
            const doneCount = items.filter((i) =>
              isDone(log, i.canonicalKey)
            ).length;
            const cbIdx = BLOCKS.indexOf(cb);
            const isCurrent = block === cb;
            const isPast = bIdx < cbIdx;
            const fullyDone = doneCount === items.length;
            const collapsed =
              isPast && fullyDone && !openBlocks[block];

            return (
              <section key={block}>
                <button
                  onClick={() =>
                    setOpenBlocks((o) => ({ ...o, [block]: !o[block] }))
                  }
                  className="mb-3 flex w-full items-center justify-between px-1"
                >
                  <span className="flex items-center gap-2">
                    <Eyebrow color={isCurrent ? accent : undefined}>
                      {blockLabel(block)}
                    </Eyebrow>
                    {isCurrent && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                        style={{
                          background: accent,
                          color: "#08090B",
                        }}
                      >
                        NOW
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                    {doneCount}/{items.length}
                    {collapsed && (
                      <Icon name="chevron" size={12} className="rotate-90" />
                    )}
                  </span>
                </button>

                {!collapsed && (
                  <div
                    className="well space-y-1.5 p-1.5"
                    style={{
                      opacity: isCurrent ? 1 : isPast ? 0.55 : 0.82,
                    }}
                  >
                    {items.map((it) => {
                      const done = isDone(log, it.canonicalKey);
                      const t = resolveMinutes(it, settings);
                      const st = behaviorStats(state, it.canonicalKey);
                      return (
                        <div
                          key={it.canonicalKey}
                          className="row row-tap flex items-center"
                          style={{
                            opacity: it.muted ? 0.45 : 1,
                            background: done
                              ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, var(--surface-2)), var(--surface-1))`
                              : undefined,
                          }}
                        >
                          <button
                            onClick={() =>
                              toggleBehavior(selectedDate, it.canonicalKey)
                            }
                            className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-3.5 text-left"
                          >
                            <Check
                              on={done}
                              color={it.muted ? "var(--text-3)" : accent}
                            />
                            <span
                              className="chip h-9 w-9 shrink-0"
                              style={{
                                background: done
                                  ? accent
                                  : "var(--surface-3)",
                                color: done ? "#08090B" : "var(--text-2)",
                              }}
                            >
                              <Icon
                                name={it.icon as IconName}
                                size={17}
                                stroke={1.7}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span
                                  className="line-clamp-2 min-w-0 text-[14.5px] font-semibold leading-snug"
                                  style={{
                                    color: done
                                      ? "var(--text-3)"
                                      : "var(--text-1)",
                                  }}
                                >
                                  {it.title}
                                </span>
                                {st.streak >= 3 && !done && (
                                  <span
                                    className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold"
                                    style={{ color: "var(--warm)" }}
                                  >
                                    <Icon name="flame" size={11} />
                                    {st.streak}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--text-3)]">
                                {t != null && !it.muted && (
                                  <span className="tabular-nums">
                                    {fmtClock(t)}
                                  </span>
                                )}
                                {t != null && !it.muted && <span>·</span>}
                                {it.kind === "avoid" && (
                                  <Icon name="ban" size={11} />
                                )}
                                {it.muted
                                  ? "Eased today"
                                  : it.dose || it.fromPacks[0]}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => setDetail(it)}
                            aria-label="Details"
                            className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-4)] hover:text-[var(--text-2)]"
                            style={{ marginRight: 8 }}
                          >
                            <Icon name="info" size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Behavior detail */}
      {detail && (
        <div
          className="anim-fade fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setDetail(null)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="glass w-full max-w-[480px] rounded-t-[var(--r-xl)] border-t border-[var(--hairline-strong)] p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-[var(--r-xl)] sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--text-4)] sm:hidden" />
            <div className="flex items-start gap-3">
              <span
                className="chip h-12 w-12 shrink-0"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, var(--surface-3))`,
                  color: accent,
                }}
              >
                <Icon name={detail.icon as IconName} size={22} />
              </span>
              <div>
                <h3 className="t-section text-[var(--text-1)]">
                  {detail.title}
                </h3>
                <p className="t-caption mt-1">
                  From {detail.fromPacks.join(" · ")}
                </p>
              </div>
            </div>
            <p className="t-body mt-5 leading-relaxed text-[var(--text-1)]">
              {detail.rationale}
            </p>
            {detail.evidence && (
              <div
                className="mt-4 rounded-[var(--r-md)] p-4"
                style={{ background: "var(--surface-2)" }}
              >
                <Eyebrow color={accent}>Why this works</Eyebrow>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                  {detail.evidence}
                </p>
              </div>
            )}
            {detail.recommendedBy && detail.recommendedBy.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.recommendedBy.map((r) => (
                  <span
                    key={r}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)]"
                    style={{ background: "var(--surface-3)" }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
            <Link
              href="/protocols"
              className="press tr-fast mt-6 block w-full rounded-[var(--r-pill)] bg-[var(--surface-3)] py-3.5 text-center text-[14px] font-semibold text-[var(--text-1)]"
            >
              Adjust in Protocols
            </Link>
          </motion.div>
        </div>
      )}
    </Shell>
  );
}
