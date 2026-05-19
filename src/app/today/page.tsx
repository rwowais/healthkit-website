"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  leverageTag,
  upNextMessage,
  getSignals,
  type TimelineItem,
  type LeverageTag,
} from "@/lib/engine";
import {
  currentBlock,
  effectiveMinutes,
  fmtClock,
  behaviorStats,
  suggestions,
  dueRank,
  keystone,
  nowMinutes,
  type Suggestion,
} from "@/lib/intel";
import BehaviorSheet from "@/components/BehaviorSheet";
import { Skeleton, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { TimeBlock } from "@/lib/types";

const MODE_ACCENT: Record<string, string> = {
  normal: "var(--readiness)",
  essentials: "var(--warm)",
  recovery: "var(--recovery)",
  lighter: "var(--sleep)",
  rebuild: "var(--recovery)",
  primed: "var(--vitality)",
};
const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];
const TONE_COLOR: Record<LeverageTag["tone"], string> = {
  accent: "var(--readiness)",
  recovery: "var(--recovery)",
  sleep: "var(--sleep)",
  warm: "var(--warm)",
  vitality: "var(--vitality)",
  muted: "var(--text-4)",
};

/** Daypart-aware ambient tint for atmospheric depth. */
function daypartTint(cb: TimeBlock): string {
  if (cb === "morning") return "var(--vitality)";
  if (cb === "afternoon") return "var(--readiness)";
  return "var(--sleep)";
}

/** Human progression phrase — no mechanical N/total. */
function progressionPhrase(
  done: number,
  total: number,
  cb: TimeBlock
): string {
  if (total === 0) return "Nothing scheduled";
  if (done === total) return "Day fully closed";
  if (done === 0)
    return cb === "evening"
      ? "Evening — a quiet start is still a start"
      : "Day ahead — open and unhurried";
  const r = done / total;
  if (r >= 0.75) return "Strong finish in reach";
  if (r >= 0.4) return "In flow — momentum holding";
  return cb === "evening" ? "Winding down" : "Momentum building";
}

