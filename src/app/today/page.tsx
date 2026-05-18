"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { getTodayLog } from "@/lib/storage";
import { calculateStreak, weeklyActiveDays } from "@/lib/scoring";
import { PILLAR_META } from "@/lib/constants";
import {
  readinessScore,
  recoveryScore,
  adherenceScore,
  pillarScore,
  hasAnyTracking,
  readinessBreakdown,
  band,
  bandColor,
  PILLAR_LIST,
} from "@/lib/metrics";
import { topInsight } from "@/lib/insights";
import { RingScore, MiniRing } from "@/components/ui/Ring";
import { BarWeek } from "@/components/ui/Charts";
import { Card, Eyebrow, Skeleton, NoData, Sheet } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { DailyLog, Pillar } from "@/lib/types";

const C: Record<Pillar, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};
const RAIL: Record<Pillar, IconName> = {
  sleep: "moon",
  exercise: "pulse",
  nutrition: "leaf",
  supplements: "pill",
};

function fmtKey(d: Date) {
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
function last7(logs: DailyLog[]) {
  const out: { label: string; value: number; highlight?: boolean }[] = [];
  const L = ["M", "T", "W", "T", "F", "S", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const log = logs.find((l) => l.date === fmtKey(d));
    const ji = d.getDay();
    out.push({
      label: L[ji === 0 ? 6 : ji - 1],
      value: log?.score ?? 0,
      highlight: i === 0,
    });
  }
  return out;
}

export default function TodayPage() {
  const { state, loading } = useAppState();
  const today = useToday();
  const log = useMemo(() => getTodayLog(state), [state]);
  const streak = useMemo(
    () => calculateStreak(state.dailyLogs),
    [state.dailyLogs]
  );
  const weekDays = useMemo(
    () => weeklyActiveDays(state.dailyLogs),
    [state.dailyLogs]
  );

  const [showBreakdown, setShowBreakdown] = useState(false);
  const readiness = readinessScore(log);
  const breakdown = useMemo(() => readinessBreakdown(log), [log]);
  const recovery = recoveryScore(log);
  const adherence = adherenceScore(log);
  const sleepP = pillarScore(log, "sleep");
  const tracked = hasAnyTracking(log);

  const weekly = useMemo(() => last7(state.dailyLogs), [state.dailyLogs]);
  const hasWeek = weekly.some((w) => w.value > 0);
  const weekAvg = useMemo(() => {
    const v = weekly.map((w) => w.value).filter((x) => x > 0);
    return v.length
      ? Math.round(v.reduce((a, b) => a + b, 0) / v.length)
      : null;
  }, [weekly]);

  const insight = useMemo(() => {
    if (!tracked)
      return "Open the tracker and check off your first protocol — your readiness and trends build from here.";
    const data = topInsight(state.dailyLogs);
    if (data) return data;
    if (state.dailyLogs.filter((l) => l.score > 0).length < 3)
      return "You're getting started. After a few tracked days, this space will surface patterns specific to you.";
    if (streak >= 7)
      return `A ${streak}-day streak. Consistency is the strongest lever for long-term health — keep the momentum.`;
    if (sleepP != null && sleepP < 50)
      return "Sleep adherence is today's biggest opportunity. Protecting your wind-down compounds across every other system.";
    if (readiness != null && readiness >= 75)
      return "Your inputs look strong today. A good day to lean into demanding training and focused work.";
    if (readiness != null && readiness < 45)
      return "Readiness is on the lower side. Favor recovery — light movement, hydration, and an earlier night.";
    return "Steady. Keep logging consistently and the insight engine will surface what's working for you.";
  }, [tracked, state.dailyLogs, streak, sleepP, readiness]);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-44" rounded="rounded-full" />
          <Skeleton
            className="mx-auto h-[220px] w-[220px]"
            rounded="rounded-full"
          />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise">
          <Eyebrow>{today.displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {greeting()}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
        </div>

        {/* Readiness hero — cold-start safe */}
        <div className="anim-rise d1 flex flex-col items-center pt-2">
          {readiness == null ? (
            <Link
              href="/track"
              className="press flex flex-col items-center"
            >
              <div
                className="grid h-[200px] w-[200px] place-items-center rounded-full"
                style={{ border: "2px dashed var(--hairline-strong)" }}
              >
                <div className="text-center">
                  <Icon
                    name="check"
                    size={30}
                    className="mx-auto text-[var(--text-3)]"
                  />
                  <p className="t-label mt-3 text-[var(--text-2)]">
                    Start tracking
                  </p>
                  <p className="t-caption mt-1">to see readiness</p>
                </div>
              </div>
            </Link>
          ) : (
            <button
              onClick={() => setShowBreakdown(true)}
              className="press flex flex-col items-center"
            >
              <RingScore
                value={readiness}
                label={band(readiness)}
                sublabel="Readiness"
                color={bandColor(readiness)}
              />
              <span className="t-caption mt-3 flex items-center gap-1.5">
                <Icon name="info" size={12} /> How this is calculated
              </span>
            </button>
          )}
          <div className="mt-6 flex items-center gap-2.5">
            {streak > 0 ? (
              <div className="flex items-center gap-2 rounded-[var(--r-pill)] bg-[var(--warm-soft)] px-4 py-2">
                <Icon
                  name="sparkle"
                  size={14}
                  className="text-[var(--warm)]"
                />
                <span className="text-[13px] font-semibold text-[var(--warm)]">
                  {streak}-day streak
                </span>
              </div>
            ) : (
              <span className="t-caption">Begin your streak today</span>
            )}
            <div className="flex items-center gap-2 rounded-[var(--r-pill)] bg-[var(--surface-2)] px-4 py-2">
              <span className="text-[13px] font-semibold text-[var(--text-2)]">
                {weekDays}/7 this week
              </span>
            </div>
          </div>
        </div>

        {/* Tiles */}
        <div className="anim-rise d2 grid grid-cols-3 gap-3">
          {[
            { k: "Sleep", v: sleepP, c: "var(--sleep)", href: "/sleep" },
            {
              k: "Recovery",
              v: recovery,
              c: "var(--recovery)",
              href: "/recovery",
            },
            {
              k: "Adherence",
              v: adherence,
              c: "var(--vitality)",
              href: "/track",
            },
          ].map((m) => (
            <Link key={m.k} href={m.href}>
              <Card pad="p-4" className="h-full">
                <p className="t-eyebrow">{m.k}</p>
                {m.v == null ? (
                  <>
                    <p className="mt-3">
                      <NoData size={28} />
                    </p>
                    <p className="t-caption mt-1">No data</p>
                  </>
                ) : (
                  <>
                    <p
                      className="mt-3 text-[30px] font-bold tracking-tight"
                      style={{
                        color: m.c,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(m.v)}
                    </p>
                    <p className="t-caption mt-0.5">{band(m.v)}</p>
                  </>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {/* Focus */}
        <Card className="anim-rise d3 relative overflow-hidden">
          <span
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{
              background:
                "linear-gradient(180deg, var(--sleep), var(--recovery), var(--vitality))",
            }}
          />
          <Eyebrow color="var(--text-2)">Today&apos;s Focus</Eyebrow>
          <p className="t-body mt-3 leading-relaxed text-[var(--text-1)]">
            {insight}
          </p>
        </Card>

        {/* Pillar rings */}
        <div className="anim-rise d4">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="t-section text-[var(--text-1)]">Protocols</h2>
            <Link href="/track" className="t-caption text-[var(--readiness)]">
              Open tracker →
            </Link>
          </div>
          <Card pad="p-5">
            <div className="flex justify-between">
              {PILLAR_LIST.map((p) => {
                const v = pillarScore(log, p);
                return (
                  <Link
                    key={p}
                    href="/track"
                    className="press flex flex-col items-center gap-2.5"
                  >
                    <MiniRing
                      value={v ?? 0}
                      color={C[p]}
                      icon={
                        <Icon name={RAIL[p]} size={18} stroke={1.7} />
                      }
                    />
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-[var(--text-1)]">
                        {PILLAR_META[p].label}
                      </p>
                      <p
                        className="text-[11px] font-medium"
                        style={{
                          color: v == null ? "var(--text-4)" : C[p],
                        }}
                      >
                        {v == null ? "—" : `${Math.round(v)}%`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Week */}
        <div className="anim-rise d5">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="t-section text-[var(--text-1)]">Last 7 Days</h2>
            <Link
              href="/progress"
              className="t-caption text-[var(--readiness)]"
            >
              All trends →
            </Link>
          </div>
          <Card pad="p-5">
            {hasWeek ? (
              <>
                <div className="mb-5 flex items-baseline gap-2">
                  <span
                    className="text-[28px] font-bold tracking-tight text-[var(--text-1)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {weekAvg}
                  </span>
                  <span className="t-caption">avg score</span>
                </div>
                <BarWeek data={weekly} />
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="t-caption">
                  Your weekly rhythm will appear here once you log a few days.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Sheet
        open={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        title="How readiness is calculated"
      >
        <p className="t-body mb-5 leading-relaxed">
          Readiness is a weighted blend of only the inputs you logged today —
          nothing is assumed or filled in.
        </p>
        <div className="space-y-3">
          {breakdown.map((p) => (
            <div key={p.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="t-label text-[var(--text-1)]">
                  {p.label}
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-2)]">
                  {Math.round(p.value)} · {Math.round(p.weight * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, p.weight * 100)}%`,
                    background: "var(--readiness)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="t-caption mt-5 leading-relaxed">
          Weights rebalance to the inputs present, so logging more makes the
          score more complete and accurate.
        </p>
      </Sheet>
    </Shell>
  );
}
