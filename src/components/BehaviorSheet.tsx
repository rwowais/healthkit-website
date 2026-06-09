"use client";

import { useMemo, useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import { blockLabel, type TimelineItem } from "@/lib/engine";
import {
  effectiveMinutes,
  nudgeTimeWithinBlock,
  resolveTimeWindow,
  windowBlocks,
  clampToWindow,
  minutesToHM,
  parseHM,
} from "@/lib/time";
import {
  buildAtomRegistry,
  evidenceFraming,
  provenanceLabel,
} from "@/lib/governance";
import type { BehaviorOverride, TimeBlock } from "@/lib/types";

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Evidence-tier badge — an at-a-glance "how settled is the science here"
// signal, so the deep-dive (rationale + evidence + framing) is framed with
// the right confidence. Calm language, no clinical jargon.
const TIER: Record<
  NonNullable<TimelineItem["evidenceTier"]>,
  { label: string; color: string }
> = {
  established: { label: "Established", color: "var(--vitality)" },
  emerging: { label: "Emerging evidence", color: "var(--readiness)" },
  exploratory: { label: "Exploratory", color: "var(--warm)" },
};

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
  onSwap,
  isEnabled = true,
  onSnooze,
  snoozed,
  stackOptions,
  blockLabels,
  settings,
  notificationsEnabled = true,
}: {
  item: TimelineItem | null;
  override: BehaviorOverride | undefined;
  color: string;
  onClose: () => void;
  onChange: (next: BehaviorOverride) => void;
  onToggleEnabled?: () => void;
  /** When provided (Today passes it only for a workout behavior that's still
   *  swappable today), renders a "Swap for a different workout" action so swap
   *  is reachable from the sheet, not just the small inline row chip. */
  onSwap?: () => void;
  isEnabled?: boolean;
  onSnooze?: (mode: "later" | "tomorrow" | null) => void;
  snoozed?: "later" | "tomorrow";
  /** Wake/bed/boundaries — so "move earlier/later" can nudge the actual clock
   *  time (keeping the timeline ordered by time). */
  settings: { wakeTime: string; bedtime: string; blockBoundaries?: { morning: string; afternoon: string; evening: string } };
  /** Other behaviors this one can be stacked after (habit stacking). Each
   *  `key` is the anchor's canonicalKey. Omitted/empty → control hidden. */
  stackOptions?: { key: string; title: string }[];
  /** Custom day-block display names (settings.blockLabels), so the sheet's
   *  "Order in X" / "Why X?" copy matches the user's renamed sections. */
  blockLabels?: { morning?: string; afternoon?: string; evening?: string; anytime?: string };
  /** Global notifications switch (settings.notificationsEnabled). When false,
   *  the per-behavior reminder copy says so instead of promising a notify that
   *  can never fire. */
  notificationsEnabled?: boolean;
}) {
  const [showWhy, setShowWhy] = useState(false);
  if (!item) return null;

  const ov = override ?? {};
  // Highlight the block the behavior is ACTUALLY filed under (item.block —
  // clock-derived, or an explicit pin), not the static catalog block, so the
  // lit "When" pill matches the section the behavior shows under on Today.
  const effBlock = item.block;
  const retimed =
    (!!ov.block && ov.block !== item.recommendedBlock) || !!ov.customTime;
  const days = ov.daysActive ?? item.daysActive ?? new Array(7).fill(true);
  const whyText =
    item.timingReason ??
    `Recommended in the ${blockLabel(
      item.recommendedBlock,
      blockLabels
    ).toLowerCase()} based on the science behind this behavior.`;

  const patch = (p: Partial<BehaviorOverride>) => onChange({ ...ov, ...p });

  // Hard scheduling guardrail (circadian/safety windows): when set, the editor
  // disables the blocks the window forbids and clamps any time the user picks
  // back into the window — so a constrained behavior (e.g. morning light) can't
  // be moved where its science forbids. Soft windows don't restrict here; the
  // engine flags them (item.timingOff) and we show a calm note below.
  const hardWindow = item.timeWindow?.strict
    ? resolveTimeWindow(item, settings)
    : null;
  const allowedBlocks = hardWindow
    ? new Set<TimeBlock>(windowBlocks(item, settings))
    : null;
  const nudge = (delta: number) => {
    const cur =
      effectiveMinutes(
        { ...item, customTime: ov.customTime ?? item.customTime },
        settings
      ) ?? 0;
    let t = nudgeTimeWithinBlock(cur, item.block, delta, settings);
    if (hardWindow) t = minutesToHM(clampToWindow(parseHM(t), item, settings));
    patch({ customTime: t });
  };

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
            {item.evidenceTier && (
              <span
                className="mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                style={{
                  color: TIER[item.evidenceTier].color,
                  background: `color-mix(in srgb, ${TIER[item.evidenceTier].color} 15%, transparent)`,
                }}
              >
                {TIER[item.evidenceTier].label}
              </span>
            )}
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
              // Light the block the item is filed under. With a customTime the
              // engine derives item.block from that clock time, so this lights
              // the block the time falls into (no more "no pill selected while
              // Today files it somewhere"). Tapping a pill still clears the time.
              const on = effBlock === b;
              // A hard window forbids blocks outside its range (e.g. morning
              // light can't go to afternoon/evening) — disable those pills.
              const forbidden = allowedBlocks != null && !allowedBlocks.has(b);
              return (
                <button
                  key={b}
                  disabled={forbidden}
                  onClick={() => {
                    if (forbidden) return;
                    // Pick a block → clear the exact-time pin (the item shows a
                    // time inside the new block) and break any stack anchor, so
                    // "Evening" can't keep showing an afternoon clock.
                    patch({
                      block: b === item.recommendedBlock ? undefined : b,
                      customTime: undefined,
                      stackAfter: undefined,
                    });
                  }}
                  title={
                    forbidden
                      ? `${item.title} stays in its ${blockLabel(
                          item.recommendedBlock,
                          blockLabels
                        ).toLowerCase()} window`
                      : undefined
                  }
                  className="flex-1 rounded-[var(--r-pill)] py-2 text-[12px] font-semibold capitalize tr-fast disabled:cursor-not-allowed"
                  style={{
                    background: on ? color : "transparent",
                    color: on ? "var(--bg)" : "var(--text-3)",
                    opacity: forbidden ? 0.35 : 1,
                  }}
                >
                  {b}
                </button>
              );
            })}
          </div>
          {hardWindow && (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-4)]">
              Held in its{" "}
              {blockLabel(item.recommendedBlock, blockLabels).toLowerCase()}{" "}
              window — {item.timingReason ?? "its timing is part of why it works."}
            </p>
          )}
          {item.timingOff && !hardWindow && (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--warm)]">
              A bit outside its usual window —{" "}
              {item.timingReason ?? "its timing matters a little here."}
            </p>
          )}
          {/* A stacked behavior's timing is owned by its anchor — applyStacks
              rebases it on every compile, so exact-time / nudge controls here
              would be silently discarded. Hide them and say so. */}
          {ov.stackAfter && (
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-3)]">
              Timing follows the habit you stacked this after. Clear the stack
              below (or pick a block above) to give it its own time.
            </p>
          )}
          {!ov.stackAfter && (
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-[12px] text-[var(--text-3)]">
              Or a specific time
            </span>
            <input
              type="time"
              value={ov.customTime ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return patch({ customTime: undefined });
                // Hard window: clamp the typed time back into the allowed range
                // so a constrained behavior can't be set out of its window.
                const m = hardWindow
                  ? clampToWindow(parseHM(v), item, settings)
                  : parseHM(v);
                // Setting an exact time clears any block pin (and stack anchor),
                // mirroring how the block pills clear customTime. Otherwise a
                // stale pin + a new time produce a header that contradicts the
                // clock ("Afternoon · 9:00 AM"): the block must follow the time.
                patch({
                  customTime: minutesToHM(m),
                  block: undefined,
                  stackAfter: undefined,
                });
              }}
              className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-1)] outline-none"
            />
          </div>
          )}

          {/* Move earlier / later nudges the ACTUAL clock time in 15-min
              steps (clamped to this block), so the timeline stays ordered by
              time — no hidden order index that could float a later item above
              an earlier one. The new time shows live in "Or a specific time"
              above. Hidden for "anytime" (no clock) and for stacked items
              (the anchor owns timing). */}
          {item.block !== "anytime" && !ov.stackAfter && (
            <div className="mt-5">
              <p className="t-eyebrow">
                Time in {blockLabel(item.block, blockLabels).toLowerCase()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => nudge(-15)}
                  className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2.5 text-[13px] font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
                >
                  ↑ 15 min earlier
                </button>
                <button
                  onClick={() => nudge(15)}
                  className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2.5 text-[13px] font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
                >
                  ↓ 15 min later
                </button>
              </div>
              {!!ov.customTime && (
                <button
                  onClick={() => patch({ customTime: undefined })}
                  className="press tr-fast mt-2 text-[12px] font-semibold text-[var(--readiness)]"
                >
                  Reset to its usual time
                </button>
              )}
            </div>
          )}

          {/* Habit stacking — anchor this behavior to follow another, so it
              files right after it ("after X, do Y"). Cue-based chaining. */}
          {stackOptions && stackOptions.length > 0 && (
            <div className="mt-5">
              <p className="t-eyebrow">Stack after</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-3)]">
                Do this right after another habit — anchoring a new habit to
                one you already do is what makes it stick.
              </p>
              <select
                aria-label="Stack this behavior after another habit"
                value={ov.stackAfter ?? ""}
                onChange={(e) => {
                  const next = e.target.value || undefined;
                  // Stacking hands timing to the anchor (engine files the
                  // follower right after it, in its block, at its time). Clear
                  // this item's own block/time pin so a stale clock can't
                  // pre-empt the anchor. Clearing the anchor restores defaults.
                  patch(
                    next
                      ? { stackAfter: next, block: undefined, customTime: undefined }
                      : { stackAfter: undefined }
                  );
                }}
                className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-1)] outline-none"
              >
                <option value="">No anchor — use its own time</option>
                {stackOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    After {o.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Snooze for today — "later today" or "tomorrow" (per-day). */}
          {onSnooze && (
            <div className="mt-5">
              <p className="t-eyebrow">Snooze today</p>
              {snoozed ? (
                <div
                  className="mt-2 flex items-center justify-between rounded-[var(--r-md)] p-3"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-[13px] text-[var(--text-2)]">
                    {snoozed === "tomorrow"
                      ? "Hidden until tomorrow"
                      : "Moved to this evening"}
                  </span>
                  <button
                    onClick={() => onSnooze(null)}
                    className="press text-[12px] font-semibold text-[var(--readiness)]"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onSnooze("later")}
                      disabled={!!hardWindow}
                      className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
                    >
                      Later today
                    </button>
                    <button
                      onClick={() => onSnooze("tomorrow")}
                      className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2.5 text-[13px] font-semibold"
                      style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
                    >
                      Tomorrow
                    </button>
                  </div>
                  {hardWindow && (
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-4)]">
                      Held in its{" "}
                      {blockLabel(item.recommendedBlock, blockLabels).toLowerCase()}{" "}
                      window, so it can&apos;t move to later today — Tomorrow
                      still works.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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
              Why {blockLabel(item.block, blockLabels).toLowerCase()}?
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

        {/* Per-behavior reminder toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <Eyebrow>Reminder</Eyebrow>
            <p className="mt-1 text-[12px] text-[var(--text-3)]">
              {notificationsEnabled
                ? "Notify me at this behavior’s time."
                : "Turn on notifications in Profile to use reminders."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={!ov.reminderOff}
            aria-label="Reminder"
            onClick={() =>
              patch({ reminderOff: ov.reminderOff ? undefined : true })
            }
            className="tap-44 tr-fast h-7 w-12 shrink-0 rounded-full p-1"
            style={{
              background: !ov.reminderOff ? color : "var(--surface-3)",
            }}
          >
            <div
              className="tr-fast h-5 w-5 rounded-full bg-white"
              style={{
                transform: !ov.reminderOff
                  ? "translateX(20px)"
                  : "translateX(0)",
              }}
            />
          </button>
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

        {onSwap && (
          <button
            onClick={onSwap}
            className="press tr-fast flex w-full items-center justify-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--hairline-strong)] py-3.5 text-[14px] font-semibold text-[var(--readiness)]"
          >
            <Icon name="arrowRight" size={14} />
            Swap for a different workout today
          </button>
        )}

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