/** Human relative time vs now (minutes). */
function relTime(t: number | null, now: number): string {
  if (t == null) return "Anytime";
  const d = t - now;
  if (d <= -90) return "Earlier — still worth it";
  if (d <= 10) return "Now";
  if (d < 60) return `In ${d} min`;
  const h = Math.round(d / 60);
  return `In ~${h}h`;
}

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
  const router = useRouter();
  const settings = state.settings;

  // Onboarding guard — a returning user lands here after auth, but a
  // genuinely new account (cloud-loaded, no onboarding) gets sent to
  // build their system first.
  useEffect(() => {
    if (!loading && !state.settings.completedOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, state.settings.completedOnboarding, router]);

  const cb = useMemo(() => currentBlock(settings), [settings]);
  const [snoozed, setSnoozed] = useState<string[]>([]);
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
  const sig = useMemo(() => getSignals(state), [state]);
  const timeline = useMemo(() => {
    const items = compileTimeline(state, selDayIdx);
    return shapeTimeline(items, isToday ? adaptation.mode : "normal");
  }, [state, adaptation.mode, selDayIdx, isToday]);

  const prog = useMemo(
    () => timelineProgress(timeline, log),
    [timeline, log]
  );

  const ks = useMemo(() => keystone(state), [state]);
  const ksItem = useMemo(
    () =>
      ks ? timeline.find((i) => i.canonicalKey === ks.key) ?? null : null,
    [ks, timeline]
  );
  const dayComplete =
    isToday && prog.total > 0 && prog.done === prog.total;

  const upNext = useMemo(() => {
    const candidates = timeline.filter(
      (i) =>
        !i.muted &&
        !isDone(log, i.canonicalKey) &&
        !snoozed.includes(i.canonicalKey)
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort(
      (a, b) => dueRank(a, settings) - dueRank(b, settings)
    )[0];
  }, [timeline, log, settings, snoozed]);

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

        {/* Day complete — calm reward */}
        {dayComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative overflow-hidden p-7 text-center"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--vitality) 26%, transparent), transparent 62%)",
              }}
            />
            <div className="relative flex flex-col items-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 200,
                  damping: 14,
                }}
                className="chip h-16 w-16"
                style={{
                  background:
                    "color-mix(in srgb, var(--vitality) 22%, var(--surface-3))",
                  color: "var(--vitality)",
                }}
              >
                <Icon name="check" size={30} stroke={2.2} />
              </motion.span>
              <h2 className="t-title mt-5 text-[var(--text-1)]">
                You&apos;ve closed the day
                {state.settings.name ? `, ${state.settings.name}` : ""}
              </h2>
              <p className="t-body mt-2.5 max-w-[300px] leading-relaxed">
                Every behavior, done. This is the quiet, compounding work
                that actually changes a healthspan. Rest well.
              </p>
            </div>
          </motion.div>
        )}

        {/* Adaptive banner — focal */}
        {!dayComplete && (
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
              <Eyebrow color={accent}>Operating summary</Eyebrow>
            </div>
            <h2 className="t-section mt-3 text-[var(--text-1)]">
              {adaptation.headline}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
              {adaptation.tone}
            </p>

            {/* Signal chips — the system's read on you */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                {
                  k: "Recovery",
                  v:
                    sig.recoveryProxy == null
                      ? "Building"
                      : sig.recoveryProxy >= 70
                      ? "High"
                      : sig.recoveryProxy >= 45
                      ? "Moderate"
                      : "Low",
                  c:
                    sig.recoveryProxy == null
                      ? "var(--text-3)"
                      : sig.recoveryProxy >= 70
                      ? "var(--vitality)"
                      : sig.recoveryProxy >= 45
                      ? "var(--readiness)"
                      : "var(--alert)",
                },
                {
                  k: "Sleep",
                  v:
                    sig.sleepQuality == null
                      ? "—"
                      : sig.sleepQuality >= 4
                      ? "Strong"
                      : sig.sleepQuality === 3
                      ? "Steady"
                      : "Light",
                  c: "var(--sleep)",
                },
                {
                  k: "Focus",
                  v: ksItem ? ksItem.title : "Consistency",
                  c: "var(--warm)",
                },
              ].map((chip) => (
                <span
                  key={chip.k}
                  className="flex items-center gap-1.5 rounded-[var(--r-pill)] px-3 py-1.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: chip.c }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    {chip.k}
                  </span>
                  <span className="max-w-[120px] truncate text-[12px] font-semibold text-[var(--text-1)]">
                    {chip.v}
                  </span>
                </span>
              ))}
            </div>

            <div className="mt-5">
              {prog.essentials > 0 && (
                <div className="mb-2.5 flex items-center gap-1.5">
                  {Array.from({ length: prog.essentials }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 flex-1 rounded-full"
                      initial={false}
                      animate={{
                        backgroundColor:
                          i < prog.essentialsDone
                            ? accent
                            : "var(--surface-3)",
                      }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium leading-snug text-[var(--text-2)]">
                  {progressionPhrase(prog.done, prog.total, cb)}
                </p>
                {prog.essentials > 0 && (
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--text-3)]">
                    {prog.essentialsDone === prog.essentials
                      ? "Essentials secured"
                      : prog.essentialsDone === 0
                      ? `${prog.essentials} essentials`
                      : `${prog.essentialsDone} of ${prog.essentials} secured`}
                  </span>
                )}
              </div>
            </div>
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
        )}

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

        {/* Up next — the single intelligent focus */}
        {isToday && !dayComplete && upNext && (
          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <Eyebrow color="var(--text-3)">Up next</Eyebrow>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, var(--surface-2))`,
                  color: accent,
                }}
              >
                {relTime(
                  effectiveMinutes(upNext, settings),
                  nowMinutes()
                ).toUpperCase()}
              </span>
            </div>
            <motion.div
              key={upNext.canonicalKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[var(--r-xl)] p-5"
              style={{
                background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 14%, var(--surface-1)), var(--surface-1) 70%)`,
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <span
                className="ambient anim-pulse"
                style={{
                  background: `radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, ${accent} 20%, transparent), transparent 60%)`,
                }}
              />
              <button
                onClick={() =>
                  toggleBehavior(selectedDate, upNext.canonicalKey)
                }
                className="press relative flex w-full items-center gap-4 text-left"
              >
                <span
                  className="chip h-16 w-16 shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${accent} 24%, var(--surface-3))`,
                    color: accent,
                  }}
                >
                  <Icon
                    name={upNext.icon as IconName}
                    size={28}
                    stroke={1.7}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const isK = !!ks && upNext.canonicalKey === ks.key;
                      const tg = leverageTag(upNext, adaptation.mode, {
                        isKeystone: isK,
                        streak: behaviorStats(state, upNext.canonicalKey)
                          .streak,
                      });
                      const c = TONE_COLOR[tg.tone];
                      return (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                          style={{
                            background: `color-mix(in srgb, ${c} 18%, var(--surface-3))`,
                            color: c,
                          }}
                        >
                          {tg.text.toUpperCase()}
                        </span>
                      );
                    })()}
                    <span className="text-[11px] text-[var(--text-3)]">
                      {upNext.fromPacks[0]}
                      {upNext.fromPacks.length > 1 &&
                        ` +${upNext.fromPacks.length - 1}`}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[19px] font-bold leading-tight text-[var(--text-1)]">
                    {upNext.title}
                  </p>
                  {upNext.dose && (
                    <p className="mt-1 text-[13px] text-[var(--text-2)]">
                      {upNext.dose}
                    </p>
                  )}
                </div>
                <Check on={false} color={accent} />
              </button>
              <p className="relative mt-4 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                {upNextMessage(upNext, {
                  mode: adaptation.mode,
                  minutesToStart:
                    effectiveMinutes(upNext, settings) != null
                      ? (effectiveMinutes(upNext, settings) as number) -
                        nowMinutes()
                      : null,
                  isKeystone: !!ks && upNext.canonicalKey === ks.key,
                })}
              </p>
              <div className="relative mt-4 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-4)]">
                  {prog.done > 0
                    ? `${prog.done} done — keep the thread going`
                    : "First one sets the tone"}
                </span>
                <button
                  onClick={() =>
                    setSnoozed((s) => [...s, upNext.canonicalKey])
                  }
                  className="press rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--text-3)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  Later
                </button>
              </div>
            </motion.div>
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
            const visibleItems = items.filter((i) => !i.muted);
            const optionalItems = items.filter((i) => i.muted);
            const optKey = `opt:${block}`;
            const showOpt = !!openBlocks[optKey];
            const rendered = items.filter((i) => !i.muted || showOpt);
            const baseItems =
              visibleItems.length > 0 ? visibleItems : items;
            const doneCount = baseItems.filter((i) =>
              isDone(log, i.canonicalKey)
            ).length;
            const cbIdx = BLOCKS.indexOf(cb);
            const isCurrent = block === cb;
            const isPast = bIdx < cbIdx;
            const fullyDone =
              baseItems.length > 0 && doneCount === baseItems.length;
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
                    {fullyDone
                      ? "Complete"
                      : doneCount > 0
                      ? "In flow"
                      : "Open"}
                    {collapsed && (
                      <Icon name="chevron" size={12} className="rotate-90" />
                    )}
                  </span>
                </button>

                {!collapsed && (
                  <div
                    className="relative"
                    style={{
                      opacity: isCurrent ? 1 : isPast ? 0.6 : 0.85,
                    }}
                  >
                    {rendered.length > 1 && (
                      <>
                        <span
                          className="absolute bottom-4 top-4 w-px"
                          style={{
                            left: 19,
                            background:
                              "linear-gradient(180deg, transparent, rgba(255,255,255,0.05) 12%, rgba(255,255,255,0.05) 88%, transparent)",
                          }}
                        />
                        <motion.span
                          className="absolute top-4 w-px"
                          style={{ left: 19, background: accent, opacity: 0.4 }}
                          initial={false}
                          animate={{
                            height: `${
                              (doneCount / Math.max(baseItems.length, 1)) *
                              100
                            }%`,
                          }}
                          transition={{
                            duration: 0.7,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </>
                    )}
                    {(() => {
                      const now = nowMinutes();
                      let nowShown = false;
                      return rendered.map((it) => {
                        const done = isDone(log, it.canonicalKey);
                        const t = effectiveMinutes(it, settings);
                        const st = behaviorStats(state, it.canonicalKey);
                        const isKey = !!ks && it.canonicalKey === ks.key;
                        const lev3 = it.leverage === 3 || isKey;
                        const lev1 = it.leverage === 1 && !isKey;
                        const showNow =
                          isCurrent &&
                          isToday &&
                          !nowShown &&
                          t != null &&
                          t > now;
                        if (showNow) nowShown = true;
                        const tint = it.muted
                          ? "var(--text-3)"
                          : accent;

                        return (
                          <div key={it.canonicalKey}>
                            {showNow && (
                              <div className="relative flex items-center gap-3 py-1.5">
                                <span
                                  className="relative z-10 grid w-10 shrink-0 place-items-center"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full anim-pulse"
                                    style={{
                                      background: accent,
                                      boxShadow: `0 0 8px ${accent}`,
                                    }}
                                  />
                                </span>
                                <span
                                  className="text-[10px] font-bold tracking-wide"
                                  style={{ color: accent }}
                                >
                                  NOW · {fmtClock(now)}
                                </span>
                                <span
                                  className="h-px flex-1"
                                  style={{ background: `${accent}40` }}
                                />
                              </div>
                            )}

                            <div
                              className={`group relative flex items-stretch gap-3 ${
                                lev1 ? "py-1" : "py-1.5"
                              }`}
                            >
                              {/* Node on the spine */}
                              <button
                                onClick={() =>
                                  toggleBehavior(
                                    selectedDate,
                                    it.canonicalKey
                                  )
                                }
                                aria-label={done ? "Done" : "Mark done"}
                                className="press relative z-10 grid w-10 shrink-0 place-items-center"
                              >
                                <span
                                  className={`grid place-items-center rounded-full tr-fast ${
                                    done ? "anim-node-pulse" : ""
                                  }`}
                                  style={
                                    {
                                      height: lev3 ? 26 : lev1 ? 16 : 20,
                                      width: lev3 ? 26 : lev1 ? 16 : 20,
                                      background: done
                                        ? tint
                                        : "var(--bg)",
                                      "--pulse-c": `color-mix(in srgb, ${tint} 45%, transparent)`,
                                      boxShadow: done
                                        ? `0 0 10px color-mix(in srgb, ${tint} 30%, transparent)`
                                        : `inset 0 0 0 ${
                                            lev3 ? 1.75 : 1.5
                                          }px ${
                                            lev3 && !it.muted
                                              ? `color-mix(in srgb, ${tint} 60%, var(--text-4))`
                                              : "var(--hairline-strong)"
                                          }`,
                                    } as React.CSSProperties
                                  }
                                >
                                  {done ? (
                                    <svg
                                      width={lev3 ? 14 : 11}
                                      height={lev3 ? 14 : 11}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#08090B"
                                      strokeWidth="3.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M5 12.5l4.5 4.5L19 7" />
                                    </svg>
                                  ) : lev3 ? (
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ background: tint }}
                                    />
                                  ) : null}
                                </span>
                              </button>

                              {/* Content */}
                              <button
                                onClick={() =>
                                  lev1
                                    ? toggleBehavior(
                                        selectedDate,
                                        it.canonicalKey
                                      )
                                    : setDetail(it)
                                }
                                className={`min-w-0 flex-1 rounded-[var(--r-md)] text-left tr-fast ${
                                  lev3 && !done
                                    ? "px-4 py-3"
                                    : lev1
                                    ? "px-2 py-1.5"
                                    : "px-3 py-2.5"
                                }`}
                                style={{
                                  opacity: it.muted ? 0.55 : 1,
                                  background:
                                    lev3 && !done
                                      ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, transparent), transparent)`
                                      : "transparent",
                                  boxShadow:
                                    lev3 && !done
                                      ? `inset 2px 0 0 color-mix(in srgb, ${accent} 70%, transparent)`
                                      : "none",
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`min-w-0 ${
                                      lev1
                                        ? "truncate text-[13px] font-medium"
                                        : "line-clamp-2 font-semibold leading-snug"
                                    } ${
                                      lev3 && !done
                                        ? "text-[15.5px]"
                                        : "text-[14px]"
                                    }`}
                                    style={{
                                      color: done
                                        ? "var(--text-3)"
                                        : lev1
                                        ? "var(--text-2)"
                                        : "var(--text-1)",
                                      textDecoration: done
                                        ? "none"
                                        : "none",
                                    }}
                                  >
                                    {it.title}
                                  </span>
                                  {isKey && !done && (
                                    <span
                                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                                      style={{
                                        background:
                                          "color-mix(in srgb, var(--warm) 18%, var(--surface-3))",
                                        color: "var(--warm)",
                                      }}
                                    >
                                      KEYSTONE
                                    </span>
                                  )}
                                  {!isKey && lev3 && !done && (
                                    <span
                                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                                      style={{
                                        background: "var(--surface-3)",
                                        color: accent,
                                      }}
                                    >
                                      ESSENTIAL
                                    </span>
                                  )}
                                  {st.streak >= 3 && !done && (
                                    <span
                                      className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold"
                                      style={{ color: "var(--warm)" }}
                                    >
                                      <Icon name="flame" size={11} />
                                      {st.streak}
                                    </span>
                                  )}
                                </div>
                                {!lev1 && (
                                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--text-3)]">
                                    {t != null && !it.muted && (
                                      <span className="tabular-nums">
                                        {fmtClock(t)}
                                      </span>
                                    )}
                                    {t != null && !it.muted && (
                                      <span>·</span>
                                    )}
                                    {it.kind === "avoid" && (
                                      <Icon name="ban" size={11} />
                                    )}
                                    <span className="truncate">
                                      {it.muted
                                        ? "Resting today"
                                        : it.dose || it.fromPacks[0]}
                                    </span>
                                  </div>
                                )}
                                {lev3 && !done && !it.muted && (
                                  <p className="mt-1.5 line-clamp-1 text-[12px] leading-relaxed text-[var(--text-3)]">
                                    {it.rationale}
                                  </p>
                                )}
                                {lev1 && t != null && !it.muted && (
                                  <span className="ml-2 text-[11px] tabular-nums text-[var(--text-4)]">
                                    {fmtClock(t)}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {optionalItems.length > 0 && (
                      <button
                        onClick={() =>
                          setOpenBlocks((o) => ({
                            ...o,
                            [optKey]: !o[optKey],
                          }))
                        }
                        className="press mt-1 flex w-full items-center gap-3 pl-10 text-left"
                      >
                        <span className="text-[12px] font-medium text-[var(--text-3)]">
                          {showOpt
                            ? "Hide optional"
                            : `${optionalItems.length} optional today — eased to protect your focus`}
                        </span>
                        <Icon
                          name="chevron"
                          size={12}
                          className={`text-[var(--text-4)] ${
                            showOpt ? "-rotate-90" : "rotate-90"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <BehaviorSheet
        item={detail}
        override={
          detail ? state.behaviorOverrides?.[detail.canonicalKey] : undefined
        }
        color={accent}
        onClose={() => setDetail(null)}
        onChange={(next) => {
          if (detail) setBehaviorOverride(detail.canonicalKey, next);
        }}
        onToggleEnabled={
          detail
            ? () => {
                const cur =
                  state.behaviorOverrides?.[detail.canonicalKey] ?? {};
                setBehaviorOverride(detail.canonicalKey, {
                  ...cur,
                  disabled: !cur.disabled,
                });
                setDetail(null);
              }
            : undefined
        }
        isEnabled={
          detail
            ? !state.behaviorOverrides?.[detail.canonicalKey]?.disabled
            : true
        }
      />
    </Shell>
  );
}
