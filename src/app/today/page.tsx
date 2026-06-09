"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import * as haptic from "@/lib/haptics";
import { setBadge } from "@/lib/appBadge";
import { supplementsForBlock } from "@/lib/supplements";
import SupplementBlockCard from "@/components/SupplementBlockCard";
import DailyReflection from "@/components/DailyReflection";
import DailyCheckInCard from "@/components/today/DailyCheckInCard";
import BulkMoveSheet from "@/components/today/BulkMoveSheet";
import WorkoutSwapSheet from "@/components/today/WorkoutSwapSheet";
import WeekAhead from "@/components/today/WeekAhead";
import MorningBriefing from "@/components/today/MorningBriefing";
import MilestoneMoment from "@/components/today/MilestoneMoment";
import WeeklyGoal from "@/components/today/WeeklyGoal";
import QuickAdd from "@/components/today/QuickAdd";
import StreakFreeze from "@/components/today/StreakFreeze";
import QuickLog from "@/components/today/QuickLog";
import { useAppState } from "@/hooks/useAppState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { getLogForDate, getVacationDates } from "@/lib/storage";
import { calculateStreak } from "@/lib/scoring";
import { getPendingConflict } from "@/lib/datasource";
import {
  compileTimeline,
  applySwaps,
  injectOneOffs,
  applySnoozes,
  applyStacks,
  sortTimeline,
  adapt,
  shapeTimeline,
  masteredKeys,
  freshlyMastered,
  blockIntelligence,
  isDone,
  timelineProgress,
  blockLabel,
  leverageTag,
  upNextMessage,
  getSignals,
  type TimelineItem,
  type LeverageTag,
} from "@/lib/engine";
import {
  isWorkoutBehavior,
  availableWorkoutAlternatives,
} from "@/lib/workouts";
import {
  currentBlock,
  effectiveMinutes,
  fmtClock,
  behaviorStats,
  suggestions,
  upNextRank,
  compareUpNext,
  isActionable,
  keystone,
  weeklyReview,
  isOvernight,
  type Suggestion,
} from "@/lib/intel";
import { windowBlocks } from "@/lib/time";
import {
  getTz,
  dateKeyInTz,
  dayIndexOfKeyInTz,
  addDaysToKey,
  nowMinutesInTz,
} from "@/lib/tz";
import { identityReflection } from "@/lib/reflect";
import { reflectionPrompt } from "@/lib/prompts";
import BehaviorSheet from "@/components/BehaviorSheet";
import { Skeleton, Eyebrow, Sheet, Button } from "@/components/ui";
import { getAccess } from "@/lib/entitlements";
import { Icon, type IconName } from "@/components/ui/icons";
import type { TimeBlock } from "@/lib/types";

const MODE_ACCENT: Record<string, string> = {
  normal: "var(--readiness)",
  essentials: "var(--warm)",
  recovery: "var(--recovery)",
  lighter: "var(--sleep)",
  rebuild: "var(--recovery)",
  primed: "var(--vitality)",
};
const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];
const TONE_COLOR: Record<LeverageTag["tone"], string> = {
  accent: "var(--readiness)",
  recovery: "var(--recovery)",
  sleep: "var(--sleep)",
  warm: "var(--warm)",
  vitality: "var(--vitality)",
  muted: "var(--text-4)",
};

/** Daypart-aware ambient tint for atmospheric depth. */
function daypartTint(cb: TimeBlock): string {
  if (cb === "morning") return "var(--vitality)";
  if (cb === "afternoon") return "var(--readiness)";
  return "var(--sleep)";
}

/** Human progression phrase — no mechanical N/total. */
function progressionPhrase(
  done: number,
  total: number,
  cb: TimeBlock
): string {
  if (total === 0) return "Nothing scheduled";
  if (done === total) return "Day fully closed";
  if (done === 0)
    return cb === "evening"
      ? "Evening — a quiet start is still a start"
      : "Day ahead — open and unhurried";
  const r = done / total;
  if (r >= 0.75) return "Strong finish in reach";
  if (r >= 0.4) return "In flow — momentum holding";
  return cb === "evening" ? "Winding down" : "Momentum building";
}

/** Human relative time vs now (minutes). */
function relTime(t: number | null, now: number): string {
  if (t == null) return "Anytime";
  const d = t - now;
  if (d <= -90) return "Earlier — still worth it";
  if (d <= 10) return "Now";
  if (d < 60) return `In ${d} min`;
  const h = Math.round(d / 60);
  return `In ~${h}h`;
}

function greeting(cb: string, overnight: boolean) {
  // Driven from the SAME wake-anchored source as the block header so the
  // two can never contradict (no "Good morning" over an "Evening — NOW"
  // header). Past bedtime, pre-wake → a calm "Good night".
  if (overnight) return "Good night";
  if (cb === "morning") return "Good morning";
  if (cb === "afternoon") return "Good afternoon";
  return "Good evening";
}

