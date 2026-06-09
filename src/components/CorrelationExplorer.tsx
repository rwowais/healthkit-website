"use client";

/**
 * CorrelationExplorer — pick two of your own factors (energy, sleep quality,
 * pillar scores, behaviors done…) and see whether they move together in YOUR
 * data. Honest by construction: Pearson r over paired days, an 8-day floor,
 * and an explicit "pattern, not proof" caveat. Premium feature.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { DailyLog } from "@/lib/types";
import {
  correlate,
  listFactors,
  type FactorKey,
} from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

function Select({
  value,
  onChange,
}: {
  value: FactorKey;
  onChange: (v: FactorKey) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FactorKey)}
      className="tr-fast w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2.5 text-[13.5px] font-semibold text-[var(--text-1)] outline-none"
    >
      {listFactors().map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

export default function CorrelationExplorer({
  logs,
  premium,
}: {
  logs: DailyLog[];
  premium: boolean;
}) {
  const [a, setA] = useState<FactorKey>("sleepQuality");
  const [b, setB] = useState<FactorKey>("energy");

  const res = useMemo(() => correlate(logs, a, b), [logs, a, b]);
  const labelOf = (k: FactorKey) =>
    listFactors().find((f) => f.key === k)?.label ?? k;

  if (!premium) {
    return (
      <Link
        href="/upgrade"
        className="press tr-fast panel relative block overflow-hidden p-5"
      >
        <span
          className="ambient"
          style={{
            background:
              "radial-gradient(130% 90% at 100% 0%, color-mix(in srgb, var(--readiness) 16%, transparent), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--readiness) 16%, var(--surface-3))",
              color: "var(--readiness)",
            }}
          >
            <Icon name="pulse" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow color="var(--readiness)">Correlation explorer</Eyebrow>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-2)]">
              See which factors move together in your own data — like sleep vs.
              energy. <span className="font-semibold text-[var(--text-1)]">Premium.</span>
            </p>
          </div>
          <Icon name="chevron" size={14} className="shrink-0 text-[var(--text-4)]" />
        </div>
      </Link>
    );
  }

  let verdict: { title: string; body: string } | null = null;
  if (a === b) {
    verdict = { title: "Pick two different factors", body: "Choose two distinct things to compare." };
  } else if (res.r == null) {
    verdict =
      res.n < 8
        ? {
            title: "Not enough overlapping days yet",
            body: `${res.n} of 8 days where both were logged. Keep logging both and this fills in.`,
          }
        : {
            title: "Nothing to compare yet",
            body: "One of these hasn't varied enough across your logs to find a pattern.",
          };
  } else if (res.strength === "none") {
    verdict = {
      title: "No clear link — yet",
      body: `Across ${res.n} days, ${labelOf(a).toLowerCase()} and ${labelOf(
        b
      ).toLowerCase()} don't track together in any meaningful way.`,
    };
  } else {
    const dirWord = res.direction === "positive" ? "higher" : "lower";
    // A "weak" r (≈0.25–0.4, often at the n=8 floor) is nowhere near
    // significant — hedge the bold title rather than stating it as fact.
    // Reserve the affirmative headline for moderate+ correlations.
    const affirmative =
      res.direction === "positive"
        ? `They move together`
        : `They move in opposite directions`;
    const hedged =
      res.direction === "positive"
        ? `A faint hint they move together`
        : `A faint hint they move in opposite directions`;
    verdict = {
      title: res.strength === "weak" ? hedged : affirmative,
      body: `On days your ${labelOf(a).toLowerCase()} was higher, your ${labelOf(
        b
      ).toLowerCase()} tended to be ${dirWord} too — a ${res.strength} pattern (r = ${res.r.toFixed(
        2
      )}, across ${res.n} days).`,
    };
  }

  const strong = res.r != null && res.strength !== "none";

  return (
    <div className="panel p-5">
      <Eyebrow color="var(--readiness)">Correlation explorer</Eyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
        Compare any two signals from your own logs.
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Select value={a} onChange={setA} />
        <span className="text-[12px] font-semibold text-[var(--text-3)]">vs</span>
        <Select value={b} onChange={setB} />
      </div>
      {verdict && (
        <div
          className="mt-4 rounded-[var(--r-md)] p-4"
          style={{ background: "var(--surface-2)" }}
        >
          <p
            className="text-[15px] font-bold"
            style={{ color: strong ? "var(--readiness)" : "var(--text-1)" }}
          >
            {verdict.title}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
            {verdict.body}
          </p>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-4)]">
        A pattern in your own logs — not proof that one causes the other.
      </p>
    </div>
  );
}
