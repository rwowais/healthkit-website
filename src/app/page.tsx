"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasCompletedOnboarding } from "@/lib/storage";

export default function LandingPage() {
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => { setOnboarded(hasCompletedOnboarding()); }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 glass border-b border-[#d2d2d7]/40">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-12">
          <span className="text-[17px] font-semibold tracking-tight">HealthKit</span>
          <div className="flex items-center gap-4">
            <Link href="/protocols" className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-apple">
              Protocols
            </Link>
            <Link href="/programs" className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-apple">
              Programs
            </Link>
            <Link
              href={onboarded ? "/dashboard" : "/onboarding"}
              className="text-[13px] font-medium bg-[#0071e3] text-white px-4 py-1.5 rounded-full hover:bg-[#0077ed] transition-apple"
            >
              {onboarded ? "Open App" : "Get Started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-[48px] sm:text-[64px] font-semibold leading-[1.05] tracking-tight text-[#1d1d1f]">
            Your longevity routine,{" "}
            <span className="bg-gradient-to-r from-[#0071e3] to-[#30d158] bg-clip-text text-transparent">
              simplified.
            </span>
          </h1>
          <p className="mt-6 text-[19px] sm:text-[21px] text-[#86868b] leading-relaxed max-w-xl mx-auto">
            Science-backed protocols for sleep, exercise, nutrition, and
            supplements. Build your routine, follow structured programs, and
            track your progress.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href={onboarded ? "/dashboard" : "/onboarding"}
              className="text-[17px] font-medium bg-[#0071e3] text-white px-8 py-3 rounded-full hover:bg-[#0077ed] transition-apple"
            >
              {onboarded ? "Open App" : "Get Started — Free"}
            </Link>
            <Link
              href="/programs"
              className="text-[17px] font-medium text-[#0071e3] px-8 py-3 rounded-full hover:bg-[#f5f5f7] transition-apple"
            >
              View Programs
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-center text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-3">
            Everything you need
          </h2>
          <p className="text-center text-[32px] sm:text-[40px] font-semibold text-[#1d1d1f] tracking-tight mb-16">
            One app for your entire health routine.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "🌙",
                title: "Sleep",
                desc: "Circadian rhythm protocols, sleep hygiene habits, and supplement stacks to optimize recovery.",
              },
              {
                icon: "💪",
                title: "Exercise",
                desc: "Structured strength programs with progressive overload, Zone 2 cardio, and mobility work.",
              },
              {
                icon: "🥗",
                title: "Nutrition",
                desc: "Macro-optimized meal plans, carb backloading, time-restricted eating, and a full meal library.",
              },
              {
                icon: "💊",
                title: "Supplements",
                desc: "Evidence-based supplement protocols for metabolism, sleep, performance, and longevity.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[#d2d2d7]/40">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{f.title}</h3>
                <p className="mt-2 text-[14px] text-[#86868b] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-center text-[32px] sm:text-[40px] font-semibold text-[#1d1d1f] tracking-tight mb-16">
            How it works
          </h2>
          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Take the assessment",
                desc: "Answer a few questions about your goals, fitness level, and current habits. We'll recommend the right starting point.",
              },
              {
                step: "02",
                title: "Choose your path",
                desc: "Start a guided multi-week program like Metabolic Reset or Body Recomposition — or build a custom routine from our protocol library.",
              },
              {
                step: "03",
                title: "Track everything",
                desc: "Log workouts with sets, reps, and weights. Track daily protocols, mood, energy, and sleep. Watch your progress over time.",
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 items-start">
                <div className="shrink-0 w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[15px] font-semibold text-[#86868b]">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-[19px] font-semibold text-[#1d1d1f]">{s.title}</h3>
                  <p className="mt-1 text-[15px] text-[#86868b] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-center text-[32px] sm:text-[40px] font-semibold text-[#1d1d1f] tracking-tight mb-16">
            Simple pricing
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-[#d2d2d7]/40">
              <p className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Free</p>
              <p className="mt-2 text-[40px] font-semibold text-[#1d1d1f]">$0</p>
              <p className="text-[13px] text-[#86868b]">forever</p>
              <ul className="mt-6 space-y-3">
                {["Basic protocol library", "Custom routine builder", "Daily tracker", "Progress dashboard", "Meal inspiration (select)"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[14px] text-[#1d1d1f]">
                    <span className="text-[#30d158]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/onboarding" className="mt-8 block text-center text-[15px] font-medium text-[#0071e3] border border-[#0071e3] px-6 py-2.5 rounded-full hover:bg-[#0071e3] hover:text-white transition-apple">
                Get Started
              </Link>
            </div>
            <div className="bg-[#1d1d1f] rounded-2xl p-8 text-white">
              <p className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Premium</p>
              <p className="mt-2 text-[40px] font-semibold">$7<span className="text-[19px] font-normal text-[#86868b]">/mo</span></p>
              <p className="text-[13px] text-[#86868b]">cancel anytime</p>
              <ul className="mt-6 space-y-3">
                {[
                  "Everything in Free",
                  "Structured multi-week programs",
                  "Full protocol library",
                  "Workout logger with %1RM",
                  "Full meal library with macros",
                  "Advanced supplement stacks",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[14px]">
                    <span className="text-[#30d158]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button className="mt-8 w-full text-center text-[15px] font-medium bg-white text-[#1d1d1f] px-6 py-2.5 rounded-full hover:bg-[#f5f5f7] transition-apple">
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#d2d2d7]/40">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-[12px] text-[#86868b]">
            HealthKit is not medical advice. Consult your physician before starting any new health protocol.
          </p>
        </div>
      </footer>
    </div>
  );
}
