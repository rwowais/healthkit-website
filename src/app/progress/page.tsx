"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { protocols, categoryInfo } from "@/lib/protocols";
import { loadRoutine, getStreakDays } from "@/lib/storage";
import type { UserRoutine } from "@/lib/types";

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function ProgressPage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  if (!routine) return null;

  if (routine.selectedProtocols.length === 0) {
    return (
      <Shell>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">{"\uD83D\uDCCA"}</div>
          <h1 className="text-[19px] font-semibold text-[#1d1d1f] mb-2">
            No Data Yet
          </h1>
          <p className="text-[15px] text-[#86868b] mb-6 max-w-md mx-auto">
            Start tracking your protocols to see your progress here.
          </p>
          <Link
            href="/protocols"
            className="inline-flex items-center gap-2 bg-[#0071e3] hover:bg-[#0077ed] text-white px-6 py-3 rounded-full text-[13px] font-semibold transition-apple"
          >
            Browse Protocols
          </Link>
        </div>
      </Shell>
    );
  }

  const streak = getStreakDays(routine);
  const last7 = getLast7Days();
  const last30 = getLast30Days();

  // Weekly completion data
  const weeklyData = last7.map((date) => {
    const log = routine.dailyLogs.find((l) => l.date === date);
    const dayIndex = new Date(date + "T12:00:00").getDay();
    const adjDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const scheduledProtocols = routine.selectedProtocols.filter(
      (sp) => sp.weeklySchedule[adjDayIndex]
    );
    const scheduled = scheduledProtocols.length;
    const scheduledIds = scheduledProtocols.map((sp) => sp.protocolId);
    const completed = log?.completedProtocols.filter((id) => scheduledIds.includes(id)).length ?? 0;
    return {
      date,
      day: shortDay(date),
      scheduled,
      completed,
      pct: scheduled > 0 ? Math.min(100, Math.round((completed / scheduled) * 100)) : 0,
    };
  });

  // 30-day heatmap data
  const heatmapData = last30.map((date) => {
    const log = routine.dailyLogs.find((l) => l.date === date);
    const dayIndex = new Date(date + "T12:00:00").getDay();
    const adjDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const scheduledProtocols = routine.selectedProtocols.filter(
      (sp) => sp.weeklySchedule[adjDayIndex]
    );
    const scheduled = scheduledProtocols.length;
    const scheduledIds = scheduledProtocols.map((sp) => sp.protocolId);
    const completed = log?.completedProtocols.filter((id) => scheduledIds.includes(id)).length ?? 0;
    const pct = scheduled > 0 ? Math.min(1, completed / scheduled) : 0;
    return { date, pct };
  });

  // Per-protocol adherence
  const protocolStats = routine.selectedProtocols
    .map((sp) => {
      const protocol = protocols.find((p) => p.id === sp.protocolId);
      if (!protocol) return null;
      let scheduledDays = 0;
      let completedDays = 0;
      last30.forEach((date) => {
        const dayIndex = new Date(date + "T12:00:00").getDay();
        const adjDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        if (sp.weeklySchedule[adjDayIndex]) {
          scheduledDays++;
          const log = routine.dailyLogs.find((l) => l.date === date);
          if (log?.completedProtocols.includes(sp.protocolId)) {
            completedDays++;
          }
        }
      });
      return {
        protocol,
        scheduledDays,
        completedDays,
        pct:
          scheduledDays > 0
            ? Math.round((completedDays / scheduledDays) * 100)
            : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.pct - a!.pct) as {
    protocol: (typeof protocols)[0];
    scheduledDays: number;
    completedDays: number;
    pct: number;
  }[];

  // Mood, energy, sleep averages
  const recentLogs = routine.dailyLogs
    .filter((l) => last7.includes(l.date))
    .filter((l) => l.mood > 0 || l.energy > 0);
  const avgMood =
    recentLogs.length > 0
      ? (
          recentLogs.reduce((s, l) => s + l.mood, 0) / recentLogs.length
        ).toFixed(1)
      : "\u2014";
  const avgEnergy =
    recentLogs.length > 0
      ? (
          recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length
        ).toFixed(1)
      : "\u2014";
  const sleepLogs = recentLogs.filter((l) => l.sleepHours > 0);
  const avgSleep =
    sleepLogs.length > 0
      ? (
          sleepLogs.reduce((s, l) => s + l.sleepHours, 0) / sleepLogs.length
        ).toFixed(1)
      : "\u2014";

  return (
    <Shell>
      <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-8">
        Progress
      </h1>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[28px] font-bold text-[#0071e3]">{streak}</p>
          <p className="text-[11px] text-[#86868b] font-medium uppercase tracking-wide mt-1">
            Day Streak
          </p>
        </div>
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[28px] font-bold text-[#30d158]">
            {routine.selectedProtocols.length}
          </p>
          <p className="text-[11px] text-[#86868b] font-medium uppercase tracking-wide mt-1">
            Active
          </p>
        </div>
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[28px] font-bold text-[#ff9f0a]">{avgMood}</p>
          <p className="text-[11px] text-[#86868b] font-medium uppercase tracking-wide mt-1">
            Avg Mood
          </p>
        </div>
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[28px] font-bold text-[#ff453a]">{avgEnergy}</p>
          <p className="text-[11px] text-[#86868b] font-medium uppercase tracking-wide mt-1">
            Avg Energy
          </p>
        </div>
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-[28px] font-bold text-[#5e5ce6]">{avgSleep}</p>
          <p className="text-[11px] text-[#86868b] font-medium uppercase tracking-wide mt-1">
            Avg Sleep
          </p>
        </div>
      </div>

      {/* 7-Day Completion Bar Chart */}
      <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f] mb-4">
          Last 7 Days
        </h2>
        <div className="flex items-end gap-2 h-32">
          {weeklyData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center">
              <div className="w-full relative h-24 flex items-end">
                <div
                  className="w-full rounded-t-lg transition-all duration-300"
                  style={{
                    height: `${Math.max(d.pct, 4)}%`,
                    backgroundColor:
                      d.pct === 100
                        ? "#30d158"
                        : d.pct > 50
                          ? "#0071e3"
                          : d.pct > 0
                            ? "#ff9f0a"
                            : "#f5f5f7",
                  }}
                />
              </div>
              <span className="text-[10px] text-[#86868b] mt-1">{d.day}</span>
              <span className="text-[10px] text-[#86868b]">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-Day Heatmap */}
      <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f] mb-4">
          30-Day Heatmap
        </h2>
        <div className="grid grid-cols-10 gap-1.5">
          {heatmapData.map((d) => (
            <div
              key={d.date}
              className="aspect-square rounded-md transition-all"
              style={{
                backgroundColor:
                  d.pct === 0
                    ? "#f5f5f7"
                    : d.pct < 0.33
                      ? "#0071e333"
                      : d.pct < 0.66
                        ? "#0071e377"
                        : d.pct < 1
                          ? "#0071e3bb"
                          : "#30d158",
              }}
              title={`${d.date}: ${Math.round(d.pct * 100)}%`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-[#86868b]">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-[#f5f5f7]" />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0071e333" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0071e377" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0071e3bb" }} />
          <div className="w-3 h-3 rounded-sm bg-[#30d158]" />
          <span>More</span>
        </div>
      </div>

      {/* Per-Protocol Adherence */}
      <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f] mb-4">
          Protocol Adherence (30 days)
        </h2>
        <div className="space-y-3">
          {protocolStats.map((ps) => {
            const catColor = categoryInfo[ps.protocol.category].color;
            return (
              <div key={ps.protocol.id}>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                    <span className="text-[#1d1d1f] truncate">
                      {ps.protocol.name}
                    </span>
                  </div>
                  <span
                    className={`text-[12px] font-semibold shrink-0 ml-2 ${
                      ps.pct >= 80
                        ? "text-[#30d158]"
                        : ps.pct >= 50
                          ? "text-[#ff9f0a]"
                          : "text-[#ff453a]"
                    }`}
                  >
                    {ps.pct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ps.pct}%`,
                      backgroundColor:
                        ps.pct >= 80
                          ? "#30d158"
                          : ps.pct >= 50
                            ? "#ff9f0a"
                            : "#ff453a",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
