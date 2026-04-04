"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { loadRoutine, hasCompletedOnboarding, getStreakDays } from "@/lib/storage";
import { protocols, categoryInfo } from "@/lib/protocols";
import { programs } from "@/lib/programs";
import type { UserRoutine } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [routine, setRoutine] = useState<UserRoutine | null>(null);

  useEffect(() => {
    if (!hasCompletedOnboarding()) { router.push("/onboarding"); return; }
    setRoutine(loadRoutine());
  }, [router]);

  if (!routine) return null;

  const streak = getStreakDays(routine);
  const today = new Date().toISOString().split("T")[0];
  const todayLog = routine.dailyLogs.find((l) => l.date === today);
  const todayCompleted = todayLog?.completedProtocols.length ?? 0;
  const totalProtocols = routine.selectedProtocols.length;
  const activeProgram = routine.activeProgram
    ? programs.find((p) => p.id === routine.activeProgram?.programId)
    : null;
  const recommendedProgram = routine.profile.recommendedProgram
    ? programs.find((p) => p.id === routine.profile.recommendedProgram)
    : null;

  const recentWorkouts = routine.workoutLogs
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <Shell>
      {/* Greeting */}
      <div className="mb-10">
        <p className="text-[13px] text-[#86868b] font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight text-[#1d1d1f] mt-1">
          Hey, {routine.profile.name || "there"}.
        </h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { value: streak, label: "Day Streak", color: "#0071e3" },
          { value: totalProtocols, label: "Active Protocols", color: "#30d158" },
          { value: todayCompleted, label: "Done Today", color: "#5e5ce6" },
          { value: recentWorkouts.length, label: "Workouts This Week", color: "#ff453a" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#fbfbfd] rounded-2xl p-5 border border-[#d2d2d7]/30">
            <p className="text-[32px] font-semibold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-[12px] text-[#86868b] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Active Program or Recommendation */}
      {activeProgram ? (
        <div className="mb-10">
          <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">
            Active Program
          </h2>
          <Link
            href={`/programs/${activeProgram.id}`}
            className="block bg-[#1d1d1f] rounded-2xl p-6 text-white hover:bg-[#2d2d2f] transition-apple"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#86868b] uppercase tracking-wider font-medium">
                  Week {routine.activeProgram?.currentWeek} of {activeProgram.weeks}
                </p>
                <h3 className="text-[21px] font-semibold mt-1">{activeProgram.name}</h3>
                <p className="text-[14px] text-[#86868b] mt-1">{activeProgram.tagline}</p>
              </div>
              <span className="text-[#86868b]">→</span>
            </div>
            <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0071e3] rounded-full transition-all"
                style={{ width: `${((routine.activeProgram?.currentWeek ?? 1) / activeProgram.weeks) * 100}%` }}
              />
            </div>
          </Link>
        </div>
      ) : recommendedProgram ? (
        <div className="mb-10">
          <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">
            Recommended for you
          </h2>
          <Link
            href="/programs"
            className="block bg-gradient-to-br from-[#fbfbfd] to-[#f5f5f7] rounded-2xl p-6 border border-[#d2d2d7]/40 hover:border-[#86868b] transition-apple"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[19px] font-semibold text-[#1d1d1f]">
                  {recommendedProgram.name}
                </h3>
                <p className="text-[14px] text-[#86868b] mt-1">
                  {recommendedProgram.tagline} · {recommendedProgram.duration}
                </p>
              </div>
              <span className="text-[15px] font-medium text-[#0071e3]">Start →</span>
            </div>
          </Link>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="mb-10">
        <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/tracker" className="bg-[#fbfbfd] rounded-2xl p-5 border border-[#d2d2d7]/30 hover:bg-[#f5f5f7] transition-apple">
            <p className="text-[24px] mb-2">✓</p>
            <p className="text-[15px] font-semibold text-[#1d1d1f]">Daily Check-in</p>
            <p className="text-[13px] text-[#86868b] mt-0.5">Track today&apos;s protocols</p>
          </Link>
          <Link href="/workout" className="bg-[#fbfbfd] rounded-2xl p-5 border border-[#d2d2d7]/30 hover:bg-[#f5f5f7] transition-apple">
            <p className="text-[24px] mb-2">↑</p>
            <p className="text-[15px] font-semibold text-[#1d1d1f]">Log Workout</p>
            <p className="text-[13px] text-[#86868b] mt-0.5">Track sets, reps & weight</p>
          </Link>
          <Link href="/meals" className="bg-[#fbfbfd] rounded-2xl p-5 border border-[#d2d2d7]/30 hover:bg-[#f5f5f7] transition-apple">
            <p className="text-[24px] mb-2">◇</p>
            <p className="text-[15px] font-semibold text-[#1d1d1f]">Meal Ideas</p>
            <p className="text-[13px] text-[#86868b] mt-0.5">Browse healthy recipes</p>
          </Link>
        </div>
      </div>

      {/* Active Protocols Preview */}
      {totalProtocols > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">
              Your Protocols
            </h2>
            <Link href="/protocols" className="text-[13px] font-medium text-[#0071e3]">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {routine.selectedProtocols.slice(0, 5).map((sp) => {
              const proto = protocols.find((p) => p.id === sp.protocolId);
              if (!proto) return null;
              const completed = todayLog?.completedProtocols.includes(sp.protocolId);
              return (
                <div
                  key={sp.protocolId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-apple ${
                    completed
                      ? "bg-[#30d158]/5 border-[#30d158]/20"
                      : "bg-[#fbfbfd] border-[#d2d2d7]/30"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      completed ? "bg-[#30d158] text-white" : "border-2 border-[#d2d2d7]"
                    }`}
                  >
                    {completed && "✓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#1d1d1f] truncate">{proto.name}</p>
                    <p className="text-[11px] text-[#86868b]">
                      {categoryInfo[proto.category].icon} {categoryInfo[proto.category].label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
