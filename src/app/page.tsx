"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadState } from "@/lib/storage";

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const state = loadState();
    if (state.settings.completedOnboarding) {
      router.replace("/today");
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <span className="text-[20px] font-bold text-[#1d1d1f] tracking-tight">
          Protocolize
        </span>
        <button
          onClick={() => router.push("/onboarding")}
          className="bg-[#0071e3] hover:bg-[#0077ed] text-white px-5 py-2.5 rounded-full text-[13px] font-semibold transition-apple"
        >
          Get Started
        </button>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-20 max-w-3xl mx-auto">
        <h1 className="text-[44px] sm:text-[56px] font-bold tracking-tight text-[#1d1d1f] leading-[1.05] mb-6">
          Your longevity
          <br />
          protocol,{" "}
          <span className="bg-gradient-to-r from-[#5e5ce6] via-[#0071e3] to-[#30d158] bg-clip-text text-transparent">
            simplified.
          </span>
        </h1>
        <p className="text-[19px] text-[#86868b] leading-relaxed max-w-xl mx-auto mb-10">
          Build your daily routine around science-backed protocols for sleep,
          exercise, nutrition, and supplements. Track everything. See what works.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.push("/onboarding")}
            className="bg-[#0071e3] hover:bg-[#0077ed] text-white px-8 py-3.5 rounded-full text-[15px] font-semibold transition-apple"
          >
            Start Free Trial
          </button>
          <span className="text-[13px] text-[#86868b]">
            7 days free, then $7/mo
          </span>
        </div>
      </section>

      {/* Pillars */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              icon: "🌙",
              label: "Sleep",
              color: "#5e5ce6",
              desc: "Wind-down routines & morning habits",
            },
            {
              icon: "⚡",
              label: "Exercise",
              color: "#ff453a",
              desc: "Strength, cardio & mobility",
            },
            {
              icon: "🥗",
              label: "Nutrition",
              color: "#30d158",
              desc: "Meal timing & macro guidelines",
            },
            {
              icon: "💊",
              label: "Supplements",
              color: "#ff9f0a",
              desc: "Evidence-based stacks",
            },
          ].map((pillar) => (
            <div
              key={pillar.label}
              className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 text-center"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                style={{ backgroundColor: `${pillar.color}15` }}
              >
                {pillar.icon}
              </div>
              <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">
                {pillar.label}
              </p>
              <p className="text-[12px] text-[#86868b] leading-snug">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-[28px] font-bold text-[#1d1d1f] text-center mb-12">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Start with science",
              desc: "Get a ready-made protocol template based on the latest longevity research from Huberman, Attia, and Walker.",
            },
            {
              step: "2",
              title: "Make it yours",
              desc: "Edit, remove, or add your own items. Set your bedtime and wake time — everything adjusts dynamically.",
            },
            {
              step: "3",
              title: "Track daily",
              desc: "Check off items each day, log your sleep, mood, and energy. Watch your score and streak grow.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[#0071e3] text-white flex items-center justify-center text-[15px] font-bold mx-auto mb-4">
                {item.step}
              </div>
              <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">
                {item.title}
              </p>
              <p className="text-[13px] text-[#86868b] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 max-w-xl mx-auto text-center">
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-8">
          <p className="text-[13px] font-semibold text-[#0071e3] uppercase tracking-wider mb-2">
            Premium
          </p>
          <p className="text-[36px] font-bold text-[#1d1d1f] mb-1">
            $7<span className="text-[17px] text-[#86868b] font-normal">/mo</span>
          </p>
          <p className="text-[13px] text-[#86868b] mb-6">
            7-day free trial. Cancel anytime.
          </p>
          <ul className="text-left space-y-2 mb-8">
            {[
              "Science-backed protocol templates",
              "Smart timing based on your schedule",
              "Daily score & streak tracking",
              "Sleep, mood, and energy logging",
              "Custom protocol items",
              "AI-powered insights (coming soon)",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-[14px] text-[#1d1d1f]"
              >
                <span className="text-[#30d158] text-[16px]">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push("/onboarding")}
            className="w-full bg-[#0071e3] hover:bg-[#0077ed] text-white py-3.5 rounded-full text-[15px] font-semibold transition-apple"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#d2d2d7]/30 max-w-3xl mx-auto text-center">
        <p className="text-[11px] text-[#86868b] leading-relaxed">
          Protocolize is not a medical device and does not provide medical advice.
          Always consult your physician before starting any new health protocol.
        </p>
      </footer>
    </div>
  );
}
