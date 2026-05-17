"use client";

import { useMemo } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import type { Pillar } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────

function getDateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDateString(d));
  }
  return days;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDateString(d));
  }
  return days;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ── Stat Card ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
      <span className="text-[20px]">{icon}</span>
      <p
        className="text-[22px] font-bold mt-1"
        style={{ color: color || "#1d1d1f" }}
      >
        {value}
      </p>
      <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ProgressPage() {
  const { state, loading } = useAppState();

  const stats = useMemo(() => {
    const logs = state.dailyLogs;
    const last7 = getLast7Days();
    const last30 = getLast30Days();

    // Streak
    const streak = state.currentStreak;

    // Average score (last 7 days)
    const last7Logs = logs.filter((l) => last7.includes(l.date));
    const avgScore =
      last7Logs.length > 0
        ? Math.round(
            last7Logs.reduce((sum, l) => sum + l.score, 0) / last7Logs.length
          )
        : 0;

    // Average mood & energy (last 7)
    const moodLogs = last7Logs.filter((l) => l.moodLevel !== null);
    const energyLogs = last7Logs.filter((l) => l.energyLevel !== null);
    const avgMood =
      moodLogs.length > 0
        ? (
            moodLogs.reduce((s, l) => s + (l.moodLevel || 0), 0) /
            moodLogs.length
          ).toFixed(1)
        : "—";
    const avgEnergy =
      energyLogs.length > 0
        ? (
            energyLogs.reduce((s, l) => s + (l.energyLevel || 0), 0) /
            energyLogs.length
          ).toFixed(1)
        : "—";

    // 7-day scores for bar chart
    const weekScores = last7.map((date) => {
      const log = logs.find((l) => l.date === date);
      return {
        date,
        dayLabel: getDayLabel(date),
        score: log?.score ?? 0,
        hasLog: !!log,
      };
    });

    // 30-day heatmap data
    const monthData = last30.map((date) => {
      const log = logs.find((l) => l.date === date);
      return {
        date,
        score: log?.score ?? 0,
        hasLog: !!log,
      };
    });

    // Per-pillar adherence (last 30 days)
    const pillarAdherence = PILLARS.map((pillar: Pillar) => {
      const pillarItems = state.protocols[pillar].filter((i) => i.isEnabled);
      if (pillarItems.length === 0)
        return { pillar, percentage: 0, label: PILLAR_META[pillar].label };

      const pillarItemIds = new Set(pillarItems.map((i) => i.id));
      const last30Logs = logs.filter((l) => last30.includes(l.date));

      let totalPossible = 0;
      let totalCompleted = 0;

      for (const log of last30Logs) {
        const relevant = log.completions.filter((c) =>
          pillarItemIds.has(c.itemId)
        );
        totalPossible += relevant.length;
        totalCompleted += relevant.filter((c) => c.completedAt !== null).length;
      }

      const percentage =
        totalPossible > 0
          ? Math.round((totalCompleted / totalPossible) * 100)
          : 0;

      return { pillar, percentage, label: PILLAR_META[pillar].label };
    });

    // Total enabled protocols
    const totalEnabled = PILLARS.reduce(
      (sum, p) => sum + state.protocols[p].filter((i) => i.isEnabled).length,
      0
    );

    return {
      streak,
      avgScore,
      avgMood,
      avgEnergy,
      weekScores,
      monthData,
      pillarAdherence,
      totalEnabled,
    };
  }, [state]);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6 animate-pulse">
          <div className="h-9 w-40 bg-[#f5f5f7] rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-[#f5f5f7] rounded-2xl" />
            ))}
          </div>
          <div className="h-48 bg-[#f5f5f7] rounded-2xl" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8 pb-4">
        {/* Header */}
        <div>
          <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
            Progress
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            Your health protocol analytics
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Day Streak"
            value={stats.streak}
            icon="🔥"
            color={stats.streak > 0 ? "#ff9f0a" : "#86868b"}
          />
          <StatCard label="Avg Score" value={stats.avgScore} icon="📊" color="#0071e3" />
          <StatCard label="Avg Mood" value={stats.avgMood} icon="😊" />
          <StatCard label="Avg Energy" value={stats.avgEnergy} icon="⚡" />
        </div>

        {/* 7-Day Bar Chart */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-4">
            Last 7 Days
          </p>
          <div className="flex items-end gap-2 h-32">
            {stats.weekScores.map((day) => {
              const heightPct = Math.max(day.score, 2);
              const barColor =
                day.score >= 80
                  ? "#30d158"
                  : day.score >= 50
                  ? "#0071e3"
                  : day.score > 0
                  ? "#ff9f0a"
                  : "#e5e5ea";
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-semibold text-[#1d1d1f]">
                    {day.score > 0 ? day.score : ""}
                  </span>
                  <div className="w-full relative" style={{ height: "100px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-lg transition-all duration-500"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[#86868b]">
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 30-Day Heatmap */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-4">
            30-Day Overview
          </p>
          <div className="grid grid-cols-10 gap-1.5">
            {stats.monthData.map((day) => {
              const intensity =
                day.score >= 80
                  ? 3
                  : day.score >= 50
                  ? 2
                  : day.score > 0
                  ? 1
                  : 0;
              const colors = [
                "#f5f5f7",
                "rgba(0, 113, 227, 0.2)",
                "rgba(0, 113, 227, 0.45)",
                "rgba(0, 113, 227, 0.75)",
              ];
              return (
                <div
                  key={day.date}
                  className="aspect-square rounded-[4px] transition-apple"
                  style={{ backgroundColor: colors[intensity] }}
                  title={`${day.date}: ${day.score}%`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <span className="text-[10px] text-[#86868b]">Less</span>
            {["#f5f5f7", "rgba(0,113,227,0.2)", "rgba(0,113,227,0.45)", "rgba(0,113,227,0.75)"].map(
              (c, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: c }}
                />
              )
            )}
            <span className="text-[10px] text-[#86868b]">More</span>
          </div>
        </div>

        {/* Per-Pillar Adherence */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-4">
            Pillar Adherence (30 days)
          </p>
          <div className="space-y-4">
            {stats.pillarAdherence.map((p) => {
              const meta = PILLAR_META[p.pillar];
              const barColor =
                p.percentage >= 80
                  ? "#30d158"
                  : p.percentage >= 50
                  ? "#ff9f0a"
                  : "#ff3b30";
              return (
                <div key={p.pillar}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">{meta.icon}</span>
                      <span className="text-[13px] font-medium text-[#1d1d1f]">
                        {p.label}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold" style={{ color: barColor }}>
                      {p.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${p.percentage}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,113,227,0.1)] flex items-center justify-center text-[18px]">
              📋
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1d1d1f]">
                Protocol Summary
              </p>
              <p className="text-[12px] text-[#86868b]">
                {stats.totalEnabled} active items across {PILLARS.length} pillars
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
