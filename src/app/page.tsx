"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadState } from "@/lib/storage";
import { Button, Eyebrow } from "@/components/ui";

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
          onClick={() => router.push("/onboarding")}
          className="t-label tr-fast text-[var(--text-1)] hover:opacity-70"
        >
          Open app →
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-28">
        <div
          className="anim-rise mx-auto mb-10 grid h-44 w-44 place-items-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, var(--readiness-soft), transparent 70%)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 0 80px rgba(111,168,245,0.12)",
          }}
        >
          <div
            className="h-24 w-24 rounded-full border-2"
            style={{
              borderColor: "var(--readiness)",
              borderTopColor: "transparent",
              transform: "rotate(45deg)",
            }}
          />
        </div>
        <Eyebrow>Longevity Intelligence</Eyebrow>
        <h1 className="anim-rise d1 mx-auto mt-5 max-w-2xl text-[40px] font-bold leading-[1.08] tracking-tight text-[var(--text-1)] sm:text-[56px]">
          High-end health intelligence for serious self-optimization.
        </h1>
        <p className="anim-rise d2 mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--text-2)]">
          Track sleep, monitor recovery, and follow longevity protocols
          synthesized from Attia, Huberman, and Walker — in a calm, focused
          space built for the long game.
        </p>
        <div className="anim-rise d3 mt-10 flex justify-center">
          <Button onClick={() => router.push("/onboarding")}>
            Begin your protocol
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: "🌙", label: "Sleep", c: "var(--sleep)" },
            { icon: "❤️", label: "Recovery", c: "var(--recovery)" },
            { icon: "🏋️", label: "Training", c: "var(--readiness)" },
            { icon: "💊", label: "Supplements", c: "var(--warm)" },
          ].map((p, i) => (
            <div
              key={p.label}
              className={`card anim-rise d${i + 1} p-6 text-center`}
            >
              <div className="text-[28px]">{p.icon}</div>
              <p
                className="mt-3 text-[13px] font-semibold"
                style={{ color: p.c }}
              >
                {p.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-16 text-center text-[12px] text-[var(--text-4)]">
          Protocolize is an educational tool, not medical advice. Consult a
          clinician before changing your health routine.
        </p>
      </section>
    </div>
  );
}