function Check({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
      style={{ boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--text-4)" }}
    >
      {on && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {on && (
        <svg
          className="relative"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  );
}

export default function TodayPage() {
  const {
    state,
    loading,
    toggleBehavior,
    swapBehavior,
    clearSwap,
    toggleSupplement,
    bulkCheckSupplements,
    setSupplementsSkipped,
    updateSleepLog,
    updateRatings,
    installPack,
    setBehaviorOverride,
    updateSettings,
    setSnooze,
    useStreakFreeze,
    refresh,
  } = useAppState();
  const router = useRouter();
  const settings = state.settings;
  const redirectedRef = useRef(false);

  // Pull-to-refresh: at scroll-top, dragging down triggers a cloud
  // reload + a soft haptic. The hook handles all the gesture
  // mechanics (rubber-banding, threshold, minimum-show window).
  const { containerRef: pullRef, state: pullState } = usePullToRefresh(
    async () => {
      haptic.light();
      await refresh();
      haptic.success();
    }
  );

  // Visibility refresh: when the user returns to the app after being
  // away for 30s+, silently re-fetch state so the timeline reflects
  // whatever they did on another device (or the latest mastery /
  // suggestions / adapt mode).
  useVisibilityRefresh(() => {
    refresh();
  });

  // The live per-minute "now" signal (`nowMin`) is defined just below, once
  // `tz` is known; it drives all clock-derived state and the re-renders that
  // keep Today live while the page sits open.

  // Onboarding guard — a returning user lands here after auth, but a
  // genuinely new account (cloud-loaded, no onboarding) gets sent to
  // build their system first. Fire once so a focus/visibility resync
  // can't bounce a mid-session user back to onboarding.
  useEffect(() => {
    if (
      !loading &&
      !state.settings.completedOnboarding &&
      !redirectedRef.current &&
      // Don't bounce to onboarding while a sync-conflict choice is
      // pending — the held local state is intentionally not authoritative
      // yet, and the prompt must resolve first.
      !getPendingConflict()
    ) {
      redirectedRef.current = true;
      router.replace("/onboarding");
    }
  }, [loading, state.settings.completedOnboarding, router]);

  // Timezone-consistent with the engine + storage: every date-key and
  // "now" on Today is derived from getTz(settings) (the user's saved zone),
  // NOT the device clock — so the day the UI reads/writes always matches
  // the day the engine logs to, even after a flight near midnight. When the
  // device zone equals the saved zone (the usual case) this is identical to
  // the old device-based values.
  const tz = useMemo(() => getTz(settings), [settings]);
  // Live "now" (minutes since local midnight in the saved tz), refreshed every
  // minute so the time-derived state below — current block, overnight rest, Up
  // Next, relative times — advances on its own while the page sits open
  // (crossing bedtime flips Today into the rest state with no tap). Replaces a
  // throwaway minute-tick whose re-render couldn't refresh these useMemos
  // because their deps excluded any time signal.
  const [nowMin, setNowMin] = useState(() => nowMinutesInTz(tz));
  useEffect(() => {
    setNowMin(nowMinutesInTz(tz)); // resync immediately when the tz changes
    const id = setInterval(() => setNowMin(nowMinutesInTz(tz)), 60_000);
    return () => clearInterval(id);
  }, [tz]);
  const cb = useMemo(() => currentBlock(settings, nowMin), [settings, nowMin]);
  // Streak shown on Today is recomputed from the logs at render (same as
  // Insights), NOT read from the persisted state.currentStreak — so a user
  // returning after a long gap is never greeted with a stale flame that
  // collapses on their first tap. The persisted value updates on next mutation.
  const liveStreak = useMemo(
    () => calculateStreak(state.dailyLogs, getVacationDates(state), settings),
    [state, settings]
  );

  // Persist snooze/dismiss so a refresh doesn't resurrect everything the
  // user deliberately cleared (it felt broken, not adaptive). Snooze is
  // scoped to today; dismissed suggestions persist by id.
  const todayKey = dateKeyInTz(tz);
  const readLS = (k: string): string[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(k) || "[]");
    } catch {
      return [];
    }
  };
  const [snoozed, setSnoozed] = useState<string[]>(() =>
    readLS(`pz:snz:${todayKey}`)
  );
  const [dismissed, setDismissed] = useState<string[]>(() =>
    readLS("pz:dsm")
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        `pz:snz:${todayKey}`,
        JSON.stringify(snoozed)
      );
    } catch {
      /* non-fatal */
    }
  }, [snoozed, todayKey]);
  useEffect(() => {
    try {
      localStorage.setItem("pz:dsm", JSON.stringify(dismissed));
    } catch {
      /* non-fatal */
    }
  }, [dismissed]);
  // Per-day dismissal of the check-in "read" — so the card morphs into its
  // advisory read after both taps, then recedes once acknowledged (mirrors
  // the snooze pattern; resets each day).
  const [checkInAcked, setCheckInAcked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(`pz:cia:${todayKey}`) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`pz:cia:${todayKey}`, checkInAcked ? "1" : "0");
    } catch {
      /* non-fatal */
    }
  }, [checkInAcked, todayKey]);
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  // Edit-mode for the timeline. Off by default so the primary "tap to
  // complete" affordance stays uncontaminated; flipping it on reveals
  // drag handles and multi-select checkboxes. Drag while editing reassigns
  // a behavior's block; dropping into the *recommended* block doesn't
  // prompt, but moving away from it surfaces a calm explanation rather
  // than silently overriding the science behind the timing.
  const [editMode, setEditMode] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverBlock, setDragOverBlock] = useState<TimeBlock | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  /**
   * Mobile move menu — HTML5 drag-and-drop is broken on touch devices
   * (iOS Safari + Android Chrome don't fire dragstart from touch),
   * so we also expose a tap-to-move flow: tap the handle, get a
   * popover with the four time blocks, tap target → move. Works
   * identically on desktop. The menu's keyed by the item's
   * canonicalKey so only one is open at a time.
   */
  const [moveMenuKey, setMoveMenuKey] = useState<string | null>(null);
  // Bulk-action bar destination picker — at iPhone-SE widths the
  // inline "→ Morning / Afternoon / Evening / Anytime" pills
  // wrapped to 3 rows next to Snooze + Clear. Collapsed into a
  // single "Move to…" button that opens this picker.
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  /**
   * Swap-workout sheet — when the user taps "Swap workout" on a
   * scheduled workout row, this holds the canonicalKey of the
   * original. The sheet lists installed workout alternatives;
   * tapping one calls swapBehavior(date, original, replacement)
   * and closes. null = sheet closed.
   */
  const [swapForKey, setSwapForKey] = useState<string | null>(null);
  // Close the move menu when the user taps anywhere else. We listen on
  // pointerdown (covers touch + mouse + pen) at the document level so
  // the menu can't get stuck open behind a scroll or another row tap.
  // The menu's own buttons stop propagation so this doesn't fire from
  // inside it.
  useEffect(() => {
    if (!moveMenuKey) return;
    const close = () => setMoveMenuKey(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [moveMenuKey]);
  /**
   * A move that requires confirmation. Set when the user drags a
   * behavior to a block that doesn't match its recommendedBlock. Holds
   * everything we need to commit and a per-key rationale so each
   * behavior speaks with its own science instead of a generic
   * block-level message.
   */
  const [pendingMove, setPendingMove] = useState<{
    items: {
      key: string;
      title: string;
      reason: string; // the specific timingReason for THIS behavior
    }[];
    toBlock: TimeBlock;
  } | null>(null);

  // Fallback rationale when a behavior in the catalog hasn't been
  // hand-curated with a timingReason yet. Block-level copy ensures
  // the message is still meaningful instead of empty.
  const fallbackBlockReason = (block: TimeBlock): string => {
    switch (block) {
      case "morning":
        return "Morning timing anchors the circadian rhythm — the strongest lever for sleep, mood, and energy.";
      case "afternoon":
        return "Afternoon timing balances energy across the day and avoids interfering with sleep.";
      case "evening":
        return "Evening timing supports wind-down and recovery — earlier slots can blunt the effect.";
      case "anytime":
        return "This behavior doesn't depend on a specific time of day.";
    }
  };

  /**
   * Commit a block re-time. Resolves the override structure for each
   * key — preserving customTime so the user's exact-clock choice isn't
   * wiped — and writes them all in one pass.
   */
  const commitBlockMove = (
    moves: { key: string }[],
    toBlock: TimeBlock
  ) => {
    for (const m of moves) {
      const cur = state.behaviorOverrides?.[m.key] ?? {};
      setBehaviorOverride(m.key, {
        ...cur,
        block: toBlock,
        // Re-derive the time on a move: drop the old exact pin so the item
        // shows a time INSIDE the new block (the engine fills the block's
        // representative time) instead of keeping a stale clock from where it
        // used to live — e.g. a 7:30am item moved to evening no longer reads
        // "Evening · 7:30 AM". Moving also breaks any habit-stack anchor.
        customTime: undefined,
        stackAfter: undefined,
      });
    }
  };

  /**
   * Centralized request-to-move. Surfaces the confirm sheet for any
   * move that contradicts a recommended block; commits immediately
   * for moves into the recommended block or to anytime (the gentle
   * fallback). The sheet renders the per-behavior timingReason so
   * each behavior speaks with its own science — melatonin says
   * "before bed", morning sunlight says "circadian anchor", etc.
   *
   * Behaviors whose recommendedBlock is "anytime" are intentionally
   * flexible (e.g., Omega-3 with food); we never warn on those even
   * when they happen to be slotted in the morning by default.
   */
  const requestBlockMove = (
    moves: {
      key: string;
      title: string;
      recommendedBlock: TimeBlock;
      timingReason?: string;
    }[],
    toBlock: TimeBlock
  ) => {
    if (moves.length === 0) return;
    // Hard time-window guard: a strict-window behavior (morning sunlight,
    // wind-down, …) can't be moved to a block its window doesn't reach — the
    // engine clamps it straight back, leaving a contradictory override behind.
    // Drop those moves so the Today move-menu / bulk-move match the editor's
    // disabled blocks instead of silently no-op'ing.
    const allowed = moves.filter((m) => {
      const it = timeline.find((t) => t.canonicalKey === m.key);
      if (it?.timeWindow?.strict) {
        return windowBlocks(it, state.settings).includes(toBlock);
      }
      return true;
    });
    if (allowed.length === 0) return;
    const contradicts = allowed.filter(
      (m) =>
        m.recommendedBlock !== toBlock && m.recommendedBlock !== "anytime"
    );
    if (contradicts.length === 0 || toBlock === "anytime") {
      commitBlockMove(allowed, toBlock);
      return;
    }
    setPendingMove({
      items: contradicts.map((m) => ({
        key: m.key,
        title: m.title,
        // Prefer the curated per-behavior reason; fall back to a
        // generic block-level explanation if the catalog didn't
        // provide one (custom packs, AI drafts pre-curation).
        reason: m.timingReason ?? fallbackBlockReason(m.recommendedBlock),
      })),
      toBlock,
    });
  };
  // Acknowledged-mastery set: a behavior that's been graduated to
  // maintenance gets ONE calm celebratory moment, then disappears into
  // the lighter cadence. Local storage so the cloud mutation stays
  // minimal; we never want a "you graduated!" surprise on a new device
  // either, so the ack is also unique per-key.
  const [masteryAcked, setMasteryAcked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(
        JSON.parse(localStorage.getItem("pz:mastered-ack") || "[]")
      );
    } catch {
      return new Set();
    }
  });
  // One-time calm note when the trial auto-extended — surface the
  // kindness instead of doing it silently. Local-only ack so the cloud
  // mutation stays minimal; tied to the exact extension timestamp so a
  // *second* future extension still surfaces fresh.
  const [trialExtAcked, setTrialExtAcked] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("pz:trial-ext-ack");
    } catch {
      return null;
    }
  });
  const showTrialExtension =
    !!state.settings.trialExtendedAt &&
    trialExtAcked !== state.settings.trialExtendedAt;
  // Reverse-trial legibility: the user clicked "Start my 14 days" in onboarding
  // but Today never acknowledged the trial — no banner, no countdown. A calm
  // status line keeps the clock visible (the whole conversion mechanic).
  const access = getAccess(state);
  const ackTrialExtension = () => {
    const t = state.settings.trialExtendedAt ?? "";
    try {
      localStorage.setItem("pz:trial-ext-ack", t);
    } catch {
      /* non-fatal */
    }
    setTrialExtAcked(t);
  };
  const [offset, setOffset] = useState(0);
  const [weekOpen, setWeekOpen] = useState(false);
  const selectedDate = useMemo(
    () => addDaysToKey(dateKeyInTz(tz), -offset),
    [tz, offset]
  );
  const isToday = offset === 0;
  // Scrubbing off "today" makes the day read-only, but the sticky bulk-action
  // bar + move/swap sheets aren't per-row gated like the inline handles — so
  // their actions could write Snooze / a global override onto a frozen past
  // day. Collapse all edit/move/swap state whenever we leave today.
  useEffect(() => {
    if (!isToday) {
      setEditMode(false);
      setSelectedKeys(new Set());
      setBulkMoveOpen(false);
      setSwapForKey(null);
      setMoveMenuKey(null);
    }
  }, [isToday]);
  // Past bedtime but before the pre-dawn run-up to wake: a calm "rest"
  // state, NOT the resurrected evening block. Drives the header greeting,
  // suppresses the Up Next hero, and gates the partial-close copy.
  const overnight = useMemo(
    () => isToday && isOvernight(settings, nowMin),
    [isToday, settings, nowMin]
  );
  const selDayIdx = useMemo(
    () => dayIndexOfKeyInTz(tz, selectedDate),
    [tz, selectedDate]
  );
  const dateLabel = useMemo(() => {
    if (offset === 0) return "Today";
    if (offset === 1) return "Yesterday";
    return new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [offset, selectedDate]);
  const log = useMemo(
    () => getLogForDate(state, selectedDate),
    [state, selectedDate]
  );
  const [detail, setDetail] = useState<TimelineItem | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const sleepQ = log.sleepLog?.sleepQuality ?? null;
  const energy = log.energyLevel ?? null;

  const adaptation = useMemo(() => adapt(state), [state]);
  const sig = useMemo(() => getSignals(state), [state]);
  const ks = useMemo(() => keystone(state), [state]);
  const timeline = useMemo(() => {
    const items = compileTimeline(state, selDayIdx);
    // Apply per-day workout swaps BEFORE shapeTimeline so the
    // adaptation pass sees the user's actual intent (e.g. don't
    // mute the replacement during essentials mode just because the
    // original was lev-2).
    const swapped = applySwaps(items, log);
    const shaped = shapeTimeline(swapped, isToday ? adaptation.mode : "normal", {
      keystoneKey: ks?.key,
      mastered: masteredKeys(state, selectedDate),
    });
    // Per-day plan, applied after shaping so one-offs are always visible and
    // snoozes operate on the final list: inject today-only behaviors, then
    // hide/relocate snoozed ones. sortTimeline re-establishes clock order
    // (injectOneOffs appends and applySnoozes relocates, both leaving the
    // array out of order), then habit stacking runs LAST so it owns the final
    // within-block adjacency ("after X, do Y"). Pass settings to applySnoozes
    // so a "later" snooze can't shove a hard-window item past its window.
    return applyStacks(
      sortTimeline(
        applySnoozes(
          injectOneOffs(shaped, log, state.behaviorOverrides),
          log,
          settings
        ),
        settings
      ),
      state.behaviorOverrides,
      log.snoozes
    );
  }, [state, adaptation.mode, selDayIdx, isToday, ks, selectedDate, log]);

  // Keep the open detail sheet bound to the LIVE timeline item, not the
  // frozen snapshot captured when the row was tapped. Without this, editing
  // the behavior's block/time inside the sheet updates the stored override
  // (and the list behind the sheet) but the sheet itself keeps rendering the
  // OLD block — the "tap Afternoon, nothing highlights, it doesn't move" bug,
  // since the When pill + "Time in…/Why…" copy all key off item.block. Fall
  // back to the snapshot if the item has left the timeline (e.g. just
  // disabled or filtered out) so the sheet stays open and usable.
  const detailItem = useMemo(
    () =>
      detail
        ? timeline.find((t) => t.canonicalKey === detail.canonicalKey) ??
          detail
        : null,
    [detail, timeline]
  );

  // Just-graduated behaviors today. We render their titles (from the
  // full pre-shape timeline) so the toast can name what tipped over —
  // anonymous "you mastered something" is colder than "Morning sunlight
  // is in maintenance now." Only celebrate ones the user hasn't already
  // acknowledged.
  const freshlyMasteredToShow = useMemo(() => {
    if (!isToday) return [];
    const fresh = freshlyMastered(state, selectedDate);
    if (fresh.size === 0) return [];
    const fullTimeline = compileTimeline(state, selDayIdx);
    const out: { key: string; title: string }[] = [];
    for (const k of fresh) {
      if (masteryAcked.has(k)) continue;
      const it = fullTimeline.find((i) => i.canonicalKey === k);
      out.push({ key: k, title: it?.title ?? k });
    }
    return out;
  }, [isToday, state, selectedDate, selDayIdx, masteryAcked]);

  // ── Weekly review + monthly identity, surfaced on Today ──
  // These retention assets otherwise live only on the Insights tab the
  // calm weekly user rarely visits. Surface them as calm POINTER cards
  // (a freshness nudge that deep-links to the full, already-gated view on
  // Insights) — shown one at a time, yielding to the higher-priority
  // trial / mastery moments, so Today never stacks into a dashboard.
  const review = useMemo(() => weeklyReview(state), [state]);
  const identity = useMemo(() => identityReflection(state), [state]);
  const weekStamp = String(
    Math.floor(new Date(todayKey + "T00:00:00").getTime() / (86400000 * 7))
  );
  const monthKey = todayKey.slice(0, 7);
  const [weekReviewAcked, setWeekReviewAcked] = useState<string | null>(() => {
    try {
      return localStorage.getItem("pz:wr-ack");
    } catch {
      return null;
    }
  });
  const [identityAcked, setIdentityAcked] = useState<string | null>(() => {
    try {
      return localStorage.getItem("pz:id-ack");
    } catch {
      return null;
    }
  });
  const reflectionsOk =
    isToday && !showTrialExtension && freshlyMasteredToShow.length === 0;
  const showIdentity = reflectionsOk && !!identity && identityAcked !== monthKey;
  const showWeekly =
    reflectionsOk && !showIdentity && !!review && weekReviewAcked !== weekStamp;
  const ackWeekReview = () => {
    try {
      localStorage.setItem("pz:wr-ack", weekStamp);
    } catch {
      /* non-fatal */
    }
    setWeekReviewAcked(weekStamp);
  };
  const ackIdentity = () => {
    try {
      localStorage.setItem("pz:id-ack", monthKey);
    } catch {
      /* non-fatal */
    }
    setIdentityAcked(monthKey);
  };

  const ackMastery = (keys: string[]) => {
    const next = new Set(masteryAcked);
    for (const k of keys) next.add(k);
    setMasteryAcked(next);
    try {
      localStorage.setItem(
        "pz:mastered-ack",
        JSON.stringify([...next])
      );
    } catch {
      /* non-fatal */
    }
  };

  const prog = useMemo(
    () => timelineProgress(timeline, log),
    [timeline, log]
  );

  // App icon badge: number of behaviors still to do today. Only set
  // for *today* (past/future scrubber views don't represent
  // actionable now-work). Cleared on day-complete so the user sees
  // a clean icon as their reward, not a "0" sitting there. Honors
  // settings.disableAppBadge — when the user opts out, we force-clear
  // the badge on every render so a stale number from a previous
  // session doesn't linger. The helper is no-op on platforms that
  // don't support the API.
  const badgeDisabled = state.settings.disableAppBadge === true;
  useEffect(() => {
    if (badgeDisabled) {
      setBadge(0);
      return;
    }
    if (!isToday) return;
    const remaining = Math.max(0, prog.total - prog.done);
    setBadge(remaining);
  }, [isToday, prog.done, prog.total, badgeDisabled]);
  const ksItem = useMemo(
    () =>
      ks ? timeline.find((i) => i.canonicalKey === ks.key) ?? null : null,
    [ks, timeline]
  );
  // A day isn't "fully closed" until its supplement stacks are handled
  // too — every scheduled supplement either taken or skipped today.
  // Mirrors the per-block rule so the day-level celebration never fires
  // over an untouched stack.
  const allSuppHandledToday = useMemo(() => {
    const comp = log.supplementCompletions ?? {};
    const skips = new Set(log.supplementSkips ?? []);
    for (const block of BLOCKS) {
      const supps = supplementsForBlock(
        state.supplements ?? [],
        block,
        selDayIdx,
        state.settings.safetyFlags ?? {}
      );
      for (const s of supps) {
        if (!comp[s.id] && !skips.has(s.id)) return false;
      }
    }
    return true;
  }, [log, state.supplements, state.settings.safetyFlags, selDayIdx]);
  // Scheduled-supplement progress for the selected day (done = taken OR
  // skipped). Lets a SUPPLEMENT-ONLY day (no behaviors) still reach "Day
  // complete" and lets the progression headline report the stack instead of
  // "Nothing scheduled" while supplement cards render right below it.
  const suppProgToday = useMemo(() => {
    const comp = log.supplementCompletions ?? {};
    const skips = new Set(log.supplementSkips ?? []);
    let total = 0;
    let done = 0;
    for (const block of BLOCKS) {
      for (const s of supplementsForBlock(
        state.supplements ?? [],
        block,
        selDayIdx,
        state.settings.safetyFlags ?? {}
      )) {
        total++;
        if (comp[s.id] || skips.has(s.id)) done++;
      }
    }
    return { done, total };
  }, [log, state.supplements, state.settings.safetyFlags, selDayIdx]);
  const dayComplete =
    isToday &&
    // Behaviors drive completion when present; otherwise a supplement-only day
    // completes once every scheduled supplement is handled.
    (prog.total > 0 ? prog.done === prog.total : suppProgToday.total > 0) &&
    allSuppHandledToday;

  /**
   * First-day soft entry: if the user finished onboarding mid-day, the
   * default "Up next: strength training in 2h" + 0% progress framing
   * reads as "you're already behind on a routine you never started" —
   * the opposite of the calm/safe contract from onboarding. So on the
   * very first calendar day, IF there's already a behavior whose
   * scheduled time has passed AND they haven't completed anything yet,
   * we replace the high-pressure surface with an acknowledgement.
   * Drops naturally as soon as they tick one item OR the calendar
   * rolls over. Morning signups (no past items yet) are unaffected.
   */
  const firstDaySoft = useMemo(() => {
    if (!isToday) return false;
    const trial = state.settings.trialStartDate;
    if (!trial) return false;
    // Saved-tz calendar day (same frame as selectedDate/isToday/now), so the
    // day-1 "joining mid-day" gate matches the rest of Today even when the
    // device zone differs from the saved zone. dateKeyInTz uses Intl in the
    // saved zone, so it still avoids the 5pm-PT UTC-substring pitfall.
    const localToday = dateKeyInTz(tz);
    const localTrial = dateKeyInTz(tz, new Date(trial));
    if (localTrial !== localToday) return false;
    if (prog.done > 0) return false; // engaged → resume normal
    const now = nowMin;
    return timeline.some((it) => {
      const m = effectiveMinutes(it, settings);
      return m != null && m < now;
    });
  }, [isToday, state.settings.trialStartDate, prog.done, timeline, settings, tz, nowMin]);

  /** The most-leveraged morning behavior — what tomorrow "kicks off with". */
  const tomorrowFirstFocus = useMemo(() => {
    if (!firstDaySoft) return null;
    const morningCandidates = timeline.filter(
      (it) => !it.muted && it.block === "morning"
    );
    if (morningCandidates.length === 0)
      return timeline.find((it) => !it.muted) ?? null;
    return [...morningCandidates].sort(
      (a, b) => b.leverage - a.leverage
    )[0];
  }, [firstDaySoft, timeline]);

  // Partial close: in the evening, a user who moved *some* things should
  // be met with acknowledgement, not the same anxious "Up next" pressure.
  // The product preaches consistency over perfection — so it must reward
  // it, not withhold approval until 100%.
  const partialClose =
    isToday &&
    !dayComplete &&
    !overnight &&
    cb === "evening" &&
    prog.total > 0 &&
    prog.done > 0;

  const upNext = useMemo(() => {
    // Past bedtime (overnight): the day is done — never promote an action.
    // The calm rest card renders instead of an Up Next hero.
    if (overnight) return null;
    // Don't promote a behavior as the "next action" once its window is well
    // past — e.g. morning sunlight at 8pm, or a noon workout still surfaced
    // at 9pm. Two guards, both of which keep the item in the timeline and
    // only stop it being the Up Next HERO:
    //   (1) block-behind: drop a timed item 2+ blocks behind the current one;
    //   (2) clock-stale: drop anything overdue by more than STALE_MIN, so a
    //       9-hours-past workout can never be the "do this next" card.
    const blockOrder: Record<string, number> = {
      morning: 0,
      afternoon: 1,
      evening: 2,
    };
    const cbIdx = blockOrder[cb] ?? 0;
    const windowGone = (b: string) =>
      b in blockOrder && blockOrder[b] <= cbIdx - 2;
    const now = nowMin;
    const STALE_MIN = 90; // overdue by more than this → its window has passed
    // Wake-relative so a bed-anchored item that resolves past midnight (e.g. a
    // 1:00am wind-down) isn't read as ~23h overdue while the user is still in
    // the prior evening — rebase both onto [wake, wake+1440).
    const [wh, wm] = (settings.wakeTime || "7:00").split(":").map(Number);
    const wakeM = (wh || 0) * 60 + (wm || 0);
    const rel = (x: number) => (x < wakeM ? x + 1440 : x);
    const tooStale = (i: TimelineItem) => {
      const m = effectiveMinutes(i, settings);
      return m != null && rel(now) - rel(m) > STALE_MIN;
    };
    const candidates = timeline.filter(
      (i) =>
        !i.muted &&
        !isDone(log, i.canonicalKey) &&
        !snoozed.includes(i.canonicalKey) &&
        // Guardrail / "avoid" / reminder behaviors (e.g. caffeine cutoff)
        // are constraints you hold, not actions you tap to do next — they
        // stay in the timeline but never become the Up Next hero.
        isActionable(i) &&
        !windowGone(i.block) &&
        !tooStale(i)
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) =>
      compareUpNext(upNextRank(a, settings, now), upNextRank(b, settings, now))
    )[0];
  }, [timeline, log, settings, snoozed, cb, overnight, nowMin]);

  const activeSuggestions = useMemo<Suggestion[]>(
    () => suggestions(state).filter((s) => !dismissed.includes(s.id)),
    [state, dismissed]
  );

  // Saved-tz day, derived from selectedDate (the same key the scrubber +
  // timeline use), so the eyebrow can't show a different calendar day than the
  // rest of Today after travel. Parsing YYYY-MM-DD at local midnight renders
  // that exact calendar date (tz-stable).
  const displayDate = useMemo(
    () =>
      new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [selectedDate]
  );

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-44" rounded="rounded-full" />
          <Skeleton className="h-28 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-40 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  // Supplements are now Browse-only and independent of behavior packs, so a
  // user whose day is all supplements (no behaviors today) must NOT get the
  // "blank canvas / discover protocols" empty state — they have a real stack to
  // take. Only show the empty state when there's nothing scheduled at all.
  const hasSupplementsToday = (
    ["morning", "afternoon", "evening", "anytime"] as TimeBlock[]
  ).some(
    (b) =>
      supplementsForBlock(
        state.supplements ?? [],
        b,
        selDayIdx,
        state.settings.safetyFlags ?? {}
      ).length > 0
  );
  if (timeline.length === 0 && !hasSupplementsToday) {
    // Two empty-state cases: vacation mode on (intentional break), or
    // no packs installed (needs onboarding nudge). Different copy + CTA.
    const onVacation = !!state.settings.vacationMode;
    // How many days the current break has run (inclusive), from the open
    // vacation period's start — a gentle "Day N" so a long rest still feels
    // acknowledged rather than blank.
    let breakDay = 0;
    if (onVacation) {
      const open = [...(state.settings.vacationPeriods ?? [])]
        .reverse()
        .find((p) => p.end === null);
      if (open?.start) {
        const todayKey = dateKeyInTz(getTz(state.settings));
        const [ay, am, ad] = open.start.split("-").map(Number);
        const [by, bm, bd] = todayKey.split("-").map(Number);
        if (ay && by) {
          const diff = Math.round(
            (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000
          );
          breakDay = Math.max(1, diff + 1);
        }
      }
    }
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <div>
            <Eyebrow>{displayDate}</Eyebrow>
            <h1 className="t-title mt-2 text-[var(--text-1)]">
              {greeting(cb, overnight)}
              {state.settings.name ? `, ${state.settings.name}` : ""}
            </h1>
          </div>
          <div className="panel flex flex-col items-center px-6 py-14 text-center">
            <span
              className="chip mb-5 h-14 w-14"
              style={{
                background: onVacation
                  ? "color-mix(in srgb, var(--warm) 18%, var(--surface-3))"
                  : "var(--surface-3)",
                color: onVacation ? "var(--warm)" : "var(--text-2)",
              }}
            >
              <Icon name={onVacation ? "moon" : "compass"} size={24} />
            </span>
            <p className="t-section text-[var(--text-1)]">
              {onVacation ? "You're on a break" : "Your day is a blank canvas"}
            </p>
            {onVacation && breakDay > 0 && (
              <p className="t-eyebrow mt-1.5 text-[var(--warm)]">
                Day {breakDay}
              </p>
            )}
            <p className="t-caption mt-2 max-w-[280px] leading-relaxed">
              {onVacation
                ? "Your day is cleared and your streak is paused — your data is safe, and your full system returns the moment you end the break."
                : "Install a protocol and Protocolize will assemble an adaptive daily system for you."}
            </p>
            <Link
              href={onVacation ? "/profile#break" : "/protocols#discover"}
              className="press tr-fast mt-6 rounded-[var(--r-pill)] bg-[var(--text-1)] px-6 py-3 text-[14px] font-semibold text-[var(--bg)]"
            >
              {onVacation ? "End break in Profile" : "Discover protocols"}
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const accent = MODE_ACCENT[adaptation.mode];

  return (
    <Shell>
      <div
        ref={pullRef}
        className="flex flex-col gap-7"
        style={{
          // Translate the entire day surface down by the pull amount
          // so the user feels they're dragging the content, not
          // pulling against an invisible barrier.
          transform: pullState.pulling
            ? `translateY(${Math.min(80, pullState.progress * 70)}px)`
            : pullState.refreshing
            ? "translateY(60px)"
            : undefined,
          transition: pullState.pulling
            ? "none"
            : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          overscrollBehavior: "contain",
        }}
      >
        {/* Pull-to-refresh indicator — calm spinner that materializes
            above the content as the user drags. Hidden when synced. */}
        {(pullState.pulling || pullState.refreshing) && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-12 transition-opacity"
            style={{
              top: 0,
              opacity: Math.min(1, pullState.progress),
            }}
          >
            <span
              className="grid place-items-center h-9 w-9 rounded-full"
              style={{
                background: "var(--surface-3)",
                color: "var(--readiness)",
                transform: pullState.refreshing
                  ? undefined
                  : `rotate(${pullState.progress * 360}deg)`,
                animation: pullState.refreshing
                  ? "ptr-spin 0.8s linear infinite"
                  : undefined,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                <polyline points="21 4 21 11 14 11" />
              </svg>
            </span>
          </div>
        )}
        {/* Greeting + date scrubber */}
        <div>
          <Eyebrow>{displayDate}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {greeting(cb, overnight)}
            {state.settings.name ? `, ${state.settings.name}` : ""}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setOffset((o) => Math.min(o + 1, 30))}
              aria-label="Previous day"
              className="press grid h-11 w-11 place-items-center rounded-full text-[var(--text-3)]"
              style={{ background: "var(--surface-2)" }}
            >
              <Icon name="chevron" size={14} className="rotate-180" />
            </button>
            <span className="min-w-[110px] text-center text-[13px] font-semibold text-[var(--text-2)]">
              {dateLabel}
            </span>
            <button
              onClick={() => setOffset((o) => Math.max(o - 1, 0))}
              disabled={isToday}
              aria-label="Next day"
              className="press grid h-11 w-11 place-items-center rounded-full text-[var(--text-3)] disabled:opacity-30"
              style={{ background: "var(--surface-2)" }}
            >
              <Icon name="chevron" size={14} />
            </button>
            {!isToday && (
              <button
                onClick={() => setOffset(0)}
                className="press tap-44 text-[12px] font-semibold text-[var(--readiness)]"
              >
                Back to today
              </button>
            )}
            {isToday && liveStreak >= 2 && (
              <span
                className="ml-auto flex items-center gap-1 rounded-[var(--r-pill)] px-2.5 py-1 text-[12px] font-bold"
                style={{
                  background:
                    "color-mix(in srgb, var(--warm) 16%, var(--surface-2))",
                  color: "var(--warm)",
                }}
              >
                <Icon name="flame" size={12} />
                {liveStreak}
              </span>
            )}
          </div>
          <button
            onClick={() => setWeekOpen(true)}
            className="press tap-44 mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--readiness)]"
          >
            The week ahead
            <Icon name="chevron" size={12} />
          </button>
        </div>

        {/* Milestone moment — rare, celebratory; only on the day a mark is
            freshly crossed, dismissed via "Mark it" (records the id). */}
        <MilestoneMoment
          state={state}
          onCelebrate={(id) =>
            updateSettings({
              celebratedMilestones: [
                ...(state.settings.celebratedMilestones ?? []),
                id,
              ],
            })
          }
        />

        {/* Morning briefing — a calm frame for the day (morning block only,
            hidden once the day's already closed). */}
        {!dayComplete && (
          <MorningBriefing
            state={state}
            items={timeline}
            cb={cb}
            overnight={overnight}
            isToday={isToday}
          />
        )}

        {/* Weekly active-days goal ring (only when a goal is set). */}
        {isToday && <WeeklyGoal state={state} />}

        {/* Planned rest day — streak-protected, timeline still available. */}
        {isToday && (state.settings.restDays ?? []).includes(selectedDate) && (
          <div className="panel flex items-center gap-3 p-4">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
              style={{
                background:
                  "color-mix(in srgb, var(--recovery) 16%, var(--surface-3))",
                color: "var(--recovery)",
              }}
            >
              <Icon name="moon" size={17} />
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
              <span className="font-semibold text-[var(--text-1)]">
                Rest day.
              </span>{" "}
              Your streak is protected today — do as much or as little as you
              like.
            </p>
          </div>
        )}

        {/* Streak freeze — protect a streak on an off day (self-gates on a
            real streak at risk + an available token; flips to a confirmation
            once spent). Not on a planned rest day (already protected). */}
        {isToday &&
          !(state.settings.restDays ?? []).includes(selectedDate) && (
            <StreakFreeze
              state={state}
              dateKey={selectedDate}
              streak={liveStreak}
              log={log}
              onUse={useStreakFreeze}
            />
          )}

        {/* Day complete — calm reward */}
        {dayComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative overflow-hidden p-7 text-center"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--vitality) 26%, transparent), transparent 62%)",
              }}
            />
            <div className="relative flex flex-col items-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 200,
                  damping: 14,
                }}
                className="chip h-16 w-16"
                style={{
                  background:
                    "color-mix(in srgb, var(--vitality) 22%, var(--surface-3))",
                  color: "var(--vitality)",
                }}
              >
                <Icon name="check" size={30} stroke={2.2} />
              </motion.span>
              <h2 className="t-title mt-5 text-[var(--text-1)]">
                You&apos;ve closed the day
                {state.settings.name ? `, ${state.settings.name}` : ""}
              </h2>
              <p className="t-body mt-2.5 max-w-[300px] leading-relaxed">
                Every behavior, done. This is the quiet, compounding work
                that actually changes a healthspan. Rest well.
              </p>
            </div>
          </motion.div>
        )}

        {/* Partial close — acknowledgement, not pressure */}
        {partialClose && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative overflow-hidden p-7 text-center"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--warm) 22%, transparent), transparent 62%)",
              }}
            />
            <div className="relative flex flex-col items-center">
              <span
                className="chip h-14 w-14"
                style={{
                  background:
                    "color-mix(in srgb, var(--warm) 20%, var(--surface-3))",
                  color: "var(--warm)",
                }}
              >
                <Icon name="flame" size={26} />
              </span>
              <h2 className="t-section mt-4 text-[var(--text-1)]">
                You moved {prog.done} thing{prog.done === 1 ? "" : "s"}{" "}
                today
              </h2>
              <p className="t-body mt-2 max-w-[300px] leading-relaxed">
                That&apos;s the compounding work — showing up beats a
                perfect score. Anything still open is there if you want
                it, no pressure.
              </p>
            </div>
          </motion.div>
        )}

        {/* Adaptive banner — focal. Gated to TODAY: adapt()/getSignals()/
            keystone() are computed from current state with no selectedDate
            dependency, so showing them over a scrubbed past day mixed today's
            "Recovery mode / Easing" read with yesterday's timeline. */}
        {!dayComplete && isToday && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="panel relative overflow-hidden p-6"
        >
          <span
            className="ambient"
            style={{
              background: `radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, ${accent} 22%, transparent), transparent 60%)`,
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: accent }}
              />
              <Eyebrow color={accent}>Operating summary</Eyebrow>
            </div>
            <h2 className="t-section mt-3 text-[var(--text-1)]">
              {firstDaySoft
                ? `Welcome${
                    state.settings.name?.trim()
                      ? `, ${state.settings.name.trim()}`
                      : ""
                  }.`
                : adaptation.headline}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
              {firstDaySoft
                ? "You're joining mid-day — that's fine. Tomorrow's the natural start. For today, do whatever fits; nothing's expected of you yet."
                : adaptation.tone}
            </p>

            {/* Signal chips — the system's read on you */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                {
                  k: "Recovery",
                  // "High" is reserved for the same cutoff the engine calls
                  // "Primed" (78) so the chip can't say High on a day the
                  // engine declined to call primed; 60–77 reads "Good".
                  v:
                    sig.recoveryProxy == null
                      ? "Building"
                      : sig.recoveryProxy >= 78
                      ? "High"
                      : sig.recoveryProxy >= 60
                      ? "Good"
                      : sig.recoveryProxy >= 45
                      ? "Moderate"
                      : "Easing",
                  // Never flash a red deficit on the exact day the engine
                  // is choosing to protect the user — low recovery reads
                  // as a calm "Easing" in the recovery hue, not an alert.
                  c:
                    sig.recoveryProxy == null
                      ? "var(--text-3)"
                      : sig.recoveryProxy >= 78
                      ? "var(--vitality)"
                      : sig.recoveryProxy >= 45
                      ? "var(--readiness)"
                      : "var(--recovery)",
                },
                {
                  k: "Sleep",
                  v:
                    sig.sleepQuality == null
                      ? "—"
                      : sig.sleepQuality >= 4
                      ? "Strong"
                      : sig.sleepQuality === 3
                      ? "Steady"
                      : "Light",
                  c: "var(--sleep)",
                },
                {
                  k: "Focus",
                  // Don't name a keystone the app is muting today (e.g. strength
                  // suppressed by a no-intense conflict shows "Resting today" in
                  // the list below) — that contradicts itself on one screen.
                  v: ksItem && !ksItem.muted ? ksItem.title : "Consistency",
                  c: "var(--warm)",
                },
              ].map((chip) => (
                <span
                  key={chip.k}
                  className="flex items-center gap-1.5 rounded-[var(--r-pill)] px-3 py-1.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: chip.c }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    {chip.k}
                  </span>
                  <span className="max-w-[120px] truncate text-[12px] font-semibold text-[var(--text-1)]">
                    {chip.v}
                  </span>
                </span>
              ))}
            </div>

            {!firstDaySoft && (
              <div className="mt-5">
                {prog.essentials > 0 && (
                  <div className="mb-2.5 flex items-center gap-1.5">
                    {Array.from({ length: prog.essentials }).map((_, i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 flex-1 rounded-full"
                        initial={false}
                        animate={{
                          backgroundColor:
                            i < prog.essentialsDone
                              ? accent
                              : "var(--surface-3)",
                        }}
                        transition={{
                          duration: 0.5,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium leading-snug text-[var(--text-2)]">
                    {progressionPhrase(
                      prog.total > 0 ? prog.done : suppProgToday.done,
                      prog.total > 0 ? prog.total : suppProgToday.total,
                      cb
                    )}
                  </p>
                  {prog.essentials > 0 && (
                    <span className="shrink-0 text-[12px] font-semibold text-[var(--text-3)]">
                      {prog.essentialsDone === prog.essentials
                        ? "Essentials secured"
                        : prog.essentialsDone === 0
                        ? `${prog.essentials} essentials`
                        : `${prog.essentialsDone} of ${prog.essentials} secured`}
                    </span>
                  )}
                </div>
              </div>
            )}
            {adaptation.reasons.length > 0 && (
              <div className="mt-4">
                {/* Top reason shown inline — not hidden behind a tap.
                    This audience wants the *why* behind the read visible
                    (e.g. Attia publicly dissects why his recovery number
                    is what it is). The expander holds any remaining ones. */}
                <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                    style={{ background: accent }}
                  />
                  <span>{adaptation.reasons[0]}</span>
                </p>
                {adaptation.reasons.length > 1 && (
                  <>
                    <button
                      onClick={() => setShowWhy((v) => !v)}
                      className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-3)]"
                    >
                      <Icon name="info" size={12} />
                      More on today
                      <Icon
                        name="chevron"
                        size={12}
                        className={showWhy ? "rotate-90" : ""}
                      />
                    </button>
                    {showWhy && (
                      <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2.5 space-y-1.5 overflow-hidden"
                      >
                        {adaptation.reasons.slice(1).map((r) => (
                          <li
                            key={r}
                            className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]"
                          >
                            <span
                              className="h-1 w-1 rounded-full"
                              style={{ background: accent }}
                            />
                            {r}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
        )}

        {/* Trial extension — one-time calm note. The engagement-gated
            auto-extend was silent until now; surfacing it once makes the
            kindness *felt* (not just unmonetized). Dismissing stamps the
            local ack so it never reappears for this same extension. */}
        {isToday && !showTrialExtension && access.inTrial && (
          <div
            className="flex items-center justify-between gap-3 rounded-[var(--r-md)] px-4 py-2.5"
            style={{
              background:
                "color-mix(in srgb, var(--vitality) 8%, var(--surface-1))",
              border: "1px solid var(--hairline)",
            }}
          >
            <span className="text-[12.5px] text-[var(--text-2)]">
              Premium trial — {access.trialDaysLeft}{" "}
              {access.trialDaysLeft === 1 ? "day" : "days"} of full intelligence
              left.
            </span>
            <button
              onClick={() => router.push("/upgrade")}
              className="press tr-fast shrink-0 text-[12px] font-semibold text-[var(--vitality)]"
            >
              Details
            </button>
          </div>
        )}

        {isToday && showTrialExtension && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[var(--r-xl)] p-5"
            style={{
              background:
                "linear-gradient(155deg, color-mix(in srgb, var(--vitality) 11%, var(--surface-1)), var(--surface-1) 70%)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="chip h-9 w-9 shrink-0"
                style={{
                  background:
                    "color-mix(in srgb, var(--vitality) 18%, var(--surface-3))",
                  color: "var(--vitality)",
                }}
              >
                <Icon name="sparkle" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--text-1)]">
                  We extended your trial a week
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
                  The patterns aren&apos;t quite ready to read yet — take
                  a few more days to see what fits before anything changes.
                </p>
                <button
                  onClick={ackTrialExtension}
                  className="press tap-44 tr-fast mt-3 rounded-[var(--r-pill)] px-3.5 py-1.5 text-[11.5px] font-semibold"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-2)",
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Mastery graduation — the one-time celebration when a behavior
            crosses 21+ days of streak with high adherence. Without this
            the system silently shifts it to a lighter cadence, which
            reads as "did I forget to do my routine?" The whole point of
            mastery is that it's a milestone; the surface should *say so*
            once, then quietly recede. */}
        {isToday && freshlyMasteredToShow.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[var(--r-xl)] p-5"
            style={{
              background:
                "linear-gradient(155deg, color-mix(in srgb, var(--warm) 14%, var(--surface-1)), var(--surface-1) 70%)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, var(--warm) 18%, transparent), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Icon
                  name="flame"
                  size={14}
                  className="text-[var(--warm)]"
                />
                <Eyebrow color="var(--warm)">Maintenance mode</Eyebrow>
              </div>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text-1)]">
                {freshlyMasteredToShow.length === 1
                  ? `“${freshlyMasteredToShow[0].title}” is yours now.`
                  : `${freshlyMasteredToShow.length} behaviors are yours now.`}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                {freshlyMasteredToShow.length === 1
                  ? "You've held it long and consistently enough that we'll stop nudging — it'll surface lightly, on a weekly spot-check, so you keep the gain without the friction."
                  : "You've held these long and consistently enough that we'll stop nudging — they'll surface lightly on a weekly spot-check, so you keep the gains without the friction."}
              </p>
              {freshlyMasteredToShow.length > 1 && (
                <ul className="mt-2 space-y-1">
                  {freshlyMasteredToShow.map((m) => (
                    <li
                      key={m.key}
                      className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]"
                    >
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ background: "var(--warm)" }}
                      />
                      {m.title}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() =>
                  ackMastery(freshlyMasteredToShow.map((m) => m.key))
                }
                className="press tr-fast tap-44 mt-3 rounded-[var(--r-pill)] px-3.5 py-1.5 text-[11.5px] font-semibold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-2)",
                }}
              >
                Earned
              </button>
            </div>
          </motion.div>
        )}

        {/* Daily check-in — feeds the adaptive engine */}
        {isToday && !firstDaySoft && !checkInAcked && (
          <DailyCheckInCard
            sleepQ={sleepQ}
            energy={energy}
            mode={adaptation.mode}
            onSleep={(q) => updateSleepLog(selectedDate, { sleepQuality: q })}
            onEnergy={(e) => updateRatings(selectedDate, { energy: e })}
            onAck={() => setCheckInAcked(true)}
          />
        )}

        {/* Natural-language quick log — type one line to fill the check-in.
            Collapsed by default. Hidden once the day's closed (nothing left
            to log; keeps the "day complete" moment calm). */}
        {isToday && !dayComplete && (
          <QuickLog
            onApply={(v) => {
              if (v.sleepQuality != null || v.sleepDurationMinutes != null) {
                updateSleepLog(selectedDate, {
                  ...(v.sleepQuality != null
                    ? { sleepQuality: v.sleepQuality }
                    : {}),
                  ...(v.sleepDurationMinutes != null
                    ? { sleepDurationMinutes: v.sleepDurationMinutes }
                    : {}),
                });
              }
              // Merge, don't clobber: if the user already wrote a reflection
              // today, append the quick-log line instead of overwriting it.
              const prev = (log.dayNote ?? "").trim();
              const note =
                prev && !prev.includes(v.note) ? `${prev}\n${v.note}` : v.note;
              updateRatings(selectedDate, {
                ...(v.energy != null ? { energy: v.energy } : {}),
                ...(v.mood != null ? { mood: v.mood } : {}),
                note,
              });
            }}
          />
        )}

        {/* Monthly identity reflection — calm pointer to the full (gated)
            view on Insights; one at a time, dismissible per month. */}
        {showIdentity && identity && (
          <div className="card p-5">
            <Eyebrow color="var(--warm)">Who you&rsquo;re becoming</Eyebrow>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text-1)]">
              {identity.headline}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-3)]">
              A new monthly reflection is ready.
            </p>
            <div className="mt-3 flex items-center gap-5">
              <button
                onClick={() => router.push("/insights")}
                className="press tap-44 tr-fast inline-flex items-center text-[13px] font-semibold text-[var(--warm)]"
              >
                Read it →
              </button>
              <button
                onClick={ackIdentity}
                className="press tap-44 tr-fast inline-flex items-center text-[13px] font-medium text-[var(--text-4)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Weekly review — surfaced once per week so the calm weekly user
            encounters it instead of hunting for it on the Insights tab. */}
        {showWeekly && review && (
          <div className="card p-5">
            <Eyebrow color="var(--readiness)">Your week</Eyebrow>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--text-1)]">
              {review.headline}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-3)]">
              Your weekly review is ready — see how this week compared to last.
            </p>
            <div className="mt-3 flex items-center gap-5">
              <button
                onClick={() => router.push("/insights")}
                className="press tap-44 tr-fast inline-flex items-center text-[13px] font-semibold text-[var(--readiness)]"
              >
                See your week →
              </button>
              <button
                onClick={ackWeekReview}
                className="press tap-44 tr-fast inline-flex items-center text-[13px] font-medium text-[var(--text-4)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* First-day soft entry — tomorrow's first focus, not today's
            "up next" pressure. Replaces the standard Up Next card when
            the user joined mid-day and hasn't checked anything off yet. */}
        {firstDaySoft && tomorrowFirstFocus && (
          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <Eyebrow color="var(--text-3)">Tomorrow&apos;s first focus</Eyebrow>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
                style={{
                  background:
                    "color-mix(in srgb, var(--readiness) 16%, var(--surface-2))",
                  color: "var(--readiness)",
                }}
              >
                MORNING
              </span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[var(--r-xl)] p-5"
              style={{
                background:
                  "linear-gradient(155deg, color-mix(in srgb, var(--readiness) 12%, var(--surface-1)), var(--surface-1) 70%)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <span
                className="ambient"
                style={{
                  background:
                    "radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, var(--readiness) 18%, transparent), transparent 60%)",
                }}
              />
              <div className="relative flex items-center gap-4">
                <span
                  className="chip h-16 w-16 shrink-0"
                  style={{
                    background:
                      "color-mix(in srgb, var(--readiness) 22%, var(--surface-3))",
                    color: "var(--readiness)",
                  }}
                >
                  <Icon
                    name={tomorrowFirstFocus.icon as IconName}
                    size={28}
                    stroke={1.7}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold leading-tight text-[var(--text-1)]">
                    {tomorrowFirstFocus.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-3)]">
                    Your system kicks off here in the morning. Browse the
                    rest of today below at your own pace.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Overnight (past bedtime, pre-wake): a calm rest state instead of
            promoting an action — the expired evening block is no longer "NOW"
            and Up Next is suppressed (upNext is null here). */}
        {!firstDaySoft && overnight && !dayComplete && (
          <div
            className="mb-4 rounded-[var(--r-xl)] p-5"
            style={{
              background:
                "linear-gradient(155deg, color-mix(in srgb, var(--sleep) 10%, var(--surface-1)), var(--surface-1) 70%)",
              border: "1px solid var(--hairline)",
            }}
          >
            <Eyebrow color="var(--sleep)">Overnight</Eyebrow>
            <p className="mt-2 text-[16px] font-bold leading-snug text-[var(--text-1)]">
              It&rsquo;s past your bedtime — nothing&rsquo;s due now
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-3)]">
              The kindest thing you can do for tomorrow is sleep. Your day
              picks back up after you wake.
            </p>
          </div>
        )}

        {/* Up next — the single intelligent focus */}
        {!firstDaySoft && isToday && !dayComplete && !partialClose && upNext && (
          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <Eyebrow color="var(--text-3)">Up next</Eyebrow>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, var(--surface-2))`,
                  color: accent,
                }}
              >
                {relTime(
                  effectiveMinutes(upNext, settings),
                  nowMinutesInTz(tz)
                ).toUpperCase()}
              </span>
            </div>
            <motion.div
              key={upNext.canonicalKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[var(--r-xl)] p-5"
              style={{
                background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 14%, var(--surface-1)), var(--surface-1) 70%)`,
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <span
                className="ambient"
                style={{
                  background: `radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, ${accent} 20%, transparent), transparent 60%)`,
                }}
              />
              <button
                onClick={() => {
                  haptic.medium();
                  toggleBehavior(selectedDate, upNext.canonicalKey);
                }}
                className="press relative flex w-full items-center gap-4 text-left"
              >
                <span
                  className="chip h-16 w-16 shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${accent} 24%, var(--surface-3))`,
                    color: accent,
                  }}
                >
                  <Icon
                    name={upNext.icon as IconName}
                    size={28}
                    stroke={1.7}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const isK = !!ks && upNext.canonicalKey === ks.key;
                      const tg = leverageTag(upNext, adaptation.mode, {
                        isKeystone: isK,
                        streak: behaviorStats(state, upNext.canonicalKey)
                          .streak,
                      });
                      const c = TONE_COLOR[tg.tone];
                      return (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                          style={{
                            background: `color-mix(in srgb, ${c} 18%, var(--surface-3))`,
                            color: c,
                          }}
                        >
                          {tg.text.toUpperCase()}
                        </span>
                      );
                    })()}
                    <span className="text-[11px] text-[var(--text-3)]">
                      {upNext.fromPacks[0]}
                      {upNext.fromPacks.length > 1 &&
                        ` +${upNext.fromPacks.length - 1}`}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[19px] font-bold leading-tight text-[var(--text-1)]">
                    {upNext.title}
                  </p>
                  {upNext.dose && (
                    <p className="mt-1 text-[13px] text-[var(--text-2)]">
                      {upNext.dose}
                    </p>
                  )}
                </div>
                <Check on={false} color={accent} />
              </button>
              <p className="relative mt-4 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                {upNextMessage(upNext, {
                  mode: adaptation.mode,
                  minutesToStart:
                    effectiveMinutes(upNext, settings) != null
                      ? (effectiveMinutes(upNext, settings) as number) -
                        nowMinutesInTz(tz)
                      : null,
                  isKeystone: !!ks && upNext.canonicalKey === ks.key,
                })}
              </p>
              <div className="relative mt-4 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-4)]">
                  {liveStreak >= 2 && prog.done === 0
                    ? `Keep your ${liveStreak}-day streak alive`
                    : prog.done > 0
                    ? `${prog.done} done — keep the thread going`
                    : "First one sets the tone"}
                </span>
                <button
                  onClick={() =>
                    setSnoozed((s) =>
                      s.includes(upNext.canonicalKey)
                        ? s
                        : [...s, upNext.canonicalKey]
                    )
                  }
                  className="press flex min-h-[44px] items-center rounded-full px-4 py-2.5 text-[12px] font-semibold text-[var(--text-3)]"
                  style={{ background: "var(--surface-2)" }}
                  title="Stop suggesting this as your next step (it stays in your timeline below)"
                >
                  Not now
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Adaptive suggestion — calm, dismissible */}
        {isToday &&
          activeSuggestions.length > 0 &&
          (() => {
            const sug = activeSuggestions[0];
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card relative overflow-hidden p-5"
              >
                <span
                  className="ambient"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--vitality) 16%, transparent), transparent 60%)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Icon
                      name="bulb"
                      size={14}
                      className="text-[var(--vitality)]"
                    />
                    <Eyebrow color="var(--vitality)">Suggestion</Eyebrow>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-[var(--text-1)]">
                    {sug.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                    {sug.body}
                  </p>
                  <div className="mt-4 flex gap-2.5">
                    <button
                      onClick={() => {
                        const a = sug.action;
                        if (a.type === "install") installPack(a.packId);
                        else if (a.type === "pause")
                          setBehaviorOverride(a.key, {
                            ...(state.behaviorOverrides?.[a.key] ?? {}),
                            disabled: true,
                          });
                        else if (a.type === "retime")
                          // Clear any custom-time pin + stack anchor when making
                          // it "anytime" — else effectiveMinutes keeps showing
                          // the old clock time and the item stays visibly timed,
                          // so the action fails to do what its label promises.
                          // (Matches commitBlockMove's manual-move path.)
                          setBehaviorOverride(a.key, {
                            ...(state.behaviorOverrides?.[a.key] ?? {}),
                            block: a.block,
                            customTime: undefined,
                            stackAfter: undefined,
                          });
                        setDismissed((d) => [...d, sug.id]);
                      }}
                      className="press tr-fast rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2.5 text-[13px] font-semibold text-[var(--bg)]"
                    >
                      {sug.cta}
                    </button>
                    <button
                      onClick={() =>
                        setDismissed((d) => [...d, sug.id])
                      }
                      className="press tr-fast rounded-[var(--r-pill)] px-4 py-2.5 text-[13px] font-semibold text-[var(--text-3)]"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })()}

        {/* Edit-mode toggle. Tucked above the timeline rather than the
            page header so it sits next to what it modifies; visible to
            today only because day-by-day edits to past timelines would
            mutate historical truth. Past days stay read-only. */}
        {isToday && timeline.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-[var(--text-3)]">
              {editMode
                ? "Tap a handle to move"
                : "Today's flow"}
            </span>
            <button
              onClick={() => {
                setEditMode((v) => !v);
                if (editMode) setSelectedKeys(new Set());
                setDragKey(null);
                setDragOverBlock(null);
                setMoveMenuKey(null);
              }}
              className="press tap-44 tr-fast rounded-[var(--r-pill)] px-3 py-1 text-[11.5px] font-semibold"
              style={{
                background: editMode ? "var(--text-1)" : "var(--surface-3)",
                color: editMode ? "var(--bg)" : "var(--text-2)",
              }}
              title={
                editMode
                  ? "Exit edit mode"
                  : "Drag behaviors across times of day · multi-select for bulk actions"
              }
            >
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        )}

        {/* Live, time-aware timeline */}
        <div className="flex flex-col gap-7">
          {BLOCKS.map((block, bIdx) => {
            const items = timeline.filter((i) => i.block === block);
            const visibleItems = items.filter((i) => !i.muted);
            const optionalItems = items.filter((i) => i.muted);
            const optKey = `opt:${block}`;
            const showOpt = !!openBlocks[optKey];
            // Supplements live in their own state.supplements array
            // now (separated from behaviors) and render via the
            // SupplementBlockCard below. The timeline filter no
            // longer needs to deal with them.
            const rendered = items.filter((i) => !i.muted || showOpt);
            const blockSupplements = supplementsForBlock(
              state.supplements ?? [],
              block,
              selDayIdx,
              state.settings.safetyFlags ?? {}
            );
            // Render the section if it has EITHER behaviors or supplements. A
            // supplement-only block (e.g. an "anytime" stack) must still show
            // its SupplementBlockCard — otherwise those supplements are
            // invisible AND permanently block "day complete".
            if (items.length === 0 && blockSupplements.length === 0)
              return null;
            const baseItems =
              visibleItems.length > 0 ? visibleItems : items;
            const behaviorDone = baseItems.filter((i) =>
              isDone(log, i.canonicalKey)
            ).length;
            // Supplements are part of the block: it isn't "Complete"
            // until the stack is handled (each supplement taken OR
            // skipped today). Tracked separately from behaviorDone so
            // the timeline thread still fills on behaviors only.
            const suppSkips = new Set(log.supplementSkips ?? []);
            const suppTaken = blockSupplements.filter(
              (s) => log.supplementCompletions?.[s.id]
            ).length;
            const suppHandled = blockSupplements.filter(
              (s) =>
                log.supplementCompletions?.[s.id] || suppSkips.has(s.id)
            ).length;
            // "Skipped" (for the card affordance) = the remaining
            // un-taken supplements are all skipped.
            const blockSuppSkipped =
              blockSupplements.length > 0 &&
              suppTaken < blockSupplements.length &&
              suppHandled === blockSupplements.length;
            const blockDone = behaviorDone + suppHandled;
            const blockTotal = baseItems.length + blockSupplements.length;
            const cbIdx = BLOCKS.indexOf(cb);
            const isCurrent = !overnight && block === cb;
            // Block index vs current block is correct in the wake-anchored
            // frame (earlier index = earlier in the user's day = past) — but
            // NOT overnight, where cb is the prior "evening" tail yet the
            // blocks below belong to the upcoming day. So nothing is "past"
            // during the overnight rest state (fixes the midnight pre-dimming).
            const isPast = !overnight && bIdx < cbIdx;
            const fullyDone = blockTotal > 0 && blockDone === blockTotal;
            const collapsed =
              isPast && fullyDone && !openBlocks[block];

            const isDropTarget = editMode && dragOverBlock === block;
            return (
              <section
                key={block}
                onDragOver={(e) => {
                  if (!editMode || !dragKey) return;
                  // Allowing the drop is what enables an onDrop; without
                  // preventDefault the browser rejects the cursor as
                  // "no-drop" which makes the affordance feel broken.
                  e.preventDefault();
                  if (dragOverBlock !== block) setDragOverBlock(block);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const key = dragKey;
                  setDragKey(null);
                  setDragOverBlock(null);
                  if (!editMode || !key) return;
                  const it = timeline.find((x) => x.canonicalKey === key);
                  if (!it || it.block === block) return;
                  requestBlockMove(
                    [
                      {
                        key,
                        title: it.title,
                        recommendedBlock: it.recommendedBlock,
                        timingReason: it.timingReason,
                      },
                    ],
                    block
                  );
                }}
                style={
                  isDropTarget
                    ? {
                        outline:
                          "2px dashed color-mix(in srgb, var(--readiness) 60%, transparent)",
                        outlineOffset: 6,
                        borderRadius: "var(--r-xl)",
                      }
                    : undefined
                }
              >
                <button
                  onClick={() =>
                    setOpenBlocks((o) => ({ ...o, [block]: !o[block] }))
                  }
                  className="mb-3 flex w-full items-center justify-between px-1"
                >
                  <span className="flex items-center gap-2">
                    <Eyebrow color={isCurrent ? accent : undefined}>
                      {blockLabel(block, settings.blockLabels)}
                    </Eyebrow>
                    {isCurrent && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                        style={{
                          background: accent,
                          color: "var(--bg)",
                        }}
                      >
                        NOW
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)]">
                    {editMode && dragKey
                      ? `Drop here to move to ${blockLabel(block, settings.blockLabels)}`
                      : fullyDone
                      ? "Complete"
                      : blockDone > 0
                      ? "In flow"
                      : "Open"}
                    {collapsed && (
                      <Icon name="chevron" size={12} className="rotate-90" />
                    )}
                  </span>
                </button>

                {/* Calm per-block intelligence note. Fires when the
                    block is overstuffed (focus on essentials) or when
                    today has a notable combination (two training
                    stimuli, cold + sauna stack). One note max — the
                    helper handles priority. Today-only so historic
                    timelines aren't littered with calls-to-action. */}
                {!collapsed &&
                  isToday &&
                  (() => {
                    const note = blockIntelligence(timeline, block, selDayIdx);
                    if (!note) return null;
                    return (
                      <p
                        className="mb-3 rounded-[var(--r-sm)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-2)]"
                        style={{
                          background:
                            note.kind === "training"
                              ? "color-mix(in srgb, var(--warm) 11%, var(--surface-2))"
                              : note.kind === "combo"
                              ? "color-mix(in srgb, var(--recovery) 11%, var(--surface-2))"
                              : "color-mix(in srgb, var(--readiness) 9%, var(--surface-2))",
                        }}
                      >
                        {note.text}
                      </p>
                    );
                  })()}
                {!collapsed && (
                  <div
                    className="relative"
                    style={{
                      opacity: isCurrent ? 1 : isPast ? 0.6 : 0.85,
                    }}
                  >
                    {rendered.length > 1 && (
                      <>
                        <span
                          className="absolute bottom-4 top-4 w-px"
                          style={{
                            left: 19,
                            background:
                              "linear-gradient(180deg, transparent, rgba(255,255,255,0.05) 12%, rgba(255,255,255,0.05) 88%, transparent)",
                          }}
                        />
                        <motion.span
                          className="absolute top-4 w-px"
                          style={{ left: 19, background: accent, opacity: 0.4 }}
                          initial={false}
                          animate={{
                            height: `${
                              (behaviorDone /
                                Math.max(baseItems.length, 1)) *
                              100
                            }%`,
                          }}
                          transition={{
                            duration: 0.7,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </>
                    )}
                    {(() => {
                      const now = nowMinutesInTz(tz);
                      let nowShown = false;
                      return rendered.map((it) => {
                        const done = isDone(log, it.canonicalKey);
                        const t = effectiveMinutes(it, settings);
                        const st = behaviorStats(state, it.canonicalKey);
                        const isKey = !!ks && it.canonicalKey === ks.key;
                        const lev3 = it.leverage === 3 || isKey;
                        const lev1 = it.leverage === 1 && !isKey;
                        const showNow =
                          isCurrent &&
                          isToday &&
                          !nowShown &&
                          t != null &&
                          t > now;
                        if (showNow) nowShown = true;
                        const tint = it.muted
                          ? "var(--text-3)"
                          : accent;

                        return (
                          <div key={it.canonicalKey}>
                            {showNow && (
                              <div className="relative flex items-center gap-3 py-1.5">
                                <span
                                  className="relative z-10 grid w-10 shrink-0 place-items-center"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full anim-pulse"
                                    style={{
                                      background: accent,
                                      boxShadow: `0 0 8px ${accent}`,
                                    }}
                                  />
                                </span>
                                <span
                                  className="text-[10px] font-bold tracking-wide"
                                  style={{ color: accent }}
                                >
                                  NOW · {fmtClock(now)}
                                </span>
                                <span
                                  className="h-px flex-1"
                                  style={{ background: `${accent}40` }}
                                />
                              </div>
                            )}

                            <div
                              className={`group relative flex items-stretch ${
                                editMode ? "gap-1.5" : "gap-3"
                              } ${lev1 ? "py-1" : "py-1.5"}`}
                              style={{
                                opacity:
                                  dragKey === it.canonicalKey ? 0.4 : 1,
                                transition: "opacity 120ms ease",
                              }}
                            >
                              {/* Move handle — only in edit mode, only
                                  for today (past days are read-only).
                                  Dual UX: desktop users can still
                                  drag (HTML5 dnd via `draggable`);
                                  touch users tap to open a small
                                  destination picker (mobile-friendly,
                                  since dragstart never fires from a
                                  touch event on iOS Safari and is
                                  flaky on Android). Tap-path also
                                  works on desktop — same affordance,
                                  fewer keystrokes than dragging
                                  across a tall screen. */}
                              {editMode && isToday && (
                                <span className="relative">
                                  <button
                                    type="button"
                                    aria-label={`Move ${it.title} to a different time of day`}
                                    aria-haspopup="menu"
                                    aria-expanded={
                                      moveMenuKey === it.canonicalKey
                                    }
                                    title="Tap to move (or drag from here on desktop)"
                                    draggable
                                    onDragStart={(e) => {
                                      setMoveMenuKey(null);
                                      setDragKey(it.canonicalKey);
                                      setDragOverBlock(block);
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => {
                                      setDragKey(null);
                                      setDragOverBlock(null);
                                    }}
                                    onPointerDown={(e) => {
                                      // Stop the document-level handler
                                      // from closing the menu BEFORE
                                      // our click toggles it open.
                                      e.stopPropagation();
                                    }}
                                    onClick={() => {
                                      setMoveMenuKey((k) =>
                                        k === it.canonicalKey
                                          ? null
                                          : it.canonicalKey
                                      );
                                    }}
                                    className="grid min-h-[44px] w-6 cursor-grab shrink-0 place-items-center text-[var(--text-3)] active:cursor-grabbing"
                                  >
                                    <span className="font-mono text-[14px] leading-none">
                                      ⋮⋮
                                    </span>
                                  </button>
                                  {moveMenuKey === it.canonicalKey && (
                                    <div
                                      role="menu"
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) =>
                                        e.stopPropagation()
                                      }
                                      className="absolute left-0 top-full z-40 mt-1 min-w-[150px] overflow-hidden rounded-[var(--r-md)] border shadow-xl"
                                      style={{
                                        background: "var(--surface-2)",
                                        borderColor:
                                          "var(--hairline-strong)",
                                      }}
                                    >
                                      <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
                                        Move to
                                      </p>
                                      {(
                                        [
                                          "morning",
                                          "afternoon",
                                          "evening",
                                          "anytime",
                                        ] as TimeBlock[]
                                      ).map((target) => {
                                        // A strict-window behavior can't move to
                                        // a block its window doesn't reach —
                                        // disable that target (mirrors the editor
                                        // sheet) instead of accepting a dead tap.
                                        const forbidden =
                                          !!it.timeWindow?.strict &&
                                          !windowBlocks(
                                            it,
                                            state.settings
                                          ).includes(target);
                                        return (
                                        <button
                                          key={target}
                                          role="menuitem"
                                          disabled={target === block || forbidden}
                                          onClick={() => {
                                            setMoveMenuKey(null);
                                            if (target === block || forbidden)
                                              return;
                                            requestBlockMove(
                                              [
                                                {
                                                  key: it.canonicalKey,
                                                  title: it.title,
                                                  recommendedBlock:
                                                    it.recommendedBlock,
                                                  timingReason:
                                                    it.timingReason,
                                                },
                                              ],
                                              target
                                            );
                                          }}
                                          className="press tr-fast block w-full px-3 py-2 text-left text-[13px] text-[var(--text-1)] hover:bg-[var(--surface-3)] disabled:opacity-40 disabled:cursor-not-allowed"
                                          style={{
                                            background:
                                              target === block
                                                ? "var(--surface-3)"
                                                : undefined,
                                          }}
                                        >
                                          {blockLabel(target, settings.blockLabels)}
                                          {target === block && (
                                            <span className="ml-2 text-[10.5px] text-[var(--text-4)]">
                                              current
                                            </span>
                                          )}
                                        </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </span>
                              )}
                              {/* Multi-select checkbox — same surface as
                                  drag handle, only in edit mode. Lets
                                  the user bulk-snooze or bulk-move a
                                  group without dragging each. */}
                              {editMode && isToday && (
                                <span className="grid min-h-[44px] w-5 shrink-0 place-items-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${it.title}`}
                                    checked={selectedKeys.has(it.canonicalKey)}
                                    onChange={(e) => {
                                      const next = new Set(selectedKeys);
                                      if (e.target.checked)
                                        next.add(it.canonicalKey);
                                      else next.delete(it.canonicalKey);
                                      setSelectedKeys(next);
                                    }}
                                    className="h-4 w-4 cursor-pointer accent-[var(--readiness)]"
                                  />
                                </span>
                              )}
                              {/* Node on the spine */}
                              <button
                                onClick={() => {
                                  // Tap-to-complete is suppressed while
                                  // editing — the row becomes a
                                  // manipulation target, not a checklist
                                  // item. Re-enabling it when the user
                                  // taps Done.
                                  if (editMode) return;
                                  // A conflict-muted ("Resting today") row is
                                  // not part of today's plan — its completion
                                  // is excluded from the score AND "Day
                                  // complete", so a tap would write data the
                                  // ring ignores while showing a checkmark
                                  // (split-brain). Make it non-completable.
                                  if (it.muted) return;
                                  // Haptic feedback: medium pulse on
                                  // marking done (definitive), light
                                  // tap on un-marking (correction).
                                  if (done) haptic.light();
                                  else haptic.medium();
                                  toggleBehavior(
                                    selectedDate,
                                    it.canonicalKey
                                  );
                                }}
                                aria-label={
                                  done
                                    ? `${it.title} — done`
                                    : `Mark ${it.title} done`
                                }
                                aria-pressed={done}
                                disabled={editMode}
                                className="press relative z-10 grid min-h-[44px] w-11 shrink-0 place-items-center disabled:opacity-60"
                              >
                                <span
                                  className={`grid place-items-center rounded-full tr-fast ${
                                    done ? "anim-node-pulse" : ""
                                  }`}
                                  style={
                                    {
                                      height: lev3 ? 26 : lev1 ? 16 : 20,
                                      width: lev3 ? 26 : lev1 ? 16 : 20,
                                      background: done
                                        ? tint
                                        : "var(--bg)",
                                      "--pulse-c": `color-mix(in srgb, ${tint} 45%, transparent)`,
                                      boxShadow: done
                                        ? `0 0 10px color-mix(in srgb, ${tint} 30%, transparent)`
                                        : `inset 0 0 0 ${
                                            lev3 ? 1.75 : 1.5
                                          }px ${
                                            lev3 && !it.muted
                                              ? `color-mix(in srgb, ${tint} 60%, var(--text-4))`
                                              : "var(--hairline-strong)"
                                          }`,
                                    } as React.CSSProperties
                                  }
                                >
                                  {done ? (
                                    <svg
                                      width={lev3 ? 14 : 11}
                                      height={lev3 ? 14 : 11}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="var(--bg)"
                                      strokeWidth="3.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M5 12.5l4.5 4.5L19 7" />
                                    </svg>
                                  ) : lev3 ? (
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ background: tint }}
                                    />
                                  ) : null}
                                </span>
                              </button>

                              {/* Content — tapping the row body OPENS details
                                  / options (the common intent); completing is
                                  the radio node on the left, so a stray tap
                                  never silently checks something off. In edit
                                  mode the body toggles selection so the whole
                                  row is the pick target, not just the tiny
                                  checkbox. */}
                              {/* Row body is a role=button div, NOT a
                                  <button> — it contains nested interactive
                                  controls (the Swap-workout chip + Undo),
                                  and a button-inside-button is invalid HTML
                                  that throws a hydration error. div +
                                  role/tabIndex/onKeyDown preserves the
                                  tap-to-complete + keyboard a11y exactly. */}
                              <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLElement).click();
                                  }
                                }}
                                onClick={() => {
                                  if (editMode) {
                                    const next = new Set(selectedKeys);
                                    if (next.has(it.canonicalKey))
                                      next.delete(it.canonicalKey);
                                    else next.add(it.canonicalKey);
                                    setSelectedKeys(next);
                                    haptic.light();
                                    return;
                                  }
                                  // Tapping the row body OPENS details/options.
                                  // Completion lives solely on the radio node to
                                  // the left — so a stray tap never silently
                                  // marks something done.
                                  haptic.light();
                                  setDetail(it);
                                }}
                                aria-label={`${it.title} — open details and options`}
                                className={`min-w-0 flex-1 rounded-[var(--r-md)] text-left tr-fast ${
                                  lev3 && !done
                                    ? "px-4 py-3"
                                    : lev1
                                    ? "px-2 py-1.5"
                                    : "px-3 py-2.5"
                                }`}
                                style={{
                                  opacity: it.muted ? 0.55 : 1,
                                  background:
                                    lev3 && !done
                                      ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, transparent), transparent)`
                                      : "transparent",
                                  boxShadow:
                                    lev3 && !done
                                      ? `inset 2px 0 0 color-mix(in srgb, ${accent} 70%, transparent)`
                                      : "none",
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`min-w-0 ${
                                      lev1
                                        ? "truncate text-[13px] font-medium"
                                        : "line-clamp-2 font-semibold leading-snug"
                                    } ${
                                      lev3 && !done
                                        ? "text-[15.5px]"
                                        : "text-[14px]"
                                    }`}
                                    style={{
                                      color: done
                                        ? "var(--text-3)"
                                        : lev1
                                        ? "var(--text-2)"
                                        : "var(--text-1)",
                                      textDecoration: done
                                        ? "none"
                                        : "none",
                                    }}
                                  >
                                    {it.title}
                                  </span>
                                  {isKey && !done && (
                                    <span
                                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                                      style={{
                                        background:
                                          "color-mix(in srgb, var(--warm) 18%, var(--surface-3))",
                                        color: "var(--warm)",
                                      }}
                                    >
                                      KEYSTONE
                                    </span>
                                  )}
                                  {!isKey && lev3 && !done && (
                                    <span
                                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                                      style={{
                                        background: "var(--surface-3)",
                                        color: accent,
                                      }}
                                    >
                                      ESSENTIAL
                                    </span>
                                  )}
                                  {st.streak >= 3 && !done && (
                                    <span
                                      className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold"
                                      style={{ color: "var(--warm)" }}
                                    >
                                      <Icon name="flame" size={11} />
                                      {st.streak}
                                    </span>
                                  )}
                                </div>
                                {/* Sub-line: time · dose/source + the
                                    optional "Personal" cue. Moved out
                                    of the title row to keep the header
                                    visual hierarchy clean (KEYSTONE /
                                    ESSENTIAL / streak count are the
                                    important attention slots; the
                                    Personal ownership marker is calmer
                                    and belongs on the sub-line). */}
                                {(!lev1 || it.trustTier === "custom") && (
                                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--text-3)]">
                                    {!lev1 && t != null && !it.muted && (
                                      <span className="tabular-nums">
                                        {fmtClock(t)}
                                      </span>
                                    )}
                                    {!lev1 && t != null && !it.muted && (
                                      <span>·</span>
                                    )}
                                    {!lev1 && it.kind === "avoid" && (
                                      <Icon name="ban" size={11} />
                                    )}
                                    {!lev1 && (
                                      <span className="truncate">
                                        {it.muted
                                          ? "Resting today"
                                          : it.dose || it.fromPacks[0]}
                                      </span>
                                    )}
                                    {it.trustTier === "custom" && !done && (
                                      <>
                                        {!lev1 && <span>·</span>}
                                        <span
                                          className="shrink-0 italic text-[var(--text-4)]"
                                          title="Your personal behavior — kept just for you, not part of our recommendations."
                                        >
                                          Personal
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                                {lev3 && !done && !it.muted && (
                                  <p className="mt-1.5 line-clamp-1 text-[12px] leading-relaxed text-[var(--text-3)]">
                                    {it.rationale}
                                  </p>
                                )}
                                {/* Swap-workout affordance — only on
                                    workout-tagged behaviors, only for
                                    today, only when not in edit mode
                                    (the move handle owns that gesture).
                                    Two states:
                                    1. Default (no swap recorded) — show
                                       "Swap workout" chip; tap opens
                                       the alternatives sheet.
                                    2. Replaced (item.swappedFrom set) —
                                       show "Swapped from X — undo".
                                    The swapped-FROM original is muted
                                    by applySwaps with muteReason; the
                                    Resting/Swapped caption above
                                    surfaces it. */}
                                {isToday &&
                                  !editMode &&
                                  isWorkoutBehavior(it) &&
                                  !it.muted &&
                                  !done &&
                                  !it.swappedFrom && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSwapForKey(it.canonicalKey);
                                      }}
                                      className="press tap-44 tr-fast mt-2 inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)]"
                                      aria-label={`Swap ${it.title} for a different workout today`}
                                    >
                                      <Icon name="arrowRight" size={10} />
                                      Swap workout
                                    </button>
                                  )}
                                {isToday && !editMode && it.swappedFrom && (
                                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-3)]">
                                    <span>Swapped in for today</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (it.swappedFrom)
                                          clearSwap(
                                            selectedDate,
                                            it.swappedFrom
                                          );
                                      }}
                                      className="press underline-offset-2 hover:underline"
                                      style={{ color: "var(--readiness)" }}
                                    >
                                      Undo
                                    </button>
                                  </div>
                                )}
                                {/* Habit-stacking cue — "After X", shown on a
                                    behavior the user anchored to follow
                                    another. Makes the reorder legible instead
                                    of an unexplained jump. */}
                                {!editMode && it.stackedAfter && (
                                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-3)]">
                                    <Icon name="arrowRight" size={10} />
                                    After {it.stackedAfter}
                                  </p>
                                )}
                                {/* Visual link from avoid-card to the
                                    target behavior(s) it references —
                                    "→ Strength training" under the
                                    "no cold within 6h post-lift" card.
                                    Replaces the implicit assumption
                                    that the user knows what's being
                                    referenced. Only renders when both
                                    the avoid card AND the target are
                                    in today's timeline. */}
                                {it.kind === "avoid" &&
                                  it.targets &&
                                  it.targets.length > 0 &&
                                  !it.muted && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {it.targets.map((tk) => {
                                        const target = timeline.find(
                                          (x) =>
                                            x.canonicalKey === tk ||
                                            x.derivedFrom === tk
                                        );
                                        if (!target) return null;
                                        return (
                                          <span
                                            key={tk}
                                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                                            style={{
                                              background:
                                                "var(--surface-3)",
                                              color: "var(--text-3)",
                                            }}
                                            title={`This rule references "${target.title}" — they're paired by design.`}
                                          >
                                            <Icon
                                              name="arrowRight"
                                              size={10}
                                            />
                                            {target.title}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                {lev1 && t != null && !it.muted && (
                                  <span className="ml-2 text-[11px] tabular-nums text-[var(--text-4)]">
                                    {fmtClock(t)}
                                  </span>
                                )}
                              </div>

                              {/* Details / edit — explicit, not the
                                  accidental default tap target. Hidden
                                  in edit mode so the title + tap-to-
                                  move handle have enough horizontal
                                  room on narrow screens; the user
                                  reaches details by exiting edit. */}
                              {!editMode && (
                                <button
                                  onClick={() => setDetail(it)}
                                  aria-label={`${it.title} details and options`}
                                  className="press grid min-h-[44px] w-9 shrink-0 place-items-center self-center text-[var(--text-4)] hover:text-[var(--text-2)]"
                                >
                                  <Icon name="chevron" size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Supplement bundle — single card per block.
                        Reads from state.supplements (separated from
                        behaviors) so curated/custom supplements all
                        flow through the same surface. Hidden when
                        the user has no supplements in this block. */}
                    {blockSupplements.length > 0 && (
                      <SupplementBlockCard
                        block={block}
                        supplements={blockSupplements}
                        completions={log.supplementCompletions ?? {}}
                        onToggle={(id) => toggleSupplement(selectedDate, id)}
                        onBulkCheck={() =>
                          bulkCheckSupplements(
                            selectedDate,
                            blockSupplements.map((s) => s.id)
                          )
                        }
                        blockSkipped={blockSuppSkipped}
                        onToggleSkip={() => {
                          // Skip (or un-skip) the supplements not already
                          // taken, so a day you're not taking them can
                          // still reach "Complete" — without recording
                          // them as taken.
                          const untaken = blockSupplements
                            .filter(
                              (s) => !log.supplementCompletions?.[s.id]
                            )
                            .map((s) => s.id);
                          setSupplementsSkipped(
                            selectedDate,
                            untaken,
                            !blockSuppSkipped
                          );
                        }}
                        // Tap a row → route to /supplements with the
                        // intent to edit. /supplements stack-view is
                        // the proper editor; rather than inlining a
                        // sheet here we hand off to the management
                        // surface and let it open the SupplementSheet.
                        onOpenDetail={() => router.push("/supplements")}
                      />
                    )}

                    {optionalItems.length > 0 && (
                      <button
                        onClick={() =>
                          setOpenBlocks((o) => ({
                            ...o,
                            [optKey]: !o[optKey],
                          }))
                        }
                        className="press mt-1 flex w-full items-center gap-3 pl-10 text-left"
                      >
                        <span className="text-[12px] font-medium text-[var(--text-3)]">
                          {showOpt
                            ? "Hide optional"
                            : `${optionalItems.length} optional today — eased to protect your focus`}
                        </span>
                        <Icon
                          name="chevron"
                          size={12}
                          className={`text-[var(--text-4)] ${
                            showOpt ? "-rotate-90" : "rotate-90"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Quick-add a one-off for today only (not the protocol). */}
        {isToday && <QuickAdd date={selectedDate} />}

        {/* Daily reflection — the engagement loop. Once the day is
            mostly done (60%+) OR the evening block has started, the
            user gets a calm one-tap mood + optional one-line note.
            Builds the journal-like trail that strengthens identity
            reflection AND gives Insights a sentiment dimension over
            time. The card auto-dismisses once mood is recorded, so
            a user who reflects in the morning isn't nagged again.
            Skipped for past/future scrubber views (only "today" gets
            the reflection prompt — old logs are read-only). */}
        {isToday &&
          log.moodLevel == null &&
          (cb === "evening" ||
            (prog.total > 0 && prog.done / prog.total >= 0.6)) && (
            <DailyReflection
              date={selectedDate}
              currentNote={log.dayNote ?? ""}
              onMood={(m) => updateRatings(selectedDate, { mood: m })}
              onNote={(note) => updateRatings(selectedDate, { note })}
              prompt={reflectionPrompt(selectedDate)}
            />
          )}
      </div>

      {/* Bulk-action bar — appears only when a multi-select has any
          picks. Sticky to the bottom of the viewport so it can't be
          scrolled out of reach. At iPhone SE widths the inline
          "→ Morning / Afternoon / Evening / Anytime" pills wrapped
          to 3 rows; now they live behind a single "Move to…" button
          that opens a centered sheet. Three actions stay: Snooze
          (today only), Move to… (re-time the selection together,
          cross-block warning applies), and Clear. */}
      {editMode && selectedKeys.size > 0 && (
        <div
          className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-2 rounded-[var(--r-xl)] p-3"
          style={{
            background:
              "color-mix(in srgb, var(--readiness) 16%, var(--surface-2))",
            boxShadow: "var(--shadow-soft)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <span className="shrink-0 text-[12.5px] font-semibold text-[var(--text-1)]">
            {selectedKeys.size} selected
          </span>
          <button
            onClick={() => {
              // Route through the PERSISTED per-day snooze (log.snoozes) — the
              // field the timeline actually hides on (applySnoozes). Writing
              // the local `snoozed` array only affected Up Next, so the items
              // stayed fully visible and "Snooze" looked like a no-op.
              // "tomorrow" = hide today, return tomorrow, matching the tooltip.
              selectedKeys.forEach((k) =>
                setSnooze(selectedDate, k, "tomorrow")
              );
              setSelectedKeys(new Set());
            }}
            className="press tr-fast tap-44 shrink-0 rounded-[var(--r-pill)] px-3 py-1.5 text-[11.5px] font-semibold"
            style={{
              background: "var(--surface-3)",
              color: "var(--text-1)",
            }}
            title="Hide these for today only — they come back tomorrow."
          >
            Snooze
          </button>
          <button
            onClick={() => setBulkMoveOpen(true)}
            className="press tr-fast tap-44 shrink-0 rounded-[var(--r-pill)] px-3 py-1.5 text-[11.5px] font-semibold"
            style={{
              background: "var(--text-1)",
              color: "var(--bg)",
            }}
            title="Re-time every selected behavior to a different block."
          >
            Move to…
          </button>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="press tap-44 ml-auto shrink-0 text-[11.5px] text-[var(--text-3)]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk move destination sheet — replaces the four inline block
          pills that overflowed the bar on narrow screens. */}
      <BulkMoveSheet
        open={bulkMoveOpen}
        count={selectedKeys.size}
        blockLabels={settings.blockLabels}
        onClose={() => setBulkMoveOpen(false)}
        onSelectBlock={(b) => {
          const moves: {
            key: string;
            title: string;
            recommendedBlock: TimeBlock;
            timingReason?: string;
          }[] = [];
          for (const k of selectedKeys) {
            const it = timeline.find((x) => x.canonicalKey === k);
            if (!it || it.block === b) continue;
            moves.push({
              key: k,
              title: it.title,
              recommendedBlock: it.recommendedBlock,
              timingReason: it.timingReason,
            });
          }
          requestBlockMove(moves, b);
          setSelectedKeys(new Set());
          setBulkMoveOpen(false);
        }}
      />

      {/* Workout swap sheet — appears when the user taps "Swap
          workout" on a scheduled workout row. Lists every workout
          alternative they have access to (installed packs +
          standalone library), excluding the original itself. Tapping
          one swaps for today only and auto-marks complete (the user
          is telling us they DID the alternative). */}
      <WorkoutSwapSheet
        swapForKey={swapForKey}
        originalTitle={
          swapForKey
            ? timeline.find((x) => x.canonicalKey === swapForKey)?.title
            : undefined
        }
        alternatives={
          swapForKey
            ? availableWorkoutAlternatives(state).filter(
                (b) => b.canonicalKey !== swapForKey
              )
            : []
        }
        onClose={() => setSwapForKey(null)}
        onSelect={(altKey) => {
          if (!swapForKey) return;
          swapBehavior(selectedDate, swapForKey, altKey);
          setSwapForKey(null);
          haptic.medium();
        }}
      />

      {/* Cross-block move confirmation. Each contradicted behavior
          surfaces ITS OWN scientific rationale — melatonin says
          "before bed", morning sunlight says "anchors the circadian
          clock", caffeine cutoff says "10h half-life", etc. The user
          can still proceed; we educate, not block. */}
      <Sheet
        open={weekOpen}
        onClose={() => setWeekOpen(false)}
        title="The week ahead"
      >
        <WeekAhead state={state} />
      </Sheet>

      <Sheet
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        title={
          pendingMove && pendingMove.items.length === 1
            ? "Move outside the recommended time?"
            : "Move outside the recommended times?"
        }
      >
        {pendingMove && (
          <div>
            <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
              {pendingMove.items.length === 1
                ? `Here's why "${pendingMove.items[0].title}" was placed where it was:`
                : `Here's why each of these was placed where it was:`}
            </p>
            <div className="mt-3 space-y-2">
              {pendingMove.items.map((m) => (
                <div
                  key={m.key}
                  className="rounded-[var(--r-sm)] px-3 py-2.5"
                  style={{
                    background:
                      "color-mix(in srgb, var(--warm) 9%, var(--surface-2))",
                  }}
                >
                  {pendingMove.items.length > 1 && (
                    <p className="text-[12.5px] font-semibold text-[var(--text-1)]">
                      {m.title}
                    </p>
                  )}
                  <p
                    className={`text-[13px] leading-relaxed text-[var(--text-2)] ${
                      pendingMove.items.length > 1 ? "mt-1" : ""
                    }`}
                  >
                    {m.reason}
                  </p>
                </div>
              ))}
            </div>
            <p className="t-caption mt-3 leading-relaxed">
              You can still move it — overrides stick until you reset
              them.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button
                variant="ghost"
                full
                onClick={() => setPendingMove(null)}
              >
                Keep as is
              </Button>
              <Button
                full
                onClick={() => {
                  commitBlockMove(pendingMove.items, pendingMove.toBlock);
                  setPendingMove(null);
                }}
              >
                Move anyway
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <BehaviorSheet
        item={detailItem}
        settings={state.settings}
        notificationsEnabled={state.settings.notificationsEnabled}
        override={
          detail ? state.behaviorOverrides?.[detail.canonicalKey] : undefined
        }
        color={accent}
        onClose={() => setDetail(null)}
        onChange={(next) => {
          if (detail) setBehaviorOverride(detail.canonicalKey, next);
        }}
        onToggleEnabled={
          detail
            ? () => {
                const cur =
                  state.behaviorOverrides?.[detail.canonicalKey] ?? {};
                setBehaviorOverride(detail.canonicalKey, {
                  ...cur,
                  disabled: !cur.disabled,
                });
                setDetail(null);
              }
            : undefined
        }
        isEnabled={
          detail
            ? !state.behaviorOverrides?.[detail.canonicalKey]?.disabled
            : true
        }
        onSnooze={
          detail && isToday
            ? (mode) => {
                setSnooze(selectedDate, detail.canonicalKey, mode);
                setDetail(null);
              }
            : undefined
        }
        snoozed={detail ? log.snoozes?.[detail.canonicalKey] : undefined}
        blockLabels={settings.blockLabels}
        stackOptions={
          detail
            ? timeline
                .filter(
                  (i) =>
                    i.canonicalKey !== detail.canonicalKey &&
                    !i.oneOff &&
                    i.block !== "anytime"
                )
                .map((i) => ({ key: i.canonicalKey, title: i.title }))
            : undefined
        }
      />
    </Shell>
  );
}
