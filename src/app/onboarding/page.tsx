"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadState, saveState } from "@/lib/storage";
import { Button, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

const GOALS: { key: string; label: string; desc: string; icon: IconName }[] = [
  { key: "longevity", label: "Longevity", desc: "Maximize healthspan", icon: "pulse" },
  { key: "sleep", label: "Better sleep", desc: "Deeper, consistent rest", icon: "moon" },
  { key: "body", label: "Body composition", desc: "Strength & metabolic health", icon: "dumbbell" },
  { key: "energy", label: "Daily energy", desc: "Steady focus & vitality", icon: "sparkle" },
];

const STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("longevity");
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");

  function complete() {
    const state = loadState();
    state.settings.name = name.trim();
    state.settings.primaryGoal = goal;
    state.settings.bedtime = bedtime;
    state.settings.wakeTime = wakeTime;
    state.settings.completedOnboarding = true;
    state.settings.disclaimerAcknowledged = true;
    state.settings.trialStartDate = new Date().toISOString();
    saveState(state);
    router.push("/today");
  }

  const inputCls =
    "w-full rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-4 text-[17px] text-[var(--text-1)] outline-none focus:ring-1 focus:ring-[var(--readiness)] tr-fast";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-1 w-full bg-[var(--surface-2)]">
        <div
          className="h-full tr"
          style={{
            width: `${((step + 1) / STEPS) * 100}%`,
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
            <Eyebrow color="var(--readiness)">Step 2</Eyebrow>
            <h1 className="t-title mt-3 text-[var(--text-1)]">
              What matters most to you?
            </h1>
            <p className="t-body mt-3 leading-relaxed">
              We&apos;ll tune your focus around this. You can change it anytime.
            </p>
            <div className="mt-8 space-y-3">
              {GOALS.map((g) => {
                const on = goal === g.key;
                return (
                  <button
                    key={g.key}
                    onClick={() => setGoal(g.key)}
                    className="press tr-fast flex w-full items-center gap-4 rounded-[var(--r-md)] p-4 text-left"
                    style={{
                      background: on
                        ? "color-mix(in srgb, var(--readiness) 14%, var(--surface-2))"
                        : "var(--surface-2)",
                      boxShadow: on
                        ? "inset 0 0 0 1.5px var(--readiness)"
                        : "none",
                    }}
                  >
                    <span
                      className="chip h-11 w-11 shrink-0"
                      style={{
                        background: on
                          ? "var(--readiness)"
                          : "var(--surface-3)",
                        color: on ? "#08090B" : "var(--text-2)",
                      }}
                    >
                      <Icon name={g.icon} size={20} />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-[var(--text-1)]">
                        {g.label}
                      </p>
                      <p className="t-caption mt-0.5">{g.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex gap-3">
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
            <Eyebrow color="var(--sleep)">Step 3</Eyebrow>
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
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button full onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="anim-rise w-full">
            <Eyebrow color="var(--vitality)">Ready</Eyebrow>
            <h1 className="t-title mt-3 text-[var(--text-1)]">
              You&apos;re all set{name.trim() ? `, ${name.trim()}` : ""}
            </h1>
            <p className="t-body mt-3 leading-relaxed">
              A science-backed protocol across four pillars is loaded. Track
              daily, log your biomarkers, and watch your trends compound.
            </p>
            <div className="card mt-8 p-5">
              {[
                { icon: "moon" as IconName, label: "Sleep" },
                { icon: "pulse" as IconName, label: "Exercise" },
                { icon: "leaf" as IconName, label: "Nutrition" },
                { icon: "pill" as IconName, label: "Supplements" },
              ].map((p, i) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3.5 py-3"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <span
                    className="chip h-9 w-9"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--text-2)",
                    }}
                  >
                    <Icon name={p.icon} size={17} />
                  </span>
                  <p className="text-[15px] font-semibold text-[var(--text-1)]">
                    {p.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[12px] leading-relaxed text-[var(--text-3)]">
              Protocolize is an educational tool, not medical advice or a
              diagnostic device. Consult a qualified clinician before changing
              your health, supplement, or exercise routine. By continuing you
              acknowledge this.
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button full onClick={complete}>
                Agree & begin
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
