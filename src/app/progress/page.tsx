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
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-bold mb-3">No Data Yet</h1>
          <p className="text-[#6b6b80] mb-6 max-w-md mx-auto">
            Start tracking your protocols to see your progress here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all"
          >
            📋 Browse Protocols
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
    const scheduled = routine.selectedProtocols.filter(
      (sp) => sp.weeklySchedule[adjDayIndex]
    ).length;
    const completed = log?.completedProtocols.length ?? 0;
    return {
      date,
      day: shortDay(date),
      scheduled,
      completed,
      pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    };
  });

  // 30-day heatmap data
  const heatmapData = last30.map((date) => {
    const log = routine.dailyLogs.find((l) => l.date === date);
    const dayIndex = new Date(date + "T12:00:00").getDay();
    const adjDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const scheduled = routine.selectedProtocols.filter(
      (sp) => sp.weeklySchedule[adjDayIndex]
    ).length;
    const completed = log?.completedProtocols.length ?? 0;
    const pct = scheduled > 0 ? completed / scheduled : 0;
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

  // Mood & energy averages
  const recentLogs = routine.dailyLogs
    .filter((l) => last7.includes(l.date))
    .filter((l) => l.mood > 0 || l.energy > 0);
  const avgMood =
    recentLogs.length > 0
      ? (
          recentLogs.reduce((s, l) => s + l.mood, 0) / recentLogs.length
        ).toFixed(1)
      : "—";
  const avgEnergy =
    recentLogs.length > 0
      ? (
          recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length
        ).toFixed(1)
      : "—";
  const avgSleep =
    recentLogs.filter((l) => l.sleepHours > 0).length > 0
      ? (
          recentLogs
            .filter((l) => l.sleepHours > 0)
            .reduce((s, l) => s + l.sleepHours, 0) /
          recentLogs.filter((l) => l.sleepHours > 0).length
        ).toFixed(1)
      : "—";

  return (
    <Shell>
      <h1 className="text-3xl font-bold mb-8">Progress</h1>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-400">{streak}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Day Streak</p>
        </div>
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-400">
            {routine.selectedProtocols.length}
          </p>
          <p className="text-xs text-[#6b6b80] mt-1">Active Protocols</p>
        </div>
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-400">{avgMood}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Avg Mood (7d)</p>
        </div>
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{avgEnergy}</p>
          <p className="text-xs text-[#6b6b80] mt-1">Avg Energy (7d)</p>
        </div>
      </div>

      {/* Weekly Bar Chart */}
      <div className="bg-[#12121a] rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold mb-4">Last 7 Days</h2>
        <div className="flex items-end gap-2 h-32">
          {weeklyData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center">
              <div className="w-full relative h-24 flex items-end">
                <div
                  className="w-full rounded-t-md transition-all duration-300"
                  style={{
                    height: `${Math.max(d.pct, 4)}%`,
                    backgroundColor:
                      d.pct === 100
                        ? "#4ade80"
                        : d.pct > 50
                          ? "#818cf8"
                          : d.pct > 0
                            ? "#fbbf24"
                            : "#2a2a3a",
                  }}
                />
              </div>
              <span className="text-[10px] text-[#6b6b80] mt-1">{d.day}</span>
              <span className="text-[10px] text-[#6b6b80]">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-Day Heatmap */}
      <div className="bg-[#12121a] rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold mb-4">30-Day Heatmap</h2>
        <div className="grid grid-cols-10 gap-1.5">
          {heatmapData.map((d) => (
            <div
              key={d.date}
              className="aspect-square rounded-sm transition-all"
              style={{
                backgroundColor:
                  d.pct === 0
                    ? "#1a1a25"
                    : d.pct < 0.33
                      ? "#4338ca33"
                      : d.pct < 0.66
                        ? "#4338ca77"
                        : d.pct < 1
                          ? "#4338cabb"
                          : "#4ade80",
              }}
              title={`${d.date}: ${Math.round(d.pct * 100)}%`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-[#6b6b80]">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-[#1a1a25]" />
          <div className="w-3 h-3 rounded-sm bg-[#4338ca33]" />
          <div className="w-3 h-3 rounded-sm bg-[#4338ca77]" />
          <div className="w-3 h-3 rounded-sm bg-[#4338cabb]" />
          <div className="w-3 h-3 rounded-sm bg-[#4ade80]" />
          <span>More</span>
        </div>
      </div>

      {/* Avg Sleep */}
      <div className="bg-[#12121a] rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold mb-2">Average Sleep (7d)</h2>
        <p className="text-3xl font-bold text-indigo-400">
          {avgSleep}{" "}
          <span className="text-sm font-normal text-[#6b6b80]">hours</span>
        </p>
      </div>

      {/* Per-Protocol Adherence */}
      <div className="bg-[#12121a] rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold mb-4">
          Protocol Adherence (30 days)
        </h2>
        <div className="space-y-3">
          {protocolStats.map((ps) => (
            <div key={ps.protocol.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span>{categoryInfo[ps.protocol.category].icon}</span>
                  <span className="text-white">{ps.protocol.name}</span>
                </div>
                <span
                  className={`text-xs font-medium ${
                    ps.pct >= 80
                      ? "text-emerald-400"
                      : ps.pct >= 50
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {ps.pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${ps.pct}%`,
                    backgroundColor:
                      ps.pct >= 80
                        ? "#4ade80"
                        : ps.pct >= 50
                          ? "#fbbf24"
                          : "#f87171",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-20 md:hidden" />
    </Shell>
  );
}
