"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { protocols, categoryInfo } from "@/lib/protocols";
import { Category } from "@/lib/types";
import {
  loadRoutine,
  removeProtocol,
  updateProtocolSchedule,
} from "@/lib/storage";
import type { UserRoutine } from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RoutinePage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [groupBy, setGroupBy] = useState<"category" | "day">("category");

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  if (!routine) return null;

  const selectedProtocols = routine.selectedProtocols
    .map((sp) => ({
      ...sp,
      protocol: protocols.find((p) => p.id === sp.protocolId),
    }))
    .filter((sp) => sp.protocol);

  function handleRemove(protocolId: string) {
    const updated = removeProtocol(protocolId);
    setRoutine({ ...updated });
  }

  function handleToggleDay(protocolId: string, dayIndex: number) {
    const sp = routine!.selectedProtocols.find(
      (p) => p.protocolId === protocolId
    );
    if (!sp) return;
    const newSchedule = [...sp.weeklySchedule];
    newSchedule[dayIndex] = !newSchedule[dayIndex];
    const updated = updateProtocolSchedule(protocolId, newSchedule);
    setRoutine({ ...updated });
  }

  if (selectedProtocols.length === 0) {
    return (
      <Shell>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold mb-3">No Protocols Yet</h1>
          <p className="text-[#6b6b80] mb-6 max-w-md mx-auto">
            Browse the protocol library and add the ones you want to implement
            in your routine.
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

  const grouped = selectedProtocols.reduce(
    (acc, sp) => {
      const cat = sp.protocol!.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(sp);
      return acc;
    },
    {} as Record<string, typeof selectedProtocols>
  );

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Routine</h1>
        <p className="text-[#6b6b80]">
          {selectedProtocols.length} protocols selected. Configure which days
          each protocol is active.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setGroupBy("category")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            groupBy === "category"
              ? "bg-white/10 text-white"
              : "text-[#6b6b80] hover:text-white"
          }`}
        >
          By Category
        </button>
        <button
          onClick={() => setGroupBy("day")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            groupBy === "day"
              ? "bg-white/10 text-white"
              : "text-[#6b6b80] hover:text-white"
          }`}
        >
          By Day
        </button>
      </div>

      {groupBy === "category" ? (
        <div className="space-y-8">
          {(Object.keys(grouped) as Category[]).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{categoryInfo[cat].icon}</span>
                <h2 className="text-lg font-semibold">
                  {categoryInfo[cat].label}
                </h2>
                <span className="text-xs text-[#6b6b80]">
                  ({grouped[cat].length})
                </span>
              </div>
              <div className="space-y-3">
                {grouped[cat].map((sp) => (
                  <div
                    key={sp.protocolId}
                    className="bg-[#12121a] rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-sm text-white">
                        {sp.protocol!.name}
                      </h3>
                      <button
                        onClick={() => handleRemove(sp.protocolId)}
                        className="text-[#6b6b80] hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      {DAYS.map((day, i) => (
                        <button
                          key={day}
                          onClick={() => handleToggleDay(sp.protocolId, i)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                            sp.weeklySchedule[i]
                              ? "bg-white/15 text-white"
                              : "bg-white/5 text-[#6b6b80] hover:bg-white/10"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day, dayIndex) => {
            const dayProtocols = selectedProtocols.filter(
              (sp) => sp.weeklySchedule[dayIndex]
            );
            return (
              <div key={day}>
                <h2 className="text-lg font-semibold mb-3">
                  {day}
                  <span className="text-xs text-[#6b6b80] ml-2">
                    ({dayProtocols.length} protocols)
                  </span>
                </h2>
                {dayProtocols.length === 0 ? (
                  <p className="text-[#6b6b80] text-sm py-3">Rest day</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dayProtocols.map((sp) => (
                      <div
                        key={sp.protocolId}
                        className="bg-[#12121a] rounded-lg p-3 flex items-center gap-3"
                      >
                        <span className="text-lg">
                          {categoryInfo[sp.protocol!.category].icon}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {sp.protocol!.name}
                          </p>
                          <p className="text-xs text-[#6b6b80]">
                            {sp.protocol!.frequency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="h-20 md:hidden" />
    </Shell>
  );
}
