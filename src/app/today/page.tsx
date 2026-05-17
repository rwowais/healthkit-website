"use client";

import { useMemo } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { getTodayLog } from "@/lib/storage";
import { calculateStreak } from "@/lib/scoring";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import { RingScore, MiniRing } from "@/components/ui/Ring";
import { BarWeek } from "@/components/ui/Charts";
import {
  Card,
  Eyebrow,
  Skeleton,
  scoreColor,
  scoreWord,
} from "@/components/ui";
import type { DailyLog } from "@/lib/types";

const PILLAR_COLOR: Record<string, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
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

  const pillarScores = log.pillarScores ?? {
    sleep: 0,
    exercise: 0,
    nutrition: 0,
    supplements: 0,
  };

  // Composite readiness — calm derived metric
  const readiness = useMemo(() => {
    const sleepPart = pillarScores.sleep * 0.32;
    const adherencePart = log.score * 0.4;
    const energyPart = ((log.energyLevel ?? 3) / 5) * 100 * 0.18;
    const moodPart = ((log.moodLevel ?? 3) / 5) * 100 * 0.1;
    return Math.round(
      Math.min(100, sleepPart + adherencePart + energyPart + moodPart)
    );
  }, [log, pillarScores]);

  const recovery = useMemo(() => {
    const e = ((log.energyLevel ?? 3) / 5) * 100;
    const m = ((log.moodLevel ?? 3) / 5) * 100;
    const s = pillarScores.sleep || 50;
    return Math.round(e * 0.4 + m * 0.25 + s * 0.35);
  }, [log, pillarScores]);

  const weekly = useMemo(() => last7(state.dailyLogs), [state.dailyLogs]);
  const weekAvg = useMemo(() => {
    const vals = weekly.map((w) => w.value).filter((v) => v > 0);
    return vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0;
  }, [weekly]);

  const insight = useMemo(() => {
    if (streak >= 7)
      return `You're on a ${streak}-day streak. Sustained consistency is the single strongest lever for healthspan — keep the momentum.`;
    if (pillarScores.sleep > 0 && pillarScores.sleep < 50)
      return "Sleep adherence is your biggest opportunity today. Protecting your wind-down window compounds across every other system.";
    if (readiness >= 75)
      return "Your body is primed. This is a good day to push training intensity and lean into demanding work.";
    if (readiness < 45 && readiness > 0)
      return "Readiness is lower than usual. Favor recovery — light movement, hydration, and an earlier night.";
    return "Track today's protocols to build the signal. Patterns and personalized guidance emerge within your first week.";
  }, [streak, readiness, pillarScores.sleep]);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-6 w-44" rounded="rounded-full" />
          <Skeleton className="mx-auto h-[220px] w-[220px]" rounded="rounded-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        {/* Greeting */}
        <div className="anim-rise">
          <Eyebrow>{today.displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {greeting()}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
        </div>

        {/* Readiness hero */}
        <div className="anim-rise d1 flex flex-col items-center pt-2">
          <RingScore
            value={readiness}
            label={scoreWord(readiness)}
            sublabel="Readiness"
            color={scoreColor(readiness)}
          />
          <div className="mt-6 flex items-center gap-2.5">
            {streak > 0 ? (
              <div className="flex items-center gap-2 rounded-[var(--r-pill)] bg-[var(--warm-soft)] px-4 py-2">
                <span className="text-[15px]">✦</span>
                <span className="text-[13px] font-semibold text-[var(--warm)]">
                  {streak}-day streak
                </span>
              </div>
            ) : (
              <span className="t-caption">Begin your streak today</span>
            )}
          </div>
        </div>

        {/* Sleep · Recovery · Adherence */}
        <div className="anim-rise d2 grid grid-cols-3 gap-3">
          {[
            {
              k: "Sleep",
              v: pillarScores.sleep,
              c: "var(--sleep)",
              href: "/sleep",
            },
            {
              k: "Recovery",
              v: recovery,
              c: "var(--recovery)",
              href: "/recovery",
            },
            {
              k: "Adherence",
              v: log.score,
              c: "var(--vitality)",
              href: "/track",
            },
          ].map((m) => (
            <Link key={m.k} href={m.href}>
              <Card pad="p-4" className="h-full">
                <p className="t-eyebrow">{m.k}</p>
                <p
                  className="mt-3 text-[30px] font-bold tracking-tight"
                  style={{
                    color: m.c,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(m.v)}
                </p>
                <p className="t-caption mt-0.5">{scoreWord(m.v)}</p>
              </Card>
            </Link>
          ))}
        </div>

        {/* Today's focus */}
        <Card className="anim-rise d3 relative overflow-hidden">
          <div
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

        {/* Protocol adherence rings */}
        <div className="anim-rise d4">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="t-section text-[var(--text-1)]">Protocols</h2>
            <Link
              href="/track"
              className="t-caption text-[var(--readiness)]"
            >
              Open tracker →
            </Link>
          </div>
          <Card pad="p-5">
            <div className="flex justify-between">
              {PILLARS.map((p) => (
                <Link
                  key={p}
                  href="/track"
                  className="press flex flex-col items-center gap-2.5"
                >
                  <MiniRing
                    value={pillarScores[p]}
                    color={PILLAR_COLOR[p]}
                    icon={PILLAR_META[p].icon}
                  />
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-[var(--text-1)]">
                      {PILLAR_META[p].label}
                    </p>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: PILLAR_COLOR[p] }}
                    >
                      {Math.round(pillarScores[p])}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* 7-day trend */}
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
          </Card>
        </div>
      </div>
    </Shell>
  );
}
