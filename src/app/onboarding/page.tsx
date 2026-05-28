"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loadState } from "@/lib/storage";
import { activeDataSource } from "@/lib/datasource";
import { getUserId } from "@/lib/supabase";
import { packById } from "@/lib/packs";
import { Button, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

type Chip = { key: string; label: string; sub?: string; icon?: IconName };

const GOALS: Chip[] = [
  { key: "longevity", label: "Longevity", sub: "Healthspan & resilience", icon: "pulse" },
  { key: "sleep", label: "Better sleep", sub: "Deeper, consistent nights", icon: "moon" },
  { key: "energy", label: "Daily energy", sub: "Focus & vitality", icon: "sparkle" },
  { key: "body", label: "Body composition", sub: "Strength & metabolic", icon: "dumbbell" },
];
const MOOD: Chip[] = [
  { key: "calm", label: "Pretty calm", sub: "Room for more" },
  { key: "some", label: "Some pressure", sub: "Manageable" },
  { key: "stretched", label: "Stretched thin", sub: "Keep it light" },
];
const SLEEP: Chip[] = [
  { key: "rough", label: "Rough", sub: "Hard to fall/stay asleep" },
  { key: "ok", label: "Okay", sub: "Inconsistent" },
  { key: "solid", label: "Solid", sub: "Mostly rested" },
];
const FOCUS: Chip[] = [
  { key: "sleep", label: "Sleep", icon: "moon" },
  { key: "training", label: "Training", icon: "dumbbell" },
  { key: "nutrition", label: "Nutrition", icon: "leaf" },
  { key: "stress", label: "Stress & recovery", icon: "lungs" },
  { key: "focus", label: "Focus", icon: "sparkle" },
  { key: "supplements", label: "Supplements", icon: "pill" },
];
const EXP: Chip[] = [
  { key: "new", label: "New to this", sub: "Start gently" },
  { key: "some", label: "Some experience", sub: "" },
  { key: "deep", label: "Deep into it", sub: "Give me the system" },
];

const STEPS = 8;

const inputCls =
  "w-full rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-4 text-[17px] text-[var(--text-1)] outline-none focus:ring-1 focus:ring-[var(--readiness)] tr-fast";

/** Hoisted so it isn't remounted every parent render (focus/state loss). */
function Choice({
  chips,
  value,
  onPick,
  multi = false,
}: {
  chips: Chip[];
  value: string | string[];
  onPick: (k: string) => void;
  multi?: boolean;
}) {
  return (
    <div className="mt-8 space-y-2.5">
      {chips.map((c) => {
        const on = multi
          ? (value as string[]).includes(c.key)
          : value === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onPick(c.key)}
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
            {c.icon && (
              <span
                className="chip h-10 w-10 shrink-0"
                style={{
                  background: on
                    ? "var(--readiness)"
                    : "var(--surface-3)",
                  color: on ? "#08090B" : "var(--text-2)",
                }}
              >
                <Icon name={c.icon} size={19} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[var(--text-1)]">
                {c.label}
              </span>
              {c.sub && (
                <span className="mt-0.5 block text-[12.5px] text-[var(--text-3)]">
                  {c.sub}
                </span>
              )}
            </span>
            {multi && on && (
              <Icon
                name="check"
                size={16}
                className="shrink-0 text-[var(--readiness)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Nav({
  step,
  next,
  onBack,
  disabled,
}: {
  step: number;
  next: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center gap-3">
      {step > 0 && (
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      )}
      <Button full disabled={disabled} onClick={next}>
        Continue
      </Button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("longevity");
  const [overwhelm, setOverwhelm] = useState<"calm" | "some" | "stretched">(
    "some"
  );
  const [sleepBaseline, setSleepBaseline] = useState<
    "rough" | "ok" | "solid"
  >("ok");
  const [focus, setFocus] = useState<string[]>([]);
  const [experience, setExperience] = useState<"new" | "some" | "deep">(
    "some"
  );
  const [hasWearable, setHasWearable] = useState(false);
  const [bedtime, setBedtime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");

  // Compute the personalized starting system.
  //
  // Calm-system direction: Day-1 floor is ONE starter pack, not two
  // defaults. Stacking 12+ behaviors on someone who hasn't proved they
  // can hold one is a behavior-change cliff (median habit automaticity
  // is ~66 days for a single behavior in willing samples). The system
  // earns the right to grow — additional packs are one tap away in
  // /protocols#discover, but we don't impose them.
  //
  // Selection: pick the SINGLE pack most aligned with the user's
  // stated goal/focus/baseline. Longevity Foundation is the catch-all
  // fallback when no clearer signal exists. "Deep experience" users
  // can still get a 3-pack starter — they've self-identified as ready.
  const packs = useMemo(() => {
    // Prioritized goal → pack mapping. First match wins as the
    // starter; everything else gets discovered later.
    let starter = "longevity-foundation"; // default fallback
    if (sleepBaseline === "rough" || goal === "sleep" || focus.includes("sleep"))
      starter = "better-sleep";
    else if (overwhelm === "stretched" && focus.includes("stress"))
      starter = "burnout-recovery";
    else if (goal === "energy" || focus.includes("focus"))
      starter = "deep-focus";
    else if (goal === "body" || focus.includes("nutrition"))
      starter = "blood-sugar";

    const ids: string[] = [starter];
    // "Deep into it" users have self-identified as ready for more —
    // give them up to 3 packs, but still ramp gently.
    if (experience === "deep") {
      // Layer in complementary packs based on goal/focus, dedupe.
      const extras = new Set<string>();
      if (starter !== "longevity-foundation")
        extras.add("longevity-foundation");
      if (focus.includes("supplements")) extras.add("daily-essentials");
      if (focus.includes("body") || goal === "body")
        extras.add("metabolic-health");
      [...extras].slice(0, 2).forEach((id) => ids.push(id));
    }
    return ids
      .map((id) => packById(id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [goal, sleepBaseline, focus, overwhelm, experience]);

  // Defense-in-depth: an already-onboarded, signed-in user must never be
  // trapped in the questionnaire (the login-loop symptom). If the synced
  // state says onboarding is done, leave immediately.
  const guarded = useRef(false);
  useEffect(() => {
    if (guarded.current) return;
    guarded.current = true;
    activeDataSource.load().then((st) => {
      if (st.settings.completedOnboarding) router.replace("/today");
    });
  }, [router]);

  async function finish(withAccount: boolean) {
    const s = loadState();
    Object.assign(s.settings, {
      name: name.trim(),
      primaryGoal: goal,
      overwhelm,
      sleepBaseline,
      focusAreas: focus,
      experience,
      hasWearable,
      bedtime,
      wakeTime,
      completedOnboarding: true,
      disclaimerAcknowledged: true,
      trialStartDate: new Date().toISOString(),
      tier: "free" as const,
      premiumTrialEndsAt: new Date(
        Date.now() + 14 * 86400000
      ).toISOString(),
    });
    s.installedPacks = packs.map((p) => p.id);
    await activeDataSource.save(s);
    // If they already have a session, never send them back to /auth —
    // that's the loop. Only unauthenticated users who chose "save &
    // sync" go to /auth to create an account.
    const uid = await getUserId();
    router.push(!uid && withAccount ? "/auth" : "/today");
  }

  const goBack = () => setStep((s) => s - 1);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-1 w-full bg-[var(--surface-2)]">
        <motion.div
          className="h-full"
          style={{
            background:
              "linear-gradient(90deg, var(--sleep), var(--readiness))",
          }}
          animate={{ width: `${((step + 1) / STEPS) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {step === 0 && (
              <>
                <span
                  className="mb-7 grid h-12 w-12 place-items-center rounded-[14px]"
                  style={{
                    background:
                      "linear-gradient(145deg, var(--sleep), var(--readiness))",
                  }}
                >
                  <span className="h-3 w-3 rounded-full bg-[#08090B]" />
                </span>
                <h1 className="t-display text-[var(--text-1)]">
                  Let&apos;s build your system.
                </h1>
                <p className="t-body mt-4 leading-relaxed">
                  A handful of quick questions — about a minute. Your answers
                  shape a starting system that respects your bandwidth.
                </p>
                <div className="mt-9">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your first name"
                    className={inputCls}
                  />
                </div>
                <Nav
                  step={step}
                  onBack={goBack}
                  next={() => setStep(1)}
                  disabled={!name.trim()}
                />
              </>
            )}

            {step === 1 && (
              <>
                <Eyebrow color="var(--readiness)">Step 1</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  What matters most right now?
                </h1>
                <p className="t-caption mt-2">
                  This anchors the protocols we&apos;ll prioritize.
                </p>
                <Choice chips={GOALS} value={goal} onPick={setGoal} />
                <Nav step={step} onBack={goBack} next={() => setStep(2)} />
              </>
            )}

            {step === 2 && (
              <>
                <Eyebrow color="var(--recovery)">Step 2</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  How&apos;s life feeling lately?
                </h1>
                <p className="t-caption mt-2">
                  Calibrating today&apos;s load to your current bandwidth.
                </p>
                <Choice
                  chips={MOOD}
                  value={overwhelm}
                  onPick={(k) =>
                    setOverwhelm(k as "calm" | "some" | "stretched")
                  }
                />
                <Nav step={step} onBack={goBack} next={() => setStep(3)} />
              </>
            )}

            {step === 3 && (
              <>
                <Eyebrow color="var(--sleep)">Step 3</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  How&apos;s your sleep?
                </h1>
                <p className="t-caption mt-2">
                  Sleep-aware adjustments switch on from here.
                </p>
                <Choice
                  chips={SLEEP}
                  value={sleepBaseline}
                  onPick={(k) =>
                    setSleepBaseline(k as "rough" | "ok" | "solid")
                  }
                />
                <Nav step={step} onBack={goBack} next={() => setStep(4)} />
              </>
            )}

            {step === 4 && (
              <>
                <Eyebrow color="var(--vitality)">Step 4</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  Where do you want to focus?
                </h1>
                <p className="t-caption mt-2">
                  Pick any that resonate — these shape what surfaces first.
                </p>
                <Choice
                  chips={FOCUS}
                  value={focus}
                  multi
                  onPick={(k) =>
                    setFocus((f) =>
                      f.includes(k)
                        ? f.filter((x) => x !== k)
                        : [...f, k]
                    )
                  }
                />
                <Nav step={step} onBack={goBack} next={() => setStep(5)} />
              </>
            )}

            {step === 5 && (
              <>
                <Eyebrow>Step 5</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  How experienced are you?
                </h1>
                <p className="t-caption mt-2">
                  Sets the size of your starting system, not the depth of
                  what&apos;s available.
                </p>
                <Choice
                  chips={EXP}
                  value={experience}
                  onPick={(k) =>
                    setExperience(k as "new" | "some" | "deep")
                  }
                />
                <button
                  onClick={() => setHasWearable((v) => !v)}
                  role="switch"
                  aria-checked={hasWearable}
                  aria-label="I wear an Oura, Whoop or Apple Watch"
                  className="press tr-fast mt-3 flex w-full items-center justify-between rounded-[var(--r-md)] p-4"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-[14px] font-medium text-[var(--text-1)]">
                    I wear an Oura / Whoop / Apple Watch
                  </span>
                  <span
                    className="h-6 w-11 rounded-full p-0.5 tr-fast"
                    style={{
                      background: hasWearable
                        ? "var(--vitality)"
                        : "var(--surface-3)",
                    }}
                  >
                    <span
                      className="block h-5 w-5 rounded-full bg-white tr"
                      style={{
                        transform: hasWearable
                          ? "translateX(20px)"
                          : "translateX(0)",
                      }}
                    />
                  </span>
                </button>
                <Nav step={step} onBack={goBack} next={() => setStep(6)} />
              </>
            )}

            {step === 6 && (
              <>
                <Eyebrow color="var(--sleep)">Step 6</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  Sleep & wake times
                </h1>
                <p className="t-caption mt-2">
                  Anchors the timing of every behavior. Change anytime.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div>
                    <Eyebrow>Bedtime</Eyebrow>
                    <input
                      type="time"
                      value={bedtime}
                      onChange={(e) => setBedtime(e.target.value)}
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <Eyebrow>Wake</Eyebrow>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                </div>
                <Nav step={step} onBack={goBack} next={() => setStep(7)} />
              </>
            )}

            {step === 7 && (
              <>
                <Eyebrow color="var(--vitality)">Ready</Eyebrow>
                <h1 className="t-title mt-3 text-[var(--text-1)]">
                  {/* Name the starting pack in the headline — feels
                      personalized (the questionnaire actually mattered)
                      rather than a generic "Your system is ready". For
                      multi-pack starters we keep the generic phrasing
                      since one name would underrepresent the result. */}
                  {packs.length === 1
                    ? `Your starting system: ${packs[0].name}`
                    : `Your system is ready${
                        name.trim() ? `, ${name.trim()}` : ""
                      }.`}
                </h1>
                <p className="t-body mt-3 leading-relaxed">
                  {packs.length === 1
                    ? "We started with one. Your Library has eight more — all one tap away when you're ready."
                    : `${packs.length} protocols, merging into one calm day. It adapts as you go.`}
                </p>
                <div className="card mt-7 p-5">
                  {packs.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3.5 py-3.5"
                      style={{
                        borderTop:
                          i > 0 ? "1px solid var(--hairline)" : "none",
                      }}
                    >
                      <span
                        className="chip h-10 w-10 shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${p.accent} 16%, var(--surface-3))`,
                          color: p.accent,
                        }}
                      >
                        <Icon name={p.icon as IconName} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[var(--text-1)]">
                          {p.name}
                        </p>
                        <p className="t-caption mt-0.5 truncate">
                          {p.tagline}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-[12px] leading-relaxed text-[var(--text-3)]">
                  Educational tool, not medical advice. Consult a
                  clinician before changing your health routine.
                </p>
                <div className="mt-7 space-y-2.5">
                  <Button full onClick={() => finish(true)}>
                    Keep my system across devices
                  </Button>
                  {/* Equal-weight secondary so the choice reads as a
                      genuine fork (not "click the big button to
                      proceed"). A non-technical user testing the
                      flow reported the ghost text felt like fine
                      print they had to ignore. */}
                  <Button
                    full
                    variant="ghost"
                    onClick={() => finish(false)}
                  >
                    Continue without an account
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
