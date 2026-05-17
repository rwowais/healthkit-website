"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadState, saveState } from "@/lib/storage";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");

  function handleComplete() {
    const state = loadState();
    state.settings.name = name.trim();
    state.settings.bedtime = bedtime;
    state.settings.wakeTime = wakeTime;
    state.settings.completedOnboarding = true;
    state.settings.trialStartDate = new Date().toISOString();
    saveState(state);
    router.push("/today");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress */}
      <div className="w-full h-1 bg-[#f5f5f7]">
        <div
          className="h-full bg-[#0071e3] transition-all duration-500"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto w-full">
        {/* Step 0: Name */}
        {step === 0 && (
          <div className="w-full text-center">
            <div className="text-5xl mb-6">👋</div>
            <h1 className="text-[28px] font-bold text-[#1d1d1f] mb-2">
              Welcome to Protocolize
            </h1>
            <p className="text-[15px] text-[#86868b] mb-10">
              Let&apos;s set up your longevity protocol in under a minute.
            </p>
            <div className="mb-8">
              <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wider block mb-3 text-left">
                What should we call you?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                className="w-full px-4 py-3.5 rounded-xl border border-[#d2d2d7] text-[17px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-apple"
                autoFocus
              />
            </div>
            <button
              onClick={() => name.trim() && setStep(1)}
              disabled={!name.trim()}
              className={`w-full py-3.5 rounded-full text-[15px] font-semibold transition-apple ${
                name.trim()
                  ? "bg-[#0071e3] text-white hover:bg-[#0077ed]"
                  : "bg-[#f5f5f7] text-[#d2d2d7] cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 1: Sleep Schedule */}
        {step === 1 && (
          <div className="w-full text-center">
            <div className="text-5xl mb-6">🌙</div>
            <h1 className="text-[28px] font-bold text-[#1d1d1f] mb-2">
              Your sleep schedule
            </h1>
            <p className="text-[15px] text-[#86868b] mb-10">
              We&apos;ll use this to calculate your protocol times. You can always
              change it later.
            </p>

            <div className="space-y-6 mb-10">
              <div>
                <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wider block mb-3 text-left">
                  Bedtime
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                    😴
                  </span>
                  <input
                    type="time"
                    value={bedtime}
                    onChange={(e) => setBedtime(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#d2d2d7] text-[17px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-apple"
                  />
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wider block mb-3 text-left">
                  Wake time
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                    ☀️
                  </span>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#d2d2d7] text-[17px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-apple"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-3.5 rounded-full text-[15px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-apple"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-[#0071e3] text-white py-3.5 rounded-full text-[15px] font-semibold hover:bg-[#0077ed] transition-apple"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Ready */}
        {step === 2 && (
          <div className="w-full text-center">
            <div className="text-5xl mb-6">🚀</div>
            <h1 className="text-[28px] font-bold text-[#1d1d1f] mb-2">
              You&apos;re all set, {name.trim()}
            </h1>
            <p className="text-[15px] text-[#86868b] mb-6 leading-relaxed">
              We&apos;ve loaded a science-backed sleep protocol to get you started.
              You can customize everything, add your own items, or start fresh.
            </p>

            <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 mb-10 text-left">
              <p className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-3">
                Your starting protocol
              </p>
              <div className="space-y-2">
                {[
                  { icon: "🌙", label: "Sleep", count: "11 items", desc: "Evening wind-down + morning routine" },
                  { icon: "⚡", label: "Exercise", count: "9 items", desc: "Strength, cardio & mobility" },
                  { icon: "🥗", label: "Nutrition", count: "8 items", desc: "Meal timing & guidelines" },
                  { icon: "💊", label: "Supplements", count: "8 items", desc: "Evidence-based stacks" },
                ].map((p) => (
                  <div key={p.label} className="flex items-center gap-3 py-2">
                    <span className="text-xl">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1d1d1f]">
                        {p.label}
                      </p>
                      <p className="text-[12px] text-[#86868b]">{p.desc}</p>
                    </div>
                    <span className="text-[12px] text-[#86868b] shrink-0">
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 rounded-full text-[15px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-apple"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-[#0071e3] text-white py-3.5 rounded-full text-[15px] font-semibold hover:bg-[#0077ed] transition-apple"
              >
                Let&apos;s Go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
