"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { derivedInsights } from "@/lib/insights";
import { calculateStreak, weeklyActiveDays } from "@/lib/scoring";
import { biomarkerDef, biomarkerBand } from "@/lib/biomarkers";
import { keystone, behaviorStats, weeklyReview } from "@/lib/intel";
import { getAccess } from "@/lib/entitlements";
import { PremiumPeek } from "@/components/PremiumGate";
import { compileTimeline } from "@/lib/engine";
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

  const review = useMemo(() => weeklyReview(state), [state]);
  const ks = useMemo(() => keystone(state), [state]);
  const topStreaks = useMemo(() => {
    return compileTimeline(state, 0)
      .map((it) => ({
        title: it.title,
        icon: it.icon as IconName,
        ...behaviorStats(state, it.canonicalKey),
      }))
      .filter((b) => b.streak >= 3)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
  }, [state]);

  const nothing =
    insights.length === 0 &&
    !ks &&
    !review &&
    topStreaks.length === 0;

  const access = getAccess(state);
  const gated = !nothing && !access.premium;
  const teaser = ks
    ? `Your data has a clear pattern: "${ks.title}" is driving your best days. See the full picture with Premium.`
    : review
    ? `${review.headline} Your full weekly intelligence is ready.`
    : "Your personalized intelligence is ready — unlock it with Premium.";

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

        {gated && (
          <PremiumPeek teaser={teaser}>
            <div className="space-y-3">
              <div className="panel h-32" />
              <div className="panel h-28" />
            </div>
          </PremiumPeek>
        )}

        {!gated && (
          <>
        {/* Weekly review — calm narrative */}
        {review && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel relative overflow-hidden p-6"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(140% 100% at 50% 0%, color-mix(in srgb, var(--readiness) 22%, transparent), transparent 62%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <Eyebrow color="var(--readiness)">Your week</Eyebrow>
                <span className="text-[12px] font-semibold text-[var(--text-3)]">
                  {review.statLine}
                </span>
              </div>
              <p className="mt-3 text-[19px] font-bold leading-snug text-[var(--text-1)]">
                {review.headline}
              </p>
              <div className="mt-4 space-y-2">
                {review.wins.map((w) => (
                  <div key={w} className="flex items-center gap-2.5">
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                      style={{ background: "var(--surface-3)" }}
                    >
                      <Icon
                        name="check"
                        size={12}
                        className="text-[var(--vitality)]"
                      />
                    </span>
                    <span className="text-[13.5px] text-[var(--text-2)]">
                      {w}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-5 rounded-[var(--r-md)] p-4"
                style={{ background: "var(--surface-2)" }}
              >
                <Eyebrow color="var(--warm)">Next week</Eyebrow>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-1)]">
                  {review.focus}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Keystone — the single behavior that matters most */}
        {ks && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel relative overflow-hidden p-6"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--warm) 22%, transparent), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Icon
                  name="flame"
                  size={14}
                  className="text-[var(--warm)]"
                />
                <Eyebrow color="var(--warm)">Your keystone</Eyebrow>
              </div>
              <p className="mt-3 text-[22px] font-bold leading-snug text-[var(--text-1)]">
                {ks.title}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                On days you do this, your overall score runs{" "}
                <span className="font-bold text-[var(--warm)]">
                  {ks.delta} points higher
                </span>
                . If you protect one behavior, make it this one.
              </p>
            </div>
          </motion.div>
        )}

        {/* Strongest streaks */}
        {topStreaks.length > 0 && (
          <div>
            <Eyebrow>Strongest behaviors</Eyebrow>
            <div className="well mt-3 space-y-1.5 p-1.5">
              {topStreaks.map((b) => (
                <div
                  key={b.title}
                  className="row flex items-center gap-3.5 px-3.5 py-3"
                >
                  <span
                    className="chip h-9 w-9 shrink-0"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--warm)",
                    }}
                  >
                    <Icon name={b.icon} size={17} stroke={1.7} />
                  </span>
                  <span className="flex-1 truncate text-[14px] font-semibold text-[var(--text-1)]">
                    {b.title}
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1 text-[13px] font-bold"
                    style={{ color: "var(--warm)" }}
                  >
                    <Icon name="flame" size={13} />
                    {b.streak}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nothing ? (
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
          </>
        )}
      </div>
    </Shell>
  );
}
