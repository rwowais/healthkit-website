"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { programs } from "@/lib/programs";
import { loadRoutine, startProgram } from "@/lib/storage";
import { categoryInfo } from "@/lib/protocols";
import type { UserRoutine } from "@/lib/types";

const difficultyColors: Record<string, string> = {
  easy: "bg-[#30d158]/10 text-[#30d158]",
  moderate: "bg-[#ff9f0a]/10 text-[#ff9f0a]",
  advanced: "bg-[#ff453a]/10 text-[#ff453a]",
};

export default function ProgramsPage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  if (!routine) return null;

  function handleStart(programId: string) {
    const updated = startProgram(programId);
    setRoutine({ ...updated });
  }

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-2">
          Programs
        </h1>
        <p className="text-[17px] text-[#86868b]">
          Structured multi-week plans to transform your health.
        </p>
      </div>

      {/* Program Cards */}
      <div className="grid gap-6">
        {programs.map((program) => {
          const isActive = routine?.activeProgram?.programId === program.id;

          return (
            <div
              key={program.id}
              className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden transition-apple hover:shadow-sm"
            >
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {program.tier === "premium" && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#af52de]/10 text-[#af52de] flex items-center gap-1">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                          </svg>
                          Premium
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${difficultyColors[program.difficulty]}`}
                      >
                        {program.difficulty}
                      </span>
                    </div>
                    <h2 className="text-[19px] font-bold text-[#1d1d1f] mb-1">
                      {program.name}
                    </h2>
                    <p className="text-[15px] text-[#86868b]">
                      {program.tagline}
                    </p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-[13px] text-[#86868b] flex items-center gap-1">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {program.duration}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {program.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: categoryInfo[cat].color + "18",
                          color: categoryInfo[cat].color,
                        }}
                      >
                        {categoryInfo[cat].icon} {categoryInfo[cat].label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase Breakdown */}
              <div className="px-6 pb-4">
                <p className="text-[13px] font-medium text-[#1d1d1f] mb-2">
                  Phases
                </p>
                <div className="space-y-2">
                  {program.phases.map((phase, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#d2d2d7]/20"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center text-[12px] font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1d1d1f] truncate">
                          {phase.name}
                        </p>
                        <p className="text-[12px] text-[#86868b]">
                          Weeks {phase.weekStart}
                          {phase.weekEnd !== phase.weekStart
                            ? `\u2013${phase.weekEnd}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex items-center gap-3">
                {isActive ? (
                  <span className="flex-1 py-2.5 rounded-full text-[13px] font-semibold bg-[#30d158]/10 text-[#30d158] text-center">
                    Currently Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleStart(program.id)}
                    className="flex-1 py-2.5 rounded-full text-[13px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-apple"
                  >
                    Start Program
                  </button>
                )}
                <Link
                  href={`/programs/${program.id}`}
                  className="px-5 py-2.5 rounded-full text-[13px] font-semibold border border-[#d2d2d7]/30 text-[#1d1d1f] hover:bg-[#f5f5f7] transition-apple"
                >
                  Details
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
