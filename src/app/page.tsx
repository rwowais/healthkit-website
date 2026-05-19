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
            <span className="h-2 w-2 rounded-full bg-[#08090B]" />
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
            A calm, intelligent operating system for human optimization.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--text-2)]">
            Install longevity protocols, follow an adaptive daily timeline, and
            let the system quietly reshape your day around recovery, sleep, and
            consistency.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="press tr-fast mt-10 rounded-[var(--r-pill)] bg-[var(--text-1)] px-7 py-3.5 text-[15px] font-semibold text-[#08090B]"
          >
            Begin your protocol
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
        <p className="mt-16 text-center text-[12px] leading-relaxed text-[var(--text-4)]">
          Protocolize is an educational tool, not medical advice. Consult a
          clinician before changing your health routine.
        </p>
      </section>
    </div>
  );
}
