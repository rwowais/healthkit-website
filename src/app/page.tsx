"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loadState } from "@/lib/storage";
import { Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

const PILLARS: { icon: IconName; label: string; accent: string }[] = [
  { icon: "moon", label: "Sleep", accent: "var(--sleep)" },
  { icon: "lungs", label: "Recovery", accent: "var(--recovery)" },
  { icon: "pulse", label: "Training", accent: "var(--readiness)" },
  { icon: "pill", label: "Supplements", accent: "var(--warm)" },
];

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const state = loadState();
    if (state.settings.completedOnboarding) router.replace("/today");
    else setChecking(false);
  }, [router]);

  if (checking) return null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-[9px]"
            style={{
              background:
                "linear-gradient(145deg, var(--sleep), var(--readiness))",
            }}
          >
            <span className="h-2 w-2 rounded-full bg-[var(--bg)]" />
          </span>
          <span className="text-[16px] font-bold tracking-tight text-[var(--text-1)]">
            Protocolize
          </span>
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="t-label tr-fast text-[var(--text-1)] hover:opacity-70"
        >
          Sign in →
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mb-10 grid h-44 w-44 place-items-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--readiness) 22%, transparent), transparent 70%)",
            border: "1px solid var(--hairline)",
          }}
        >
          <div
            className="anim-pulse h-24 w-24 rounded-full border-2"
            style={{
              borderColor: "var(--readiness)",
              borderTopColor: "transparent",
              transform: "rotate(45deg)",
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <Eyebrow>Adaptive Protocol OS</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-2xl text-[40px] font-bold leading-[1.08] tracking-tight text-[var(--text-1)] sm:text-[54px]">
            Your daily routine — adapted to how you actually feel today.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--text-2)]">
            Sleep, training, focus, and supplements — quietly organized into one
            calm day that reshapes itself around your recovery and bandwidth.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="press tr-fast mt-10 rounded-[var(--r-pill)] bg-[var(--text-1)] px-7 py-3.5 text-[15px] font-semibold text-[var(--bg)]"
          >
            Build my system
          </button>
        </motion.div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-28">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.5 }}
              className="panel relative overflow-hidden p-6 text-center"
            >
              <span
                className="ambient"
                style={{
                  background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${p.accent} 20%, transparent), transparent 60%)`,
                }}
              />
              <span
                className="chip relative mx-auto h-12 w-12"
                style={{
                  background: `color-mix(in srgb, ${p.accent} 18%, var(--surface-3))`,
                  color: p.accent,
                }}
              >
                <Icon name={p.icon} size={22} />
              </span>
              <p
                className="relative mt-3.5 text-[13px] font-semibold"
                style={{ color: p.accent }}
              >
                {p.label}
              </p>
            </motion.div>
          ))}
        </div>
        {/* Why you can trust this — the honest, evidence-first stance that
            wins a skeptical longevity audience. Phrased to stay durable as
            the product grows (no "never affiliate / never collect" pledges;
            transparency over absolutes). */}
        <div className="mx-auto mt-16 max-w-xl rounded-[var(--r-lg)] bg-[var(--surface-2)] p-6 text-left">
          <p className="t-eyebrow">Why you can trust this</p>
          <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[var(--text-2)]">
            <li>
              Every recommendation is{" "}
              <span className="font-semibold text-[var(--text-1)]">
                evidence-rated
              </span>{" "}
              — we tell you what&rsquo;s well-proven versus still promising.
            </li>
            <li>
              No hype, no fear-marketing. If we ever point you to a product,
              you&rsquo;ll see exactly why — and the evidence behind it.
            </li>
            <li>Your data is yours — export it anytime.</li>
          </ul>
        </div>
        <p className="mt-10 text-center text-[12px] leading-relaxed text-[var(--text-4)]">
          Protocolize is an educational tool, not medical advice. Consult a
          clinician before changing your health routine.
        </p>
        <div className="mt-6 flex justify-center gap-5 text-[12px] text-[var(--text-4)]">
          <a href="/privacy" className="hover:text-[var(--text-3)]">
            Privacy
          </a>
          <a href="/terms" className="hover:text-[var(--text-3)]">
            Terms
          </a>
          <a href="mailto:hello@protocolize.com" className="hover:text-[var(--text-3)]">
            Contact
          </a>
        </div>
      </section>
    </div>
  );
}
