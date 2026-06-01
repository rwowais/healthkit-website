"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { derivedInsights } from "@/lib/insights";
import { calculateStreak, weeklyActiveDays } from "@/lib/scoring";
import { getVacationDates } from "@/lib/storage";
import { biomarkerDef, biomarkerBand } from "@/lib/biomarkers";
import {
  keystone,
  behaviorStats,
  weeklyReview,
  whatWorks,
  nextBestAddition,
  behaviorAdherence,
} from "@/lib/intel";
import { getAccess } from "@/lib/entitlements";
import { UpgradeCTA } from "@/components/PremiumGate";
import ConsistencyCalendar from "@/components/ConsistencyCalendar";
import MoodEnergyTrends from "@/components/MoodEnergyTrends";
import BehaviorReportCard from "@/components/BehaviorReportCard";
import JournalHistory from "@/components/JournalHistory";
import ShareProgressCard from "@/components/ShareProgressCard";
import PersonalRecords from "@/components/PersonalRecords";
import MonthlyReport from "@/components/MonthlyReport";
import OnThisDayCard from "@/components/OnThisDayCard";
import WhenConsistent from "@/components/WhenConsistent";
import PillarDeepDives from "@/components/PillarDeepDives";
import CorrelationExplorer from "@/components/CorrelationExplorer";
import ForecastCard from "@/components/ForecastCard";
import WhatChangedCard from "@/components/WhatChangedCard";
import BenchmarksCard from "@/components/BenchmarksCard";
import GoalsCard from "@/components/GoalsCard";
import ExperimentsCard from "@/components/ExperimentsCard";
import { getTz } from "@/lib/tz";
import { compileTimeline, getSignals } from "@/lib/engine";
import { personalModel, identityReflection } from "@/lib/reflect";
import { Eyebrow, Skeleton, EmptyState } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

interface Insight {
  icon: IconName;
  accent: string;
  text: string;
}

function dateKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const LAG_DAYS = 3;

