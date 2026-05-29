"use client";

import { useMemo, useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import { blockLabel, type TimelineItem } from "@/lib/engine";
import {
  buildAtomRegistry,
  evidenceFraming,
  provenanceLabel,
} from "@/lib/governance";
import type { BehaviorOverride, TimeBlock } from "@/lib/types";

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * One shared, calm editor for any behavior: rationale, evidence,
 * provenance, and full personalization — when (block + exact time),
 * dose, note, active days, enable/disable — with the "why this slot
 * was recommended" reveal whenever the user moves it.
 */
export default function BehaviorSheet({
  item,
  override,
  color,
  onClose,
  onChange,
  onToggleEnabled,
  isEnabled = true,
}: {
  item: TimelineItem | null;
  override: BehaviorOverride | undefined;
  color: string;
  onClose: () => void;
  onChange: (next: BehaviorOverride) => void;
  onToggleEnabled?: () => void;
  isEnabled?: boolean;
}) {
  const [showWhy, setShowWhy] = useState(false);
  if (!item) return null;

  const ov = override ?? {};
  const effBlock = ov.block ?? item.recommendedBlock;
  const retimed =
    (!!ov.block && ov.block !== item.recommendedBlock) || !!ov.customTime;
  const days = ov.daysActive ?? item.daysActive ?? new Array(7).fill(true);
  const whyText =
    item.timingReason ??
    `Recommended in the ${blockLabel(
      item.recommendedBlock
    ).toLowerCase()} based on the science behind this behavior.`;

  const patch = (p: Partial<BehaviorOverride>) => onChange({ ...ov, ...p });

  return (
    <Sheet open={!!item} onClose={onClose} title={item.title}>
      <div className="space-y-6">
        {/* Identity + rationale */}
        <div className="flex items-start gap-3">
          <span
            className="chip h-12 w-12 shrink-0"
            style={{
              background: `color-mix(in srgb, ${color} 16%, var(--surface-3))`,
              color,
            }}
          >
            <Icon name={item.icon as IconName} size={22} />
          </span>
          <div className="min-w-0">
            <p className="t-body leading-relaxed text-[var(--text-1)]">
              {item.rationale}
            </p>
            {/* Pack-list moved to AboutThisBehavior — the provenance
                helper formats it more carefully ("From Better Sleep"
                vs "Common across X protocols you've installed") with
                proper trust-tier framing. Showing both in the header
                AND in About duplicated the line and exposed raw pack
                names without context. */}
          </div>
        </div>

        {/* When — the customization centerpiece */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow>When</Eyebrow>
            {retimed && (
              <button
                onClick={() =>
                  patch({ block: undefined, customTime: undefined })
                }
                className="press text-[12px] font-semibold text-[var(--readiness)]"
              >
                Reset to recommended
              </button>
            )}
          </div>
          <div
            className="flex gap-1 rounded-[var(--r-pill)] p-1"
            style={{ background: "var(--surface-2)" }}
          >
            {BLOCKS.map((b) => {
              const on = effBlock === b && !ov.customTime;
              return (
                <button
                  key={b}
                  onClick={() =>
                    patch({
                      block: b === item.recommendedBlock ? undefined : b,
                      customTime: undefined,
                    })
                  }
                  className="flex-1 rounded-[var(--r-pill)] py-2 text-[12px] font-semibold capitalize tr-fast"
                  style={{
                    background: on ? color : "transparent",
                    color: on ? "var(--bg)" : "var(--text-3)",
                  }}
                >
                  {b}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-[12px] text-[var(--text-3)]">
              Or a specific time
            </span>
            <input
              type="time"
              value={ov.customTime ?? ""}
              onChange={(e) =>
                patch({ customTime: e.target.value || undefined })
              }
              className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-1)] outline-none"
            />
          </div>

          {/* Why this slot was recommended */}
          {retimed ? (
            <div
              className="mt-3 flex items-start gap-2.5 rounded-[var(--r-md)] p-3.5"
              style={{
                background: `color-mix(in srgb, ${color} 9%, var(--surface-2))`,
              }}
            >
              <Icon
                name="info"
                size={14}
                className="mt-0.5 shrink-0"
                />
              <p className="text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {whyText}{" "}
                <span className="text-[var(--text-3)]">
                  You&apos;ve moved it — that&apos;s fine. The behavior still
                  works; timing just optimizes it.
                </span>
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowWhy((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-3)]"
            >
              <Icon name="info" size={12} />
              Why {blockLabel(item.recommendedBlock).toLowerCase()}?
              <Icon
                name="chevron"
                size={12}
                className={showWhy ? "rotate-90" : ""}
              />
            </button>
          )}
          {!retimed && showWhy && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">
              {whyText}
            </p>
          )}
        </div>

        {/* Dose / target */}
        <div>
          <Eyebrow>Dose / target</Eyebrow>
          <input
            value={ov.dose ?? item.dose ?? ""}
            placeholder="e.g. 2 g, 20 min, 1 capsule"
            onChange={(e) =>
              patch({ dose: e.target.value || undefined })
            }
            className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
          />
        </div>

        {/* Active days */}
        <div>
          <Eyebrow>Active days</Eyebrow>
          <div className="mt-2.5 flex justify-between gap-1.5">
            {DAYS.map((d, i) => {
              const on = days[i];
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = [...days];
                    next[i] = !next[i];
                    patch({ daysActive: next });
                  }}
                  className="press tr-fast h-11 flex-1 rounded-[var(--r-sm)] text-[13px] font-bold"
                  style={{
                    background: on ? color : "var(--surface-2)",
                    color: on ? "var(--bg)" : "var(--text-4)",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Personal note */}
        <div>
          <Eyebrow>Your note</Eyebrow>
          <textarea
            value={ov.note ?? ""}
            placeholder="Why this matters to you, reminders, anything…"
            onChange={(e) => patch({ note: e.target.value || undefined })}
            rows={2}
            className="mt-2 w-full resize-none rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--text-1)] outline-none"
          />
        </div>

        {/* Evidence — with calm evidence-tier framing appended when
            the underlying claim sits in emerging or exploratory
            research. Keeps the rationale section honest without
            adding clinical jargon. */}
        {item.evidence && (
          <div
            className="rounded-[var(--r-md)] p-4"
            style={{ background: "var(--surface-2)" }}
          >
            <Eyebrow color={color}>Why this works</Eyebrow>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
              {item.evidence}
            </p>
            {evidenceFraming(item.evidenceTier) && (
              <p className="mt-2 text-[12px] italic leading-relaxed text-[var(--text-3)]">
                {evidenceFraming(item.evidenceTier)}
              </p>
            )}
          </div>
        )}
        {item.recommendedBy && item.recommendedBy.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.recommendedBy.map((r) => (
              <span
                key={r}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)]"
                style={{ background: "var(--surface-3)" }}
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* About this behavior — calm provenance + suppression context.
            Collapsed by default; one tap reveals provenance ("From your
            Better Sleep protocol" / "Adapted from Morning sunlight" /
            "Your personal behavior — kept just for you"). The section
            ONLY renders when there's something meaningful to say
            (provenance line OR muteReason OR contraindication list);
            otherwise stays out of the way. */}
        <AboutThisBehavior item={item} />

        {onToggleEnabled && (
          <button
            onClick={onToggleEnabled}
            className="press tr-fast w-full rounded-[var(--r-pill)] border border-[var(--hairline-strong)] py-3.5 text-[14px] font-semibold"
            style={{ color: isEnabled ? "var(--alert)" : "var(--text-1)" }}
          >
            {isEnabled ? "Pause this behavior" : "Resume this behavior"}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/**
 * "About this behavior" — the lightweight provenance + suppression
 * surface inside BehaviorSheet. Pulls from the engine's `trustTier`,
 * `fromPacks`, `muteReason`, and `contraindications` fields plus the
 * governance `provenanceLabel()` helper. Renders nothing unless at
 * least one line is meaningful for the user.
 *
 * Voice rules:
 *   - Never says "tier", "governance", "validated", "verified"
 *   - Curated atoms: name the protocol it came from
 *   - Derived atoms: "Adapted from X"
 *   - Custom atoms: "Your personal behavior — kept just for you, not
 *     part of our recommendations."
 *   - Muted atoms: explain WHY in plain language ("Resting — recovery
 *     mode", "Conflict with your fasting protocol", etc.)
 */
function AboutThisBehavior({ item }: { item: TimelineItem }) {
  // Build the atom registry once per open — cheap (it's an in-memory
  // walk) but we still memoize so re-renders don't rebuild it.
  const registry = useMemo(() => buildAtomRegistry(), []);
  const prov = provenanceLabel(
    {
      canonicalKey: item.canonicalKey,
      title: item.title,
      derivedFrom: item.derivedFrom,
      fromPacks: item.fromPacks,
      trustTier: item.trustTier,
    },
    registry
  );
  const hasContra = (item.contraindications ?? []).length > 0;
  // Skip rendering entirely when there's nothing useful to say.
  if (!prov.fullLine && !item.muteReason && !hasContra) return null;
  return (
    <div
      className="rounded-[var(--r-md)] p-4"
      style={{ background: "var(--surface-2)" }}
    >
      <Eyebrow>About this behavior</Eyebrow>
      <div className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
        {prov.fullLine && <p>{prov.fullLine}</p>}
        {item.muteReason && (
          <p className="text-[var(--text-3)]">
            <span className="font-semibold text-[var(--text-2)]">
              Currently resting:
            </span>{" "}
            {humanizeMuteReason(item.muteReason)}
          </p>
        )}
        {hasContra && (
          <p className="text-[var(--text-3)]">
            Some people skip this one based on a few personal factors —
            we leave it to you. (You can adjust those in Profile.)
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Translate engine-internal muteReason strings to calm user-facing
 * copy. The engine writes diagnostic phrases ("conflict pair:
 * 'no-intense' rule is active"); this maps them to one-line calm
 * versions that don't expose internal vocabulary.
 */
/**
 * Friendly labels for restraint rule keys — what the user actually
 * understands the rule to be doing. Anything not listed falls back
 * to a generic explanation.
 */
const RESTRAINT_LABEL: Record<string, string> = {
  "no-intense": "no intense training",
  "delay-first-meal": "delay your first meal",
  "deload-day": "a full deload day",
  "no-cold-post-lift": "no cold post-lift",
};

function humanizeMuteReason(reason: string): string {
  if (reason.startsWith("conflict pair")) {
    // Parse the encoded reason: 'conflict pair: "no-intense" | from: Burnout Recovery'
    const ruleMatch = reason.match(/"([^"]+)"/);
    const packMatch = reason.match(/\| from:\s*(.+)$/);
    const rule = ruleMatch?.[1] ?? "";
    const pack = packMatch?.[1]?.trim() ?? "";
    const ruleLabel = RESTRAINT_LABEL[rule] ?? `the "${rule}" rule`;
    if (pack && ruleLabel) {
      return `Your ${pack} protocol is currently asking for ${ruleLabel} — so this one is on pause today. It'll come back when that protocol does.`;
    }
    if (pack) {
      return `Your ${pack} protocol is currently asking you to skip this one today.`;
    }
    return "Another protocol you have installed asks you to skip this today.";
  }
  if (reason.startsWith("recovery mode"))
    return "Recovery mode — eased so you can rest.";
  if (reason.startsWith("essentials mode"))
    return "Essentials mode — focusing on the highest-leverage items.";
  if (reason.startsWith("rebuild mode"))
    return "Rebuild mode — keeping a small, focused set today.";
  if (reason.startsWith("lighter mode"))
    return "Lighter day — optional behaviors muted.";
  if (reason.startsWith("graduated to maintenance"))
    return "You've held this consistently — we're easing it into the background so it doesn't crowd your day. It still shows up about once a week as a calm check-in.";
  return reason; // Unknown reason — surface verbatim, better than empty.
}
