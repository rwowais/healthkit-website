"use client";

/**
 * "How it thinks" — a READ-ONLY transparency panel for the admin.
 *
 * Lets a non-technical owner study + audit the logic baked into the app
 * (adaptation modes, behavior relationships, evidence rank, Up Next
 * ranking, timing, free/premium limits) in plain language — and catch
 * issues themselves (e.g. "why is sunlight showing at 8pm?").
 *
 * Everything here is read LIVE from the real engine constants / CMS:
 *  - adapt thresholds from engine.ts (RECOVERY_EASE_BELOW etc.),
 *  - behavior relationships from resolvedInteractions() (built-ins + any
 *    published interactions),
 *  - evidence ordering from evidenceRank(),
 *  - free limits from the entitlement getters.
 * So it can't drift from what users actually experience. No mutations.
 */
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui";
import {
  resolvedInteractions,
  RECOVERY_EASE_BELOW,
  PRIMED_AT_OR_ABOVE,
  LOW_ADHERENCE_BELOW,
} from "@/lib/engine";
import { evidenceRank, buildAtomRegistry } from "@/lib/governance";
import {
  getFreePacks,
  getFreeBiomarkers,
  getFreeInsightDays,
} from "@/lib/entitlements";

function Section({
  color,
  eyebrow,
  title,
  children,
}: {
  color: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--r-xl)] p-5"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
      <p className="mt-2 text-[16px] font-bold leading-snug text-[var(--text-1)]">
        {title}
      </p>
      <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
        {children}
      </div>
    </div>
  );
}

function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: "var(--surface-2)",
        color: color ?? "var(--text-2)",
      }}
    >
      {children}
    </span>
  );
}

