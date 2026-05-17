"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadState, saveState } from "@/lib/storage";
import { Button, Eyebrow } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");

  function complete() {
    const state = loadState();
    state.settings.name = name.trim();
    state.settings.bedtime = bedtime;
    state.settings.wakeTime = wakeTime;
    state.settings.completedOnboarding = true;
    state.settings.trialStartDate = new Date().toISOString();
    saveState(state);
    router.push("/today");
  }

  const inputCls =
    "w-full rounded-[var(--r-md)] border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-4 py-4 text-[17px] text-[var(--text-1)] outline-none focus:border-[var(--readiness)] tr-fast";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-1 w-full bg-[var(--surface-2)]">
        <div
          className="h-full tr"
          style={{
            width: `${((step + 1) / 3) * 100}%`,
            background:
              "linear-gradient(90deg, var(--sleep), var(--readiness))",
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        {step === 0 && (
          <div className="anim-rise w-full">
            <span
              className="mb-8 grid h-12 w-12 place-items-center rounded-[14px]"
              style={{
                background:
                  "linear-gradient(145deg, var(--sleep), var(--readiness))",
              }}
            >
              <span className="h-3 w-3 rounded-full bg-[#08090B]" />
            </span>
            <h1 className="t-display text-[var(--text-1)]">
              Longevity, measured.
            </h1>
            <p className="t-body mt-4 leading-relaxed">
              Protocolize turns science-backed routines into a calm daily
              practice. Let&apos;s set up your protocol in under a minute.
            </p>
            <div className="mt-10">
              <Eyebrow>What should we call you?</Eyebrow>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                className={`mt-3 ${inputCls}`}
              />
            </div>
            <Button
              full
              className="mt-8"
              disabled={!name.trim()}
              onClick={() => name.trim() && setStep(1)}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="anim-rise w-full">
            <Eyebrow color="var(--sleep)">Step 2</Eyebrow>
            <h1 className="t-title mt-3 text-[var(--text-1)]">
              Your sleep window
            </h1>
            <p className="t-body mt-3 leading-relaxed">
              This anchors the timing of your wind-down and morning protocols.
            </p>
            <div className="mt-10 space-y-6">
              <div>
                <Eyebrow>Target bedtime</Eyebrow>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className={`mt-3 ${inputCls}`}
                />
              </div>
              <div>
                <Eyebrow>Target wake</Eyebrow>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className={`mt-3 ${inputCls}`}
                />
              </div>
            </div>
            <div className="mt-10 flex gap-3">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button full onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="anim-rise w-full">
            <Eyebrow color="var(--vitality)">Ready</Eyebrow>
            <h1 className="t-title mt-3 text-[var(--text-1)]">
              You&apos;re all set{name.trim() ? `, ${name.trim()}` : ""}
            </h1>
            <p className="t-body mt-3 leading-relaxed">
              A science-backed protocol across four pillars is loaded and ready.
              Customize anything, anytime.
            </p>
            <div className="card mt-8 p-5">
              {[
                { icon: "🌙", label: "Sleep", desc: "Wind-down & morning routine" },
                { icon: "🏋️", label: "Exercise", desc: "Strength, cardio & mobility" },
                { icon: "🥗", label: "Nutrition", desc: "Meal timing & guidelines" },
                { icon: "💊", label: "Supplements", desc: "Evidence-based stacks" },
              ].map((p, i) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3.5 py-3"
                  style={{
                    borderTop:
                      i > 0 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <span className="text-[22px]">{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold text-[var(--text-1)]">
                      {p.label}
                    </p>
                    <p className="t-caption mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button full onClick={complete}>
                Begin
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
