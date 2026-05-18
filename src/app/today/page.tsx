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
function isoDayIdx() {
  const j = new Date().getDay();
  return j === 0 ? 6 : j - 1;
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
  const { state, loading, toggleBehavior } = useAppState();
  const today = useMemo(() => dateKey(new Date()), []);
  const log = useMemo(() => getLogForDate(state, today), [state, today]);
  const [detail, setDetail] = useState<TimelineItem | null>(null);

  const adaptation = useMemo(() => adapt(state), [state]);
  const timeline = useMemo(() => {
    const items = compileTimeline(state, isoDayIdx());
    return shapeTimeline(items, adaptation.mode);
  }, [state, adaptation.mode]);

  const prog = useMemo(
    () => timelineProgress(timeline, log),
    [timeline, log]
  );

  const upNext = useMemo(
    () =>
      timeline.find((i) => !i.muted && !isDone(log, i.canonicalKey)) ?? null,
    [timeline, log]
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
        {/* Greeting */}
        <div>
          <Eyebrow>{displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {greeting()}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
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
          </div>
        </motion.div>

        {/* Up next — single focal action */}
        {upNext && (
          <div>
            <Eyebrow color="var(--text-3)">Up next</Eyebrow>
            <motion.button
              key={upNext.canonicalKey}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={() => toggleBehavior(today, upNext.canonicalKey)}
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

        {/* Timeline by block */}
        <div className="flex flex-col gap-7">
          {BLOCKS.map((block) => {
            const items = timeline.filter((i) => i.block === block);
            if (items.length === 0) return null;
            return (
              <section key={block}>
                <div className="mb-3 flex items-baseline justify-between px-1">
                  <Eyebrow>{blockLabel(block)}</Eyebrow>
                  <span className="text-[11px] font-medium text-[var(--text-3)]">
                    {items.filter((i) => isDone(log, i.canonicalKey)).length}/
                    {items.length}
                  </span>
                </div>
                <div className="well space-y-1.5 p-1.5">
                  {items.map((it) => {
                    const done = isDone(log, it.canonicalKey);
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
                            toggleBehavior(today, it.canonicalKey)
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
                            <span
                              className="block truncate text-[14.5px] font-semibold"
                              style={{
                                color: done
                                  ? "var(--text-3)"
                                  : "var(--text-1)",
                              }}
                            >
                              {it.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--text-3)]">
                              {it.kind === "avoid" && (
                                <Icon name="ban" size={11} />
                              )}
                              {it.muted
                                ? "Eased today"
                                : it.dose || it.fromPacks[0]}
                              {it.fromPacks.length > 1 &&
                                ` · +${it.fromPacks.length - 1}`}
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
