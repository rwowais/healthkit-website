"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { protocols, categoryInfo } from "@/lib/protocols";
import {
  loadRoutine,
  toggleDailyCompletion,
  updateDailyLog,
} from "@/lib/storage";
import type { UserRoutine } from "@/lib/types";

function getDateString(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Convert to Mon=0, Sun=6
}

export default function TrackerPage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [dateOffset, setDateOffset] = useState(0);

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  if (!routine) return null;

  const dateStr = getDateString(dateOffset);
  const dayIndex = getDayOfWeek(dateStr);
  const log = routine.dailyLogs.find((l) => l.date === dateStr);

  const todaysProtocols = routine.selectedProtocols
    .filter((sp) => sp.weeklySchedule[dayIndex])
    .map((sp) => ({
      ...sp,
      protocol: protocols.find((p) => p.id === sp.protocolId),
      completed: log?.completedProtocols.includes(sp.protocolId) ?? false,
    }))
    .filter((sp) => sp.protocol);

  const completedCount = todaysProtocols.filter((p) => p.completed).length;
  const totalCount = todaysProtocols.length;
  const completionPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  function handleToggle(protocolId: string) {
    const updated = toggleDailyCompletion(dateStr, protocolId);
    setRoutine({ ...updated });
  }

  function handleMoodChange(mood: number) {
    const updated = updateDailyLog(dateStr, { mood });
    setRoutine({ ...updated });
  }

  function handleEnergyChange(energy: number) {
    const updated = updateDailyLog(dateStr, { energy });
    setRoutine({ ...updated });
  }

  function handleSleepChange(sleepHours: number) {
    const updated = updateDailyLog(dateStr, { sleepHours });
    setRoutine({ ...updated });
  }

  if (routine.selectedProtocols.length === 0) {
    return (
      <Shell>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-3">Nothing to Track Yet</h1>
          <p className="text-[#6b6b80] mb-6 max-w-md mx-auto">
            Add protocols to your routine first, then come here to track your
            daily adherence.
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

  return (
    <Shell>
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setDateOffset((d) => d - 1)}
          className="p-2 rounded-lg hover:bg-white/10 text-[#6b6b80] hover:text-white transition-all"
        >
          ← Prev
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{formatDate(dateStr)}</h1>
          {dateOffset === 0 && (
            <span className="text-xs text-emerald-400">Today</span>
          )}
        </div>
        <button
          onClick={() => setDateOffset((d) => Math.min(d + 1, 0))}
          className={`p-2 rounded-lg transition-all ${
            dateOffset >= 0
              ? "text-[#2a2a3a] cursor-not-allowed"
              : "hover:bg-white/10 text-[#6b6b80] hover:text-white"
          }`}
          disabled={dateOffset >= 0}
        >
          Next →
        </button>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#2a2a3a"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={completionPct === 100 ? "#4ade80" : "#818cf8"}
              strokeWidth="8"
              strokeDasharray={`${(completionPct / 100) * 314} 314`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">
              {completedCount}/{totalCount}
            </span>
            <span className="text-xs text-[#6b6b80]">completed</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-xs text-[#6b6b80] mb-1">Mood</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleMoodChange(n)}
                className={`text-lg transition-all ${
                  (log?.mood ?? 0) >= n
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
              >
                {n <= 2 ? "😔" : n === 3 ? "😐" : "😊"}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-xs text-[#6b6b80] mb-1">Energy</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleEnergyChange(n)}
                className={`text-lg transition-all ${
                  (log?.energy ?? 0) >= n
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
              >
                ⚡
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#12121a] rounded-xl p-4 text-center">
          <p className="text-xs text-[#6b6b80] mb-2">Sleep</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() =>
                handleSleepChange(Math.max(0, (log?.sleepHours ?? 7) - 0.5))
              }
              className="text-[#6b6b80] hover:text-white text-sm"
            >
              −
            </button>
            <span className="text-lg font-bold w-10 text-center">
              {log?.sleepHours || "—"}
            </span>
            <button
              onClick={() =>
                handleSleepChange(Math.min(12, (log?.sleepHours ?? 7) + 0.5))
              }
              className="text-[#6b6b80] hover:text-white text-sm"
            >
              +
            </button>
          </div>
          <p className="text-[10px] text-[#6b6b80]">hours</p>
        </div>
      </div>

      {/* Protocol Checklist */}
      <h2 className="text-lg font-semibold mb-4">
        Today&apos;s Protocols
      </h2>
      <div className="space-y-2">
        {todaysProtocols.map((sp) => (
          <button
            key={sp.protocolId}
            onClick={() => handleToggle(sp.protocolId)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left ${
              sp.completed
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-[#12121a] hover:bg-[#1a1a25]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all ${
                sp.completed
                  ? "bg-emerald-500 text-white"
                  : "border-2 border-[#2a2a3a]"
              }`}
            >
              {sp.completed && "✓"}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  sp.completed ? "text-emerald-400" : "text-white"
                }`}
              >
                {sp.protocol!.name}
              </p>
              <p className="text-xs text-[#6b6b80]">
                {categoryInfo[sp.protocol!.category].icon}{" "}
                {categoryInfo[sp.protocol!.category].label}
                {sp.protocol!.frequency && ` · ${sp.protocol!.frequency}`}
              </p>
            </div>
          </button>
        ))}
      </div>

      {todaysProtocols.length === 0 && (
        <div className="text-center py-12 text-[#6b6b80]">
          <p>No protocols scheduled for this day.</p>
          <Link
            href="/routine"
            className="text-indigo-400 text-sm hover:underline mt-2 inline-block"
          >
            Edit your weekly schedule →
          </Link>
        </div>
      )}

      <div className="h-20 md:hidden" />
    </Shell>
  );
}
