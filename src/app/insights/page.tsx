"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { derivedInsights } from "@/lib/insights";
import { calculateStreak, weeklyActiveDays } from "@/lib/scoring";
import { biomarkerDef, biomarkerBand } from "@/lib/biomarkers";
import { Eyebrow, Skeleton, EmptyState } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

interface Insight {
  icon: IconName;
  accent: string;
  text: string;
}

export default function InsightsPage() {
  const { state, loading } = useAppState();

  const streak = useMemo(
    () => calculateStreak(state.dailyLogs),
    [state.dailyLogs]
  );
  const week = useMemo(
    () => weeklyActiveDays(state.dailyLogs),
    [state.dailyLogs]
  );

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];

    if (streak >= 3)
      out.push({
        icon: "flame",
        accent: "var(--warm)",
        text: `You've shown up ${streak} days running. Habit formation accelerates sharply after the first week — you're past the hardest part.`,
      });

    if (week >= 5)
      out.push({
        icon: "check",
        accent: "var(--vitality)",
        text: `${week} of the last 7 days active. This is the consistency band where real physiological adaptation happens.`,
      });

    for (const d of derivedInsights(state.dailyLogs)) {
      out.push({ icon: "bulb", accent: "var(--readiness)", text: d });
    }

    // Biomarker attention (calm, not alarming)
    const latestByMetric = new Map<string, number>();
    for (const b of [...state.biomarkers].sort((a, c) =>
      a.date.localeCompare(c.date)
    ))
      latestByMetric.set(b.metric, b.value);
    for (const [metric, value] of latestByMetric) {
      const def = biomarkerDef(metric);
      if (!def || def.direction === "range") continue;
      const band = biomarkerBand(def, value);
      if (band.label === "Watch") {
        out.push({
          icon: "pulse",
          accent: "var(--recovery)",
          text: `${def.label} is worth a closer look (${value} ${def.unit}). ${def.why}`,
        });
        break;
      }
    }

    return out;
  }, [state.dailyLogs, state.biomarkers, streak, week]);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-28 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-28 w-full" rounded="rounded-[var(--r-xl)]" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div>
          <Eyebrow color="var(--readiness)">Intelligence</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Insights</h1>
          <p className="t-caption mt-2 leading-relaxed">
            Patterns surfaced from your own data — only when there&apos;s
            enough signal to be honest about it.
          </p>
        </div>

        {insights.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={<Icon name="bulb" size={24} />}
              title="Patterns are forming"
              body="Track consistently for about a week and your first personalized correlations will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {insights.map((ins, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="panel relative overflow-hidden p-5"
              >
                <span
                  className="ambient"
                  style={{
                    background: `radial-gradient(110% 80% at 0% 0%, color-mix(in srgb, ${ins.accent} 18%, transparent), transparent 60%)`,
                  }}
                />
                <div className="relative flex gap-4">
                  <span
                    className="chip h-11 w-11 shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${ins.accent} 18%, var(--surface-3))`,
                      color: ins.accent,
                    }}
                  >
                    <Icon name={ins.icon} size={20} />
                  </span>
                  <p className="text-[14.5px] leading-relaxed text-[var(--text-1)]">
                    {ins.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