export default function InsightsPage() {
  const router = useRouter();
  const { state, loading, updateSettings } = useAppState();
  const access = getAccess(state);

  // Time-decayed peek: free / post-trial users still get the intelligence
  // — just on a 3-day delay (a real reason to keep showing up, and a
  // genuine upgrade reason) instead of a blurred wall that removes the
  // daily payoff exactly when the habit is most fragile.
  const intelState = useMemo(() => {
    if (access.premium) return state;
    const d = new Date();
    d.setDate(d.getDate() - LAG_DAYS);
    const cutoff = dateKeyOf(d);
    return {
      ...state,
      dailyLogs: (state.dailyLogs ?? []).filter((l) => l.date <= cutoff),
      // Delay biomarker alerts on the same 3-day lag as everything else,
      // so the "you're seeing a delayed view" banner stays truthful and a
      // free user doesn't get the live "biomarker-aware" signal the
      // paywall sells as Premium.
      biomarkers: (state.biomarkers ?? []).filter((b) => b.date <= cutoff),
    };
  }, [access.premium, state]);

  const streak = useMemo(
    () =>
      calculateStreak(
        intelState.dailyLogs,
        getVacationDates(intelState),
        intelState.settings
      ),
    [intelState]
  );
  const week = useMemo(
    () => weeklyActiveDays(intelState.dailyLogs, intelState.settings),
    [intelState.dailyLogs, intelState.settings]
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

    for (const d of derivedInsights(intelState.dailyLogs)) {
      out.push({ icon: "bulb", accent: "var(--readiness)", text: d });
    }

    // Biomarker attention (calm, not alarming)
    const latestByMetric = new Map<string, number>();
    for (const b of [...intelState.biomarkers].sort((a, c) =>
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
  }, [intelState.dailyLogs, intelState.biomarkers, streak, week]);

  const review = useMemo(
    () => weeklyReview(intelState),
    [intelState]
  );
  const ks = useMemo(() => keystone(intelState), [intelState]);
  const works = useMemo(() => whatWorks(intelState), [intelState]);
  // "Your next habit" — a calm, governed recommendation of the highest-
  // leverage curated behavior the user isn't doing yet. Uses full `state`
  // (not the delayed peek): it's a catalog recommendation, not time-series.
  const rec = useMemo(() => nextBestAddition(state), [state]);
  const adherence = useMemo(() => behaviorAdherence(intelState), [intelState]);
  // Days of real activity logged so far — drives the cold-start
  // "insights forming — ~N to go" countdown (keystone/whatWorks gate at 10).
  const loggedDays = useMemo(
    () =>
      intelState.dailyLogs.filter(
        (l) =>
          l.score > 0 ||
          Object.values(l.behaviorCompletions ?? {}).some(Boolean)
      ).length,
    [intelState.dailyLogs]
  );
  const model = useMemo(() => personalModel(intelState), [intelState]);
  const identity = useMemo(
    () => identityReflection(intelState),
    [intelState]
  );
  const topStreaks = useMemo(() => {
    return compileTimeline(intelState, 0)
      .map((it) => ({
        title: it.title,
        icon: it.icon as IconName,
        ...behaviorStats(intelState, it.canonicalKey),
      }))
      .filter((b) => b.streak >= 3)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
  }, [intelState]);

  const nothing =
    insights.length === 0 &&
    !ks &&
    !works &&
    !review &&
    !identity &&
    model.length === 0 &&
    topStreaks.length === 0;

  const delayed = !access.premium && !nothing;

  // Returning after a gap: the present-tense "what works for you" / keystone /
  // records claims below are computed from data BEFORE the break, so under a
  // "Welcome back" day they read as if the user is currently consistent.
  // Surface a calm framing so they're understood as the pre-break rhythm.
  const returning = useMemo(() => {
    const s = getSignals(state);
    return s.hasHistory && s.gapDays >= 2 && !nothing;
  }, [state, nothing]);

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

        {delayed && (
          <UpgradeCTA
            title="You're seeing a delayed view"
            line="On the free plan, Insights update on a 3-day delay. Premium makes them live — your patterns the moment they form."
          />
        )}

        {returning && (
          <div
            className="rounded-[var(--r-md)] p-4"
            style={{ background: "var(--surface-2)" }}
          >
            <Eyebrow color="var(--warm)">Picking up where you left off</Eyebrow>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">
              You&rsquo;ve been away for a bit — the reflections below are your
              rhythm from <em>before</em> the break. They&rsquo;ll refresh as
              you log again.
            </p>
          </div>
        )}

        {(
          <>
        {/* Identity reflection — who you've become (the emotional anchor) */}
        {identity && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel relative overflow-hidden p-6"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(140% 100% at 50% 0%, color-mix(in srgb, var(--warm) 22%, transparent), transparent 62%)",
              }}
            />
            <div className="relative">
              <Eyebrow color="var(--warm)">Identity</Eyebrow>
              <p className="mt-3 text-[20px] font-bold leading-snug text-[var(--text-1)]">
                {identity.headline}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                {identity.body}
              </p>
            </div>
          </motion.div>
        )}

        {/* What I've learned about you — the compounding personal model */}
        {model.length > 0 && (
          <div>
            <Eyebrow>What I&apos;ve learned about you</Eyebrow>
            <div className="well mt-3 space-y-1.5 p-1.5">
              {model.map((t) => (
                <div
                  key={t.label}
                  className="row flex items-start gap-3.5 px-3.5 py-3"
                >
                  <span
                    className="chip h-9 w-9 shrink-0"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--recovery)",
                    }}
                  >
                    <Icon name={t.icon} size={17} stroke={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--text-1)]">
                      {t.label}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-3)]">
                      {t.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              {review.continuity && (
                <p className="mt-3 text-[13px] italic leading-relaxed text-[var(--text-3)]">
                  {review.continuity}
                </p>
              )}
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

        {/* What changed week-over-week — a calm narrative read. Self-gates
            until two comparable weeks exist. Peek-delayed for free. */}
        <WhatChangedCard state={intelState} />

        {/* Consistency calendar — the days you showed up, over time. Renders
            from the (peek-delayed for free) intelState, once there's enough
            history to be meaningful. */}
        {loggedDays >= 3 && (
          <ConsistencyCalendar
            logs={intelState.dailyLogs}
            tz={getTz(intelState.settings)}
            weeks={12}
          />
        )}

        {/* Share your progress — a calm, opt-in way to save/share an image
            of how consistently you've shown up. Growth feature, so it uses
            full live `state` (not the peek-delayed view): the number a user
            shares should reflect reality, and "active days" is a basic
            engagement stat, not the gated intelligence layer. Self-gates on
            enough activity to be worth sharing. */}
        <ShareProgressCard state={state} />

        {/* Your records — quiet bests to beat (peek-delayed for free, like the
            rest of the page). */}
        <PersonalRecords state={intelState} />

        {/* How you compare — where consistency falls within a built-in
            reference range (NOT peer data; the card says so). Peek-delayed. */}
        <BenchmarksCard state={intelState} />

        {/* Month-in-review — shareable summary of the current month. */}
        <MonthlyReport state={intelState} />

        {/* What you're steering toward — outcome goals and self-experiments.
            These use full live `state` (the user's own targets + check-ins,
            not the gated intelligence layer) so progress reflects reality and
            a brand-new user can set one from day one. */}
        <GoalsCard state={state} onUpdate={updateSettings} />
        <ExperimentsCard state={state} onUpdate={updateSettings} />

        {/* "Your next habit" — the growth counterpart to the friction
            suggestions: the highest-leverage curated behavior the user
            isn't doing yet. Advisory, never pushy; taps through to the
            Library to add it. */}
        {rec && (
          <button
            onClick={() => router.push("/library")}
            className="press tr-fast panel relative w-full overflow-hidden p-6 text-left"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(130% 90% at 100% 0%, color-mix(in srgb, var(--vitality) 20%, transparent), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Icon
                  name="bulb"
                  size={14}
                  className="text-[var(--vitality)]"
                />
                <Eyebrow color="var(--vitality)">Your next habit</Eyebrow>
              </div>
              <p className="mt-3 text-[19px] font-bold leading-snug text-[var(--text-1)]">
                {rec.title}
              </p>
              {rec.rationale && (
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                  {rec.rationale}
                </p>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--vitality)]">
                Add it from the Library
                <Icon name="chevron" size={13} />
              </div>
            </div>
          </button>
        )}

        {/* Reflection set: how you've felt, when you follow through, what's
            sticking, per-pillar deep-dives, the correlation explorer, a
            gentle look-back, and your journal — each self-gates on enough
            data. CorrelationExplorer takes full live logs (it's premium-gated
            internally); everything else uses the peek-delayed intelState. */}
        <MoodEnergyTrends logs={intelState.dailyLogs} />
        <WhenConsistent state={intelState} />
        <BehaviorReportCard rows={adherence} />
        <PillarDeepDives state={intelState} />
        {/* Where your body metrics are heading — confident linear trend
            projection (renders only with a real, well-fit trend). */}
        <ForecastCard state={intelState} />
        <CorrelationExplorer
          logs={access.premium ? state.dailyLogs : intelState.dailyLogs}
          premium={access.premium}
        />
        <OnThisDayCard state={intelState} />
        <JournalHistory logs={intelState.dailyLogs} />

        {/* What matters most — consolidated. Keystone and "Proven for you"
            used to live as twin cards that read as the same idea twice
            (the One Behavior That Matters). Unifying them into a single
            framed section with two sub-cards lets each speak with its
            own evidence (one behavioral, one outcome-correlated) while
            making clear they're facets of the same strategic core. */}
        {(ks || works) && (
          <div>
            <Eyebrow color="var(--warm)">What matters most for you</Eyebrow>
            <div className="mt-3 flex flex-col gap-3.5">
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
                      On the days you do this, you keep{" "}
                      <span className="font-bold text-[var(--warm)]">
                        {ks.delta} {ks.delta === 1 ? "point" : "points"} more
                      </span>{" "}
                      of everything else. If you protect one behavior, make
                      it this one.
                    </p>
                    {/* If the keystone behavior is *also* the outcome-proven
                        one, fold the proof into this card instead of showing
                        a second near-identical card with the same title. */}
                    {works && works.key === ks.key && (
                      <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-3)]">
                        It&rsquo;s also proven in your own check-ins — your{" "}
                        {works.dimension === "energy"
                          ? "energy"
                          : works.dimension === "sleep"
                          ? "sleep"
                          : "energy and sleep"}{" "}
                        runs {works.delta} point{works.delta === 1 ? "" : "s"}{" "}
                        higher on these days.
                      </p>
                    )}
                    <p className="mt-3 text-[12px] font-medium text-[var(--text-4)]">
                      Measured across {ks.days} of your check-ins.
                    </p>
                  </div>
                </motion.div>
              )}

              {works && (!ks || works.key !== ks.key) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="panel relative overflow-hidden p-6"
                >
                  <span
                    className="ambient"
                    style={{
                      background:
                        "radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--recovery) 22%, transparent), transparent 60%)",
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <Icon
                        name="pulse"
                        size={14}
                        className="text-[var(--recovery)]"
                      />
                      <Eyebrow color="var(--recovery)">
                        Proven by your data
                      </Eyebrow>
                    </div>
                    <p className="mt-3 text-[22px] font-bold leading-snug text-[var(--text-1)]">
                      {works.title}
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                      On the days you do this, your{" "}
                      <span className="font-bold text-[var(--recovery)]">
                        {works.dimension === "energy"
                          ? "energy"
                          : works.dimension === "sleep"
                          ? "sleep"
                          : "energy and sleep"}{" "}
                        runs {works.delta} point
                        {works.delta === 1 ? "" : "s"} higher
                      </span>{" "}
                      — measured from your own check-ins, not a generic
                      claim.
                    </p>
                    <p className="mt-3 text-[12px] font-medium text-[var(--text-4)]">
                      Measured across {works.days} of your check-ins.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
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
          <>
            <div className="panel">
              <EmptyState
                icon={<Icon name="bulb" size={24} />}
                title="Patterns are forming"
                body={
                  loggedDays >= 10
                    ? "You've logged enough — no pattern is strong enough to call honestly yet. I'll surface one the moment it is."
                    : loggedDays >= 1
                    ? `You're ${loggedDays} check-in${
                        loggedDays === 1 ? "" : "s"
                      } in — about ${
                        10 - loggedDays
                      } more and your first personalized read can appear. I only call a pattern when it's real.`
                    : "Check in for about a week and your first personalized read appears here — I only call a pattern when it's real."
                }
              />
            </div>
            {/* Premium preview for free users on the empty page — they
                otherwise see a dead screen and may assume the tab is
                broken. Tell them what's coming (live + biomarker-aware)
                and offer the upgrade path now, while interest is fresh. */}
            {!access.premium && (
              <UpgradeCTA
                title="Insights is a Premium feature"
                line="Once you have a week of data, Premium shows your patterns the moment they form — live, biomarker-aware, with weekly review and identity reflection."
              />
            )}
            {/* Cross-link to Body Trends so users discover the body-marker
                surface from the same intelligence-y page. It has no
                nav-bar tab; without this card, returning users have to
                dig through Profile to find it. */}
            <button
              onClick={() => router.push("/biomarkers")}
              className="press tr-fast panel flex w-full items-center gap-3 p-4 text-left"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-sm)]"
                style={{
                  background:
                    "color-mix(in srgb, var(--vitality) 14%, var(--surface-3))",
                  color: "var(--vitality)",
                }}
              >
                <Icon name="pulse" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[var(--text-1)]">
                  Body trends
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
                  Track weight, HRV, resting heart rate — the inputs that
                  make Insights smarter over time.
                </span>
              </span>
              <Icon
                name="chevron"
                size={13}
                className="shrink-0 text-[var(--text-4)]"
              />
            </button>
          </>
        ) : (
          insights.length > 0 && (
            <div>
              <Eyebrow>Other patterns</Eyebrow>
              <div className="mt-3 flex flex-col gap-3.5">
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
            </div>
          )
        )}
          </>
        )}
      </div>
    </Shell>
  );
}
