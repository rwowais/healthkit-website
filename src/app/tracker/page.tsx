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
  return day === 0 ? 6 : day - 1;
}

const moodEmojis = ["", "\uD83D\uDE1E", "\uD83D\uDE15", "\uD83D\uDE10", "\uD83D\uDE42", "\uD83D\uDE04"];

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

  // SVG circle math
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (completionPct / 100) * circumference;

  if (routine.selectedProtocols.length === 0) {
    return (
      <Shell>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">{"\u2705"}</div>
          <h1 className="text-[19px] font-semibold text-[#1d1d1f] mb-2">
            Nothing to Track Yet
          </h1>
          <p className="text-[15px] text-[#86868b] mb-6 max-w-md mx-auto">
            Add protocols to your routine first, then come here to track your
            daily adherence.
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

  return (
    <Shell>
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setDateOffset((d) => d - 1)}
          className="p-2.5 rounded-full hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-apple"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-[19px] font-semibold text-[#1d1d1f]">
            {formatDate(dateStr)}
          </h1>
          {dateOffset === 0 && (
            <span className="text-[12px] font-medium text-[#0071e3]">
              Today
            </span>
          )}
        </div>
        <button
          onClick={() => setDateOffset((d) => Math.min(d + 1, 0))}
          className={`p-2.5 rounded-full transition-apple ${
            dateOffset >= 0
              ? "text-[#d2d2d7] cursor-not-allowed"
              : "hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
          }`}
          disabled={dateOffset >= 0}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Circular Progress Ring */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#f5f5f7"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={completionPct === 100 ? "#30d158" : "#0071e3"}
              strokeWidth="8"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-bold text-[#1d1d1f]">
              {Math.round(completionPct)}%
            </span>
            <span className="text-[12px] text-[#86868b]">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Mood / Energy / Sleep */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {/* Mood */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">
            Mood
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleMoodChange(n)}
                className={`text-lg transition-apple ${
                  (log?.mood ?? 0) >= n
                    ? "opacity-100 scale-110"
                    : "opacity-30 hover:opacity-60"
                }`}
              >
                {moodEmojis[n]}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">
            Energy
          </p>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleEnergyChange(n)}
                className={`text-lg transition-apple ${
                  (log?.energy ?? 0) >= n
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
              >
                {"\u26A1"}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">
            Sleep
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() =>
                handleSleepChange(Math.max(0, (log?.sleepHours ?? 7) - 0.5))
              }
              className="w-7 h-7 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] text-[15px] flex items-center justify-center transition-apple"
            >
              -
            </button>
            <span className="text-[17px] font-bold text-[#1d1d1f] w-10 text-center tabular-nums">
              {log?.sleepHours || "\u2014"}
            </span>
            <button
              onClick={() =>
                handleSleepChange(Math.min(12, (log?.sleepHours ?? 7) + 0.5))
              }
              className="w-7 h-7 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] text-[15px] flex items-center justify-center transition-apple"
            >
              +
            </button>
          </div>
          <p className="text-[10px] text-[#86868b] mt-1">hours</p>
        </div>
      </div>

      {/* Protocol Checklist */}
      <h2 className="text-[17px] font-semibold text-[#1d1d1f] mb-4">
        Today&apos;s Protocols
      </h2>
      <div className="space-y-2">
        {todaysProtocols.map((sp) => {
          const catColor = categoryInfo[sp.protocol!.category].color;

          return (
            <button
              key={sp.protocolId}
              onClick={() => handleToggle(sp.protocolId)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-apple text-left ${
                sp.completed
                  ? "bg-[#30d158]/6 border border-[#30d158]/20"
                  : "bg-[#fbfbfd] border border-[#d2d2d7]/30 hover:bg-[#f5f5f7]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 transition-apple ${
                  sp.completed
                    ? "bg-[#30d158] text-white"
                    : "border-2 border-[#d2d2d7]"
                }`}
              >
                {sp.completed && "\u2713"}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[15px] font-medium ${
                    sp.completed
                      ? "text-[#30d158]"
                      : "text-[#1d1d1f]"
                  }`}
                >
                  {sp.protocol!.name}
                </p>
                <p className="text-[12px] text-[#86868b]">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: catColor }}
                  />
                  {categoryInfo[sp.protocol!.category].label}
                  {sp.protocol!.frequency && ` \u00B7 ${sp.protocol!.frequency}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {todaysProtocols.length === 0 && (
        <div className="text-center py-12 text-[#86868b]">
          <p className="text-[15px]">No protocols scheduled for this day.</p>
          <Link
            href="/protocols"
            className="text-[#0071e3] text-[13px] hover:underline mt-2 inline-block"
          >
            Browse protocols
          </Link>
        </div>
      )}

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