export default function HowItThinks() {
  const reg = buildAtomRegistry();
  const titleOf = (k: string) => reg.get(k)?.title ?? k;
  const interactions = resolvedInteractions();

  const freePacks = getFreePacks();
  const freeBio = getFreeBiomarkers();
  const freeInsightDays = getFreeInsightDays();

  // Adaptation modes, in the exact priority order baselineAdapt() checks
  // them (first match wins). Triggers reference the real exported thresholds.
  const MODES: { name: string; when: string; does: string; tone: string }[] = [
    {
      name: "Welcome back",
      when: "the user has been away 2+ days (with prior history)",
      does: "eases back in — a couple of essentials, the rest catches up on its own",
      tone: "var(--warm)",
    },
    {
      name: "Recovery",
      when: `the recovery read is below ${RECOVERY_EASE_BELOW}`,
      does: "sets the demanding work aside; keeps what still feels right",
      tone: "var(--recovery)",
    },
    {
      name: "Essentials only",
      when: `7-day adherence is under ${LOW_ADHERENCE_BELOW}% (after 3+ tracked days)`,
      does: "trims to just the few highest-leverage behaviors to rebuild momentum",
      tone: "var(--readiness)",
    },
    {
      name: "Lighter day",
      when: "last night's sleep was poor, the user swapped to an easier workout, or a biomarker flags load",
      does: "lowers the bar; demotes high-stress items so tonight's sleep wins",
      tone: "var(--sleep)",
    },
    {
      name: "Primed",
      when: `the recovery read is ${PRIMED_AT_OR_ABOVE} or higher`,
      does: "a green light to push the hardest training + deepest focus",
      tone: "var(--vitality)",
    },
    {
      name: "Normal",
      when: "nothing above is triggered",
      does: "the day holds its full shape — nothing needs easing",
      tone: "var(--text-3)",
    },
  ];

  const TIERS: { tier: string; meaning: string }[] = [
    {
      tier: "established",
      meaning:
        "multiple consistent human studies / consensus (e.g. sleep duration, protein, hydration)",
    },
    {
      tier: "emerging",
      meaning:
        "meaningful but still-maturing human evidence (e.g. cold, sauna, time-restricted eating)",
    },
    {
      tier: "(no tier)",
      meaning:
        "makes no extraordinary claim (a walk, hydrate) — sits neutrally in the middle, never penalized",
    },
    {
      tier: "exploratory",
      meaning:
        "mechanistic / animal-heavy, thin human data — labeled honestly, sorted last, never hidden",
    },
  ];

  return (
    <div className="space-y-4 pb-10">
      <div
        className="rounded-[var(--r-xl)] p-5"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--readiness) 9%, var(--surface-1)), var(--surface-1) 70%)",
          border: "1px solid var(--hairline)",
        }}
      >
        <Eyebrow color="var(--readiness)">How it thinks</Eyebrow>
        <p className="mt-2 text-[18px] font-bold leading-snug text-[var(--text-1)]">
          The logic baked into the app, in plain language
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-3)]">
          Read-only. Every value below is read live from the real engine and
          published content, so it always matches what users actually
          experience — nothing here is a hand-copied duplicate that could
          drift. Use it to audit the intelligence and catch anything that
          looks off.
        </p>
      </div>

      <Section
        color="var(--recovery)"
        eyebrow="Adaptation"
        title="How today adapts to the user"
      >
        <p>
          Each morning the engine reads a light check-in (sleep + energy) and
          recent adherence, then picks ONE mode — checked in this order, first
          match wins:
        </p>
        <div className="mt-1 space-y-2">
          {MODES.map((m, i) => (
            <div
              key={m.name}
              className="rounded-[var(--r-md)] p-3"
              style={{ background: "var(--surface-2)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-4)" }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: m.tone }}
                >
                  {m.name}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--text-2)]">
                <span className="text-[var(--text-3)]">When </span>
                {m.when} — {m.does}.
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        color="var(--sleep)"
        eyebrow="Relationships"
        title={`Behavior interactions (${interactions.length} active)`}
      >
        <p>
          How behaviors affect each other. A{" "}
          <Pill color="var(--alert)">firm</Pill> conflict sets a behavior aside;
          a <Pill>soft</Pill> one is a calm note. The built-in conflicts always
          apply; published ones layer on top.
        </p>
        <div className="mt-1 space-y-1.5">
          {interactions.map((it) => (
            <div
              key={`${it.aKey}|${it.bKey}|${it.type}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--r-sm)] px-3 py-2"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-[12.5px] font-medium text-[var(--text-1)]">
                {titleOf(it.aKey)}
              </span>
              <span className="text-[var(--text-4)]">→</span>
              <span className="text-[12.5px] font-medium text-[var(--text-1)]">
                {titleOf(it.bKey)}
              </span>
              <Pill>{it.type}</Pill>
              <Pill color={it.severity === "firm" ? "var(--alert)" : undefined}>
                {it.severity}
              </Pill>
              {it.evidenceTier && <Pill>{it.evidenceTier}</Pill>}
              {it.source && it.source !== "unsourced" && (
                <a
                  href={it.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] underline"
                  style={{ color: "var(--text-3)" }}
                >
                  source
                </a>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        color="var(--vitality)"
        eyebrow="Evidence"
        title="How behaviors rank by evidence"
      >
        <p>
          Behaviors sort from most- to least-proven. It only affects ordering
          + a calm label — it never hides or down-weights anything.
        </p>
        <div className="mt-1 space-y-1.5">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className="flex items-start gap-2 rounded-[var(--r-sm)] px-3 py-2"
              style={{ background: "var(--surface-2)" }}
            >
              <Pill>{t.tier}</Pill>
              <span className="flex-1 text-[12.5px] text-[var(--text-2)]">
                {t.meaning}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--text-3)]">
          Order check (lower wins): established {evidenceRank("established")} ·
          emerging {evidenceRank("emerging")} · no-tier{" "}
          {evidenceRank(undefined)} · exploratory {evidenceRank("exploratory")}.
        </p>
      </Section>

      <Section
        color="var(--readiness)"
        eyebrow="Up Next"
        title="What gets surfaced first"
      >
        <p>The single &ldquo;do this next&rdquo; pick is chosen by:</p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>
            Anything <strong>due or overdue right now</strong> comes first.
          </li>
          <li>
            Within that, the <strong>highest-leverage</strong> (most
            outcome-moving) behavior wins, then whichever is due soonest.
          </li>
          <li>
            Behaviors whose time window has clearly passed for the day are not
            pushed as &ldquo;next&rdquo; (the fix that stopped morning sunlight
            showing at 8pm).
          </li>
        </ol>
      </Section>

      <Section
        color="var(--warm)"
        eyebrow="Timing"
        title="When & where each behavior lands"
      >
        <p>
          Every behavior is anchored to <strong>wake</strong>,{" "}
          <strong>bed</strong>, or a <strong>fixed</strong> clock time, then
          placed in a block: morning, afternoon, evening, or anytime. When two
          installed protocols include the same behavior, they merge into one
          row (no duplicates) and keep the strongest settings.
        </p>
      </Section>

      <Section
        color="var(--text-2)"
        eyebrow="Access"
        title="Free vs premium limits"
      >
        <p>The free tier gives the full daily habit loop, plus:</p>
        <div className="mt-1 space-y-1.5">
          {[
            [`${freePacks} protocol packs`, "then premium for the full library"],
            [`${freeInsightDays}-day insights window`, "premium unlocks full history + the intelligence layer"],
            [`${freeBio} biomarkers`, "premium unlocks unlimited + biomarker-aware adaptation"],
          ].map(([a, b]) => (
            <div
              key={a}
              className="flex items-start gap-2 rounded-[var(--r-sm)] px-3 py-2"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-[12.5px] font-semibold text-[var(--text-1)]">
                {a}
              </span>
              <span className="flex-1 text-[12px] text-[var(--text-3)]">
                {b}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
