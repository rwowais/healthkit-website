"use client";

import { useState, useEffect, use } from "react";
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

export default function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [openPhase, setOpenPhase] = useState<number>(0);

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  const program = programs.find((p) => p.id === id);

  if (!program) {
    return (
      <Shell>
        <div className="text-center py-24">
          <h1 className="text-[19px] font-semibold text-[#1d1d1f] mb-2">
            Program Not Found
          </h1>
          <p className="text-[15px] text-[#86868b] mb-6">
            The program you are looking for does not exist.
          </p>
          <Link
            href="/programs"
            className="px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-apple"
          >
            Back to Programs
          </Link>
        </div>
      </Shell>
    );
  }

  if (!routine) return null;

  const isActive = routine.activeProgram?.programId === program.id;

  function handleStart() {
    const updated = startProgram(program!.id);
    setRoutine({ ...updated });
  }

  return (
    <Shell>
      {/* Back link */}
      <Link
        href="/programs"
        className="inline-flex items-center gap-1 text-[13px] text-[#0071e3] hover:text-[#0077ed] mb-6 transition-apple"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Programs
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <span className="text-[11px] text-[#86868b]">
            {program.duration}
          </span>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-2">
          {program.name}
        </h1>
        <p className="text-[17px] text-[#86868b] mb-4">
          {program.description}
        </p>
        <div className="flex items-center gap-2">
          {program.categories.map((cat) => (
            <span
              key={cat}
              className="text-[12px] font-medium px-2.5 py-1 rounded-full"
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

      {/* Start / Active */}
      <div className="mb-8">
        {isActive ? (
          <div className="bg-[#30d158]/8 border border-[#30d158]/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#30d158] flex items-center justify-center text-white text-[14px]">
              &#10003;
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f]">
                Currently Active
              </p>
              <p className="text-[13px] text-[#86868b]">
                Week {routine.activeProgram?.currentWeek} of {program.weeks}
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-3 rounded-full text-[15px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-apple"
          >
            Start Program
          </button>
        )}
      </div>

      {/* Phase Accordion */}
      <div className="space-y-4">
        {program.phases.map((phase, phaseIdx) => {
          const isOpen = openPhase === phaseIdx;

          return (
            <div
              key={phaseIdx}
              className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden transition-apple"
            >
              {/* Phase Header */}
              <button
                onClick={() => setOpenPhase(isOpen ? -1 : phaseIdx)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">
                    {phase.name}
                  </p>
                  <p className="text-[13px] text-[#86868b]">
                    Weeks {phase.weekStart}
                    {phase.weekEnd !== phase.weekStart
                      ? `\u2013${phase.weekEnd}`
                      : ""}
                    {" \u00B7 "}
                    {phase.description.slice(0, 80)}
                    {phase.description.length > 80 ? "..." : ""}
                  </p>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#86868b"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Phase Content */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-[13px] text-[#86868b] leading-relaxed">
                    {phase.description}
                  </p>

                  {phase.dailyPlan.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      className="bg-white rounded-xl border border-[#d2d2d7]/20 p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] font-semibold text-[#1d1d1f]">
                          {day.day}
                        </span>
                        <span className="text-[12px] text-[#86868b]">
                          {day.focus}
                        </span>
                      </div>

                      {/* Workouts */}
                      {day.workouts?.map((workout, wIdx) => (
                        <div key={wIdx} className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[12px] font-medium text-[#0071e3]">
                              {workout.name}
                            </span>
                            <span className="text-[11px] text-[#86868b]">
                              {workout.duration}
                            </span>
                          </div>

                          {/* Exercises */}
                          {workout.exercises && (
                            <div className="space-y-1.5 ml-2">
                              {workout.exercises.map((ex, eIdx) => (
                                <div
                                  key={eIdx}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#d2d2d7] shrink-0" />
                                  <span className="text-[#1d1d1f]">
                                    {ex.name}
                                  </span>
                                  <span className="text-[#86868b]">
                                    {ex.sets}x{ex.reps}
                                    {ex.intensity ? ` @ ${ex.intensity}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {workout.notes && (
                            <p className="text-[11px] text-[#86868b] mt-1.5 ml-2 italic">
                              {workout.notes}
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Nutrition */}
                      {day.nutrition && (
                        <div className="mt-2 pt-2 border-t border-[#d2d2d7]/20">
                          <p className="text-[11px] font-medium text-[#30d158] mb-1">
                            Nutrition
                          </p>
                          <div className="space-y-0.5 text-[12px] text-[#86868b]">
                            {day.nutrition.calories && (
                              <p>Calories: {day.nutrition.calories}</p>
                            )}
                            {day.nutrition.protein && (
                              <p>Protein: {day.nutrition.protein}</p>
                            )}
                            {day.nutrition.carbs && (
                              <p>Carbs: {day.nutrition.carbs}</p>
                            )}
                            {day.nutrition.fats && (
                              <p>Fats: {day.nutrition.fats}</p>
                            )}
                            {day.nutrition.fiber && (
                              <p>Fiber: {day.nutrition.fiber}</p>
                            )}
                            {day.nutrition.timing && (
                              <p>Timing: {day.nutrition.timing}</p>
                            )}
                            {day.nutrition.notes && (
                              <p className="italic">{day.nutrition.notes}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
