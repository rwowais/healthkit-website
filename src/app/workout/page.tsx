"use client";

import { useState, useEffect, useRef } from "react";
import Shell from "@/components/Shell";
import { saveWorkoutLog, loadRoutine } from "@/lib/storage";
import type { UserRoutine, WorkoutLog, ExerciseLog, SetLog } from "@/lib/types";

const setTypes: SetLog["type"][] = ["warmup", "working", "cooldown"];

const setTypeColors: Record<string, string> = {
  warmup: "bg-[#ff9f0a]/10 text-[#ff9f0a]",
  working: "bg-[#0071e3]/10 text-[#0071e3]",
  cooldown: "bg-[#5e5ce6]/10 text-[#5e5ce6]",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkoutPage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutLog | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [newExerciseName, setNewExerciseName] = useState("");
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  useEffect(() => {
    if (activeWorkout && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeWorkout]);

  if (!routine) return null;

  function handleStartWorkout() {
    const now = Date.now();
    startTimeRef.current = now;
    setElapsed(0);
    setActiveWorkout({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exercises: [],
      duration: 0,
      notes: "",
    });
  }

  function handleAddExercise() {
    if (!newExerciseName.trim() || !activeWorkout) return;
    const exercise: ExerciseLog = {
      name: newExerciseName.trim(),
      sets: [],
    };
    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, exercise],
    });
    setNewExerciseName("");
  }

  function handleAddSet(exerciseIdx: number) {
    if (!activeWorkout) return;
    const exercises = [...activeWorkout.exercises];
    exercises[exerciseIdx] = {
      ...exercises[exerciseIdx],
      sets: [
        ...exercises[exerciseIdx].sets,
        { weight: 0, reps: 0, type: "working" },
      ],
    };
    setActiveWorkout({ ...activeWorkout, exercises });
  }

  function handleUpdateSet(
    exerciseIdx: number,
    setIdx: number,
    field: keyof SetLog,
    value: number | string
  ) {
    if (!activeWorkout) return;
    const exercises = [...activeWorkout.exercises];
    const sets = [...exercises[exerciseIdx].sets];
    sets[setIdx] = { ...sets[setIdx], [field]: value };
    exercises[exerciseIdx] = { ...exercises[exerciseIdx], sets };
    setActiveWorkout({ ...activeWorkout, exercises });
  }

  function handleRemoveSet(exerciseIdx: number, setIdx: number) {
    if (!activeWorkout) return;
    const exercises = [...activeWorkout.exercises];
    const sets = exercises[exerciseIdx].sets.filter((_, i) => i !== setIdx);
    exercises[exerciseIdx] = { ...exercises[exerciseIdx], sets };
    setActiveWorkout({ ...activeWorkout, exercises });
  }

  function handleFinishWorkout() {
    if (!activeWorkout) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const finished: WorkoutLog = {
      ...activeWorkout,
      duration: elapsed,
    };
    const updated = saveWorkoutLog(finished);
    setRoutine({ ...updated });
    setActiveWorkout(null);
    startTimeRef.current = null;
    setElapsed(0);
  }

  function getTotalVolume(log: WorkoutLog): number {
    return log.exercises.reduce(
      (total, ex) =>
        total +
        ex.sets.reduce((setTotal, s) => setTotal + s.weight * s.reps, 0),
      0
    );
  }

  const pastLogs = [...routine.workoutLogs].reverse();

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-2">
          Workout
        </h1>
        <p className="text-[17px] text-[#86868b]">
          Log your exercises, sets, and track your training volume.
        </p>
      </div>

      {!activeWorkout ? (
        <>
          {/* Start Button */}
          <button
            onClick={handleStartWorkout}
            className="w-full sm:w-auto px-8 py-4 rounded-full text-[17px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-apple mb-10"
          >
            Start Workout
          </button>

          {/* History */}
          <div>
            <h2 className="text-[19px] font-semibold text-[#1d1d1f] mb-4">
              Workout History
            </h2>
            {pastLogs.length === 0 ? (
              <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-8 text-center">
                <p className="text-[#86868b] text-[15px]">
                  No workouts logged yet. Start your first workout above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]">
                        {formatDateShort(log.date)}
                      </p>
                      <div className="flex items-center gap-3 text-[12px] text-[#86868b]">
                        <span>{formatDuration(log.duration)}</span>
                        <span>{getTotalVolume(log).toLocaleString()} kg vol</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {log.exercises.map((ex, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] shrink-0" />
                          <span className="text-[#1d1d1f]">{ex.name}</span>
                          <span className="text-[#86868b]">
                            {ex.sets.length} sets
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Active Workout */}
          <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[13px] text-[#86868b]">Elapsed Time</p>
                <p className="text-[32px] font-bold text-[#1d1d1f] tabular-nums">
                  {formatDuration(elapsed)}
                </p>
              </div>
              <button
                onClick={handleFinishWorkout}
                className="px-6 py-2.5 rounded-full text-[13px] font-semibold bg-[#30d158] text-white hover:bg-[#28c04e] transition-apple"
              >
                Finish Workout
              </button>
            </div>
          </div>

          {/* Add Exercise */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddExercise()}
              placeholder="Exercise name..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3] transition-apple"
            />
            <button
              onClick={handleAddExercise}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-apple"
            >
              Add
            </button>
          </div>

          {/* Exercises */}
          <div className="space-y-4">
            {activeWorkout.exercises.map((exercise, exIdx) => (
              <div
                key={exIdx}
                className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5"
              >
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">
                  {exercise.name}
                </h3>

                {/* Sets */}
                {exercise.sets.length > 0 && (
                  <div className="mb-3">
                    <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center text-[11px] text-[#86868b] uppercase tracking-wide mb-2 px-1">
                      <span>Set</span>
                      <span>Weight (kg)</span>
                      <span>Reps</span>
                      <span>Type</span>
                      <span></span>
                    </div>
                    {exercise.sets.map((set, setIdx) => (
                      <div
                        key={setIdx}
                        className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center mb-2"
                      >
                        <span className="text-[13px] text-[#86868b] w-6 text-center">
                          {setIdx + 1}
                        </span>
                        <input
                          type="number"
                          value={set.weight || ""}
                          onChange={(e) =>
                            handleUpdateSet(
                              exIdx,
                              setIdx,
                              "weight",
                              Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="px-3 py-2 rounded-lg bg-white border border-[#d2d2d7]/30 text-[13px] text-[#1d1d1f] outline-none focus:border-[#0071e3] transition-apple w-full"
                        />
                        <input
                          type="number"
                          value={set.reps || ""}
                          onChange={(e) =>
                            handleUpdateSet(
                              exIdx,
                              setIdx,
                              "reps",
                              Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="px-3 py-2 rounded-lg bg-white border border-[#d2d2d7]/30 text-[13px] text-[#1d1d1f] outline-none focus:border-[#0071e3] transition-apple w-full"
                        />
                        <select
                          value={set.type}
                          onChange={(e) =>
                            handleUpdateSet(
                              exIdx,
                              setIdx,
                              "type",
                              e.target.value
                            )
                          }
                          className={`px-2 py-2 rounded-lg text-[11px] font-medium outline-none cursor-pointer ${setTypeColors[set.type]}`}
                        >
                          {setTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemoveSet(exIdx, setIdx)}
                          className="text-[#86868b] hover:text-[#ff453a] transition-apple p-1"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleAddSet(exIdx)}
                  className="text-[13px] font-medium text-[#0071e3] hover:text-[#0077ed] transition-apple"
                >
                  + Add Set
                </button>
              </div>
            ))}
          </div>

          {activeWorkout.exercises.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#86868b] text-[15px]">
                Add your first exercise to get started.
              </p>
            </div>
          )}
        </>
      )}

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
