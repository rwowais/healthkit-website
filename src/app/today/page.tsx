"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { useToday } from "@/hooks/useToday";
import { getTodayLog } from "@/lib/storage";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import { calculateStreak } from "@/lib/scoring";
import type { DailyLog, Pillar } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(formatDateKey(d));
  }
  return days;
}

function getLogForDate(logs: DailyLog[], date: string): DailyLog | undefined {
  return logs.find((l) => l.date === date);
}

// ── Score Ring Component ────────────────────────────────────────

function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  const offset = circumference * (1 - progress);

  let color = "#0071e3";
  if (score >= 90) color = "#30d158";
  else if (score >= 60) color = "#0071e3";
  else if (score >= 30) color = "#ff9f0a";
  else if (score > 0) color = "#ff453a";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f5f5f7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-score-ring"
          style={
            {
              "--ring-circumference": circumference,
              "--ring-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[32px] font-bold leading-none"
          style={{ color: score > 0 ? color : "#1d1d1f" }}
        >
          {score}
        </span>
        <span className="text-[11px] text-[#86868b] -mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ── Mini Pillar Ring ────────────────────────────────────────────

function PillarRing({
  pillar,
  score,
}: {
  pillar: Pillar;
  score: number;
}) {
  const meta = PILLAR_META[pillar];
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 100, 1);
  const offset = circumference * (1 - progress);

  return (
    <Link
      href="/track"
      className="flex flex-col items-center gap-1.5 transition-apple hover:scale-105 active:scale-95"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={meta.color + "15"}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={meta.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="animate-score-ring"
            style={
              {
                "--ring-circumference": circumference,
                "--ring-offset": offset,
              } as React.CSSProperties
            }
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[18px]">
          {meta.icon}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-[#1d1d1f]">{meta.label}</p>
        <p className="text-[10px] font-medium" style={{ color: meta.color }}>
          {score}%
        </p>
      </div>
    </Link>
  );
}

// ── Weekly Bar Chart ────────────────────────────────────────────

function WeeklyChart({ logs }: { logs: DailyLog[] }) {
  const days = getLast7Days();
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="flex items-end justify-between gap-2 h-24 px-1">
      {days.map((date, i) => {
        const log = getLogForDate(logs, date);
        const score = log?.score ?? 0;
        const isToday = i === 6;
        const barHeight = Math.max(4, (score / 100) * 80);

        let color = "#e5e5ea";
        if (score >= 80) color = "#30d158";
        else if (score >= 50) color = "#0071e3";
        else if (score > 0) color = "#ff9f0a";

        return (
          <div key={date} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-t-md transition-apple"
              style={{
                height: `${barHeight}px`,
                backgroundColor: color,
                opacity: isToday ? 1 : 0.7,
              }}
            />
            <span
              className={`text-[10px] font-medium ${
                isToday ? "text-[#0071e3]" : "text-[#86868b]"
              }`}
            >
              {dayLabels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[16px]">{icon}</span>
        <span className="text-[11px] text-[#86868b] font-medium">{label}</span>
      </div>
      <p className="text-[24px] font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ── Insight Generator ───────────────────────────────────────────

function generateInsight(logs: DailyLog[], streak: number, todayLog: DailyLog): string {
  const last7 = logs
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  if (last7.length < 2) {
    return "Start tracking your protocols to unlock personalized insights about your routine patterns.";
  }

  // Check which pillar is strongest
  const pillarAvgs: Record<Pillar, number> = {
    sleep: 0,
    exercise: 0,
    nutrition: 0,
    supplements: 0,
  };
  for (const p of PILLARS) {
    const scores = last7
      .map((l) => l.pillarScores?.[p] ?? 0)
      .filter((s) => s > 0);
    pillarAvgs[p] = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }
  const bestPillar = PILLARS.reduce((a, b) =>
    pillarAvgs[a] >= pillarAvgs[b] ? a : b
  );
  const worstPillar = PILLARS.reduce((a, b) =>
    pillarAvgs[a] <= pillarAvgs[b] && pillarAvgs[a] > 0 ? a : b
  );

  if (streak >= 7) {
    return `${streak}-day streak! Your ${PILLAR_META[bestPillar].label.toLowerCase()} protocols are the strongest at ${Math.round(pillarAvgs[bestPillar])}% average adherence.`;
  }

  if (pillarAvgs[worstPillar] > 0 && pillarAvgs[worstPillar] < 50) {
    return `Your ${PILLAR_META[worstPillar].label.toLowerCase()} could use attention — only ${Math.round(pillarAvgs[worstPillar])}% adherence this week. Small improvements compound.`;
  }

  const avgScore = last7.reduce((s, l) => s + l.score, 0) / last7.length;
  if (avgScore >= 70) {
    return `Averaging ${Math.round(avgScore)} points this week. That consistency drives real physiological adaptation over time.`;
  }

  if (todayLog.score === 0) {
    return "Start your day by opening the tracker. Mornings set the tone for the rest of the day.";
  }

  return "Keep tracking consistently — patterns emerge after your first full week.";
}

// ── Main Page ───────────────────────────────────────────────────

export default function TodayPage() {
  const { state, loading, updateSleepLog, updateRatings } = useAppState();
  const today = useToday();

  const todayLog = useMemo(() => getTodayLog(state), [state]);

  const streak = useMemo(
    () => calculateStreak(state.dailyLogs),
    [state.dailyLogs]
  );

  const pillarScores = useMemo(() => {
    return todayLog.pillarScores || {
      sleep: 0,
      exercise: 0,
      nutrition: 0,
      supplements: 0,
    };
  }, [todayLog]);

  const weeklyAvg = useMemo(() => {
    const days = getLast7Days();
    const scores = days
      .map((d) => getLogForDate(state.dailyLogs, d)?.score ?? 0)
      .filter((s) => s > 0);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [state.dailyLogs]);

  const enabledCount = useMemo(() => {
    return PILLARS.reduce(
      (sum, p) => sum + state.protocols[p].filter((i) => i.isEnabled).length,
      0
    );
  }, [state.protocols]);

  const insight = useMemo(
    () => generateInsight(state.dailyLogs, streak, todayLog),
    [state.dailyLogs, streak, todayLog]
  );

  // Sleep duration helper
  const sleepDuration = useMemo(() => {
    const { actualBedtime, actualWakeTime } = todayLog.sleepLog;
    if (!actualBedtime || !actualWakeTime) return null;
    const [bH, bM] = actualBedtime.split(":").map(Number);
    const [wH, wM] = actualWakeTime.split(":").map(Number);
    let mins = (wH * 60 + wM) - (bH * 60 + bM);
    if (mins <= 0) mins += 1440;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }, [todayLog.sleepLog]);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 py-8 animate-pulse">
          <div className="h-5 w-48 bg-[#f5f5f7] rounded-lg" />
          <div className="w-[120px] h-[120px] rounded-full bg-[#f5f5f7]" />
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-14 h-14 rounded-full bg-[#f5f5f7]" />
            ))}
          </div>
          <div className="w-full h-32 bg-[#f5f5f7] rounded-2xl" />
          <div className="w-full h-24 bg-[#f5f5f7] rounded-2xl" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5 pb-4">
        {/* ── Greeting ──────────────────────────────────────────── */}
        <div className="pt-2">
          <p className="text-[13px] font-medium text-[#86868b]">
            {today.displayDate}
          </p>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">
            {getGreeting()}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
        </div>

        {/* ── Today's Score + Streak ──────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <ScoreRing score={todayLog.score} />
            <div>
              <p className="text-[13px] text-[#86868b] font-medium">
                Today&apos;s Score
              </p>
              {streak > 0 ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[20px]">🔥</span>
                  <span className="text-[17px] font-bold text-[#ff9f0a]">
                    {streak} day{streak !== 1 ? "s" : ""}
                  </span>
                </div>
              ) : (
                <p className="text-[13px] text-[#86868b] mt-1">
                  Start your streak!
                </p>
              )}
            </div>
          </div>

          {/* Quick action */}
          <Link
            href="/track"
            className="bg-[#0071e3] hover:bg-[#0077ed] text-white px-5 py-2.5 rounded-full text-[13px] font-semibold transition-apple active:scale-95"
          >
            Track
          </Link>
        </div>

        {/* ── Pillar Rings ────────────────────────────────────── */}
        <div className="flex justify-between px-2">
          {PILLARS.map((pillar) => (
            <PillarRing
              key={pillar}
              pillar={pillar}
              score={pillarScores[pillar]}
            />
          ))}
        </div>

        {/* ── Quick Wellness Check ────────────────────────────── */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-3">
            How are you feeling?
          </p>
          <div className="flex gap-3">
            {/* Energy */}
            <div className="flex-1">
              <p className="text-[11px] text-[#86868b] mb-1.5 text-center">Energy</p>
              <div className="flex justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      updateRatings(todayLog.date, { energy: level })
                    }
                    className="text-[16px] transition-apple hover:scale-110 active:scale-95 p-0.5"
                    style={{
                      opacity:
                        todayLog.energyLevel !== null &&
                        level <= todayLog.energyLevel
                          ? 1
                          : 0.25,
                      filter:
                        todayLog.energyLevel !== null &&
                        level <= todayLog.energyLevel
                          ? "none"
                          : "grayscale(1)",
                    }}
                  >
                    ⚡
                  </button>
                ))}
              </div>
            </div>
            {/* Mood */}
            <div className="flex-1">
              <p className="text-[11px] text-[#86868b] mb-1.5 text-center">Mood</p>
              <div className="flex justify-center gap-0.5">
                {["😞", "😕", "😐", "🙂", "😊"].map((face, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      updateRatings(todayLog.date, { mood: i + 1 })
                    }
                    className="text-[16px] transition-apple hover:scale-110 active:scale-95 p-0.5"
                    style={{
                      opacity:
                        todayLog.moodLevel !== null &&
                        i + 1 <= todayLog.moodLevel
                          ? 1
                          : 0.25,
                      filter:
                        todayLog.moodLevel !== null &&
                        i + 1 <= todayLog.moodLevel
                          ? "none"
                          : "grayscale(1)",
                    }}
                  >
                    {face}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sleep data quick entry */}
          {sleepDuration && (
            <div className="mt-3 flex items-center gap-2 bg-[#5e5ce6]/5 rounded-lg px-3 py-2">
              <span className="text-[13px]">🌙</span>
              <span className="text-[13px] font-medium text-[#5e5ce6]">
                Slept {sleepDuration}
              </span>
            </div>
          )}
          {!sleepDuration && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-[#86868b] font-medium block mb-0.5">
                  Bedtime
                </label>
                <input
                  type="time"
                  value={todayLog.sleepLog.actualBedtime ?? ""}
                  onChange={(e) =>
                    updateSleepLog(todayLog.date, {
                      actualBedtime: e.target.value || null,
                    })
                  }
                  className="w-full bg-white border border-[#d2d2d7]/30 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]/40 transition-apple"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#86868b] font-medium block mb-0.5">
                  Wake time
                </label>
                <input
                  type="time"
                  value={todayLog.sleepLog.actualWakeTime ?? ""}
                  onChange={(e) =>
                    updateSleepLog(todayLog.date, {
                      actualWakeTime: e.target.value || null,
                    })
                  }
                  className="w-full bg-white border border-[#d2d2d7]/30 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3]/40 transition-apple"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Stats Row ───────────────────────────────────────── */}
        <div className="flex gap-3">
          <StatCard
            label="Weekly Avg"
            value={`${weeklyAvg}`}
            icon="📊"
            color={weeklyAvg >= 70 ? "#30d158" : weeklyAvg >= 40 ? "#0071e3" : "#86868b"}
          />
          <StatCard
            label="Protocols"
            value={`${enabledCount}`}
            icon="🧬"
            color="#0071e3"
          />
        </div>

        {/* ── Weekly Chart ────────────────────────────────────── */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
              This Week
            </p>
            <Link
              href="/progress"
              className="text-[11px] font-medium text-[#0071e3]"
            >
              See All →
            </Link>
          </div>
          <WeeklyChart logs={state.dailyLogs} />
        </div>

        {/* ── Insight Card ────────────────────────────────────── */}
        <div className="relative bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{
              background:
                "linear-gradient(180deg, #0071e3 0%, #5e5ce6 50%, #30d158 100%)",
            }}
          />
          <div className="pl-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                Insight
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z"
                  fill="#ff9f0a"
                  stroke="#ff9f0a"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
            <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
              {insight}
            </p>
          </div>
        </div>

        {/* ── Quick Links ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {PILLARS.map((pillar) => {
            const meta = PILLAR_META[pillar];
            const itemCount = state.protocols[pillar].filter(
              (i) => i.isEnabled
            ).length;
            return (
              <Link
                key={pillar}
                href={`/${pillar}`}
                className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 transition-apple hover:border-[#d2d2d7]/60 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[18px]">{meta.icon}</span>
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#86868b]">
                  {itemCount} protocol{itemCount !== 1 ? "s" : ""} active
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
