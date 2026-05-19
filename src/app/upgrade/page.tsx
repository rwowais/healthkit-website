"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getAccess } from "@/lib/entitlements";
import { startCheckout, PRICING, type Plan } from "@/lib/billing";
import { Eyebrow, Skeleton, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

const VALUE: { icon: IconName; t: string; s: string }[] = [
  {
    icon: "bulb",
    t: "The full intelligence layer",
    s: "Keystone, weekly review, correlations & adaptive suggestions — built from your own data.",
  },
  {
    icon: "compass",
    t: "The complete Library",
    s: "Unlimited protocols, plus build & fork your own systems.",
  },
  {
    icon: "pulse",
    t: "Biomarker-aware adaptation",
    s: "Full panel with reference ranges; your day flexes around recovery signals.",
  },
  {
    icon: "flame",
    t: "Unlimited history & trends",
    s: "Every day you track compounds into a clearer picture of you.",
  },
];

export default function UpgradePage() {
  const { state, loading } = useAppState();
  const router = useRouter();
  const toast = useToast();
  const [plan, setPlan] = useState<Plan>("annual");
  const access = useMemo(
    () => (state ? getAccess(state) : null),
    [state]
  );

  if (loading || !access) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-8 w-48" rounded="rounded-full" />
          <Skeleton className="h-64 w-full" rounded="rounded-[var(--r-xl)]" />
        </div>
      </Shell>
    );
  }

  if (access.paid) {
    return (
      <Shell>
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <span
            className="chip h-14 w-14"
            style={{
              background:
                "color-mix(in srgb, var(--vitality) 20%, var(--surface-3))",
              color: "var(--vitality)",
            }}
          >
            <Icon name="check" size={26} />
          </span>
          <h1 className="t-title mt-5 text-[var(--text-1)]">
            You&apos;re Premium
          </h1>
          <p className="t-body mt-2 max-w-[280px]">
            The full intelligence layer is on. Thank you for supporting the
            work.
          </p>
        </div>
      </Shell>
    );
  }

  const plans: Plan[] = ["annual", "monthly", "lifetime"];

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Eyebrow color="var(--readiness)">Protocolize Intelligence</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            Keep the system that&apos;s adapting to you
          </h1>
          {access.inTrial ? (
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
              You have{" "}
              <span className="font-semibold text-[var(--text-1)]">
                {access.trialDaysLeft} day
                {access.trialDaysLeft === 1 ? "" : "s"}
              </span>{" "}
              of full intelligence left. Lock it in so nothing resets.
            </p>
          ) : (
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
              Your starter system stays free forever. Premium unlocks the
              parts that learn from <em>you</em>.
            </p>
          )}
        </motion.div>

        <div className="flex flex-col gap-3">
          {VALUE.map((v, i) => (
            <motion.div
              key={v.t}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05, duration: 0.4 }}
              className="flex items-start gap-3.5"
            >
              <span
                className="chip h-10 w-10 shrink-0"
                style={{
                  background:
                    "color-mix(in srgb, var(--readiness) 14%, var(--surface-3))",
                  color: "var(--readiness)",
                }}
              >
                <Icon name={v.icon} size={19} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-1)]">
                  {v.t}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-3)]">
                  {v.s}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2.5">
          {plans.map((p) => {
            const on = plan === p;
            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className="press tr-fast flex-1 rounded-[var(--r-md)] p-4 text-left"
                style={{
                  background: on
                    ? "color-mix(in srgb, var(--readiness) 12%, var(--surface-2))"
                    : "var(--surface-2)",
                  boxShadow: on
                    ? "inset 0 0 0 1.5px var(--readiness)"
                    : "none",
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                  {p}
                </p>
                <p className="mt-1 text-[18px] font-bold text-[var(--text-1)]">
                  {PRICING[p].price}
                  <span className="text-[12px] font-medium text-[var(--text-3)]">
                    {PRICING[p].per}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                  {PRICING[p].note}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => {
              const r = startCheckout(plan);
              if (!r.ok) toast.show(r.reason ?? "Not available yet");
            }}
            className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-4 text-[15px] font-semibold text-[#08090B]"
          >
            Start Premium
          </button>
          <button
            onClick={() => router.push("/today")}
            className="press tr-fast w-full py-2 text-center text-[13px] font-medium text-[var(--text-3)]"
          >
            Continue on the free plan
          </button>
          <p className="px-2 text-center text-[11px] leading-relaxed text-[var(--text-4)]">
            Cancel anytime. Your data is always yours — export whenever you
            like. Educational tool, not medical advice.
          </p>
        </div>
      </div>
    </Shell>
  );
}
