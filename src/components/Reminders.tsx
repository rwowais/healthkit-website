"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import {
  compileTimeline,
  shapeTimeline,
  injectOneOffs,
  applySnoozes,
  applySwaps,
  applyStacks,
  masteredKeys,
  adapt,
  isDone,
} from "@/lib/engine";
import { keystone } from "@/lib/intel";
import { effectiveMinutes, inQuietHours } from "@/lib/time";
import { learnedReminderMinutes } from "@/lib/smartReminders";
import { getTz, dateKeyInTz, dayIndexInTz, nowMinutesInTz } from "@/lib/tz";
import {
  pushAvailable,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

/**
 * Foreground + background reminders. While Protocolize is open in a
 * tab, schedules in-tab notifications at each upcoming behavior's
 * anchored time (zero-latency, no server round-trip).
 *
 * For background — including iOS installed PWAs — the user is
 * subscribed to Web Push via the VAPID flow in lib/push.ts when they
 * have notifications enabled. The server-side cron in
 * /api/push/send-due then sends reminders at the user's local times
 * even with the tab closed.
 *
 * Both can fire on the same minute on rare occasion; the service
 * worker dedupes via `tag` (renotify:false).
 */
export default function Reminders() {
  const { state, loading } = useAppState();
  const lastSubKeyRef = useRef<string>("");

  // Effect 1 — keep the server push subscription in sync with the
  // user's notifications-enabled toggle, reminder times (today's
  // anchored minutes), and their tz. Re-syncs only when the relevant
  // inputs change, not on every render.
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (!pushAvailable()) return;
    const tz = getTz(state.settings);
    const enabled = !!state.settings.notificationsEnabled;
    if (!enabled) {
      unsubscribeFromPush().catch(() => {});
      lastSubKeyRef.current = "";
      return;
    }
    // Build today's anchored times — these are the times we want the
    // server to ping at. Limit to the next 12 hours so we don't
    // schedule e.g. tomorrow morning's wake-anchor today.
    const dayIdx = dayIndexInTz(tz);
    // Mirror exactly what Today schedules: inject today's one-offs and apply
    // snoozes, so a "tomorrow"-snoozed behavior doesn't ping today and a
    // one-off added for today is included. Use effectiveMinutes so a user's
    // exact customTime is honored (resolveMinutes only did anchor math).
    const today = dateKeyInTz(tz);
    const log = getLogForDate(state, today);
    // Mirror Today's exact pipeline so reminders fire for precisely the set
    // visible on the board: applySwaps first (a swapped-away workout's original
    // is muted), shapeTimeline WITH the keystone + mastered opts (a graduated /
    // keystone-protected behavior mutes the same way), then one-offs (honoring
    // overrides), snoozes, and stacks (so a stacked follower fires at its
    // rebased time). Without this, reminders pinged hidden/swapped behaviors.
    const swapped = applySwaps(compileTimeline(state, dayIdx), log);
    const shaped = shapeTimeline(swapped, adapt(state).mode, {
      keystoneKey: keystone(state)?.key,
      mastered: masteredKeys(state, today),
    });
    const items = applyStacks(
      applySnoozes(injectOneOffs(shaped, log, state.behaviorOverrides), log),
      state.behaviorOverrides,
      log.snoozes
    );
    const times: string[] = [];
    for (const it of items) {
      if (it.muted) continue;
      // Per-behavior opt-out — match the in-tab path so a silenced behavior
      // isn't pushed from the server with the tab closed.
      if (state.behaviorOverrides?.[it.canonicalKey]?.reminderOff) continue;
      const sched = effectiveMinutes(it, state.settings);
      if (sched == null) continue;
      // Smart timing: fire at the learned typical completion time when there's
      // enough history (else the scheduled time). Only retimes already-timed
      // behaviors — untimed "anytime" items stay reminder-free.
      const t = learnedReminderMinutes(state, it.canonicalKey) ?? sched;
      // Quiet hours: never POST a time inside the user's do-not-disturb window
      // (the cron would otherwise push it overnight).
      if (inQuietHours(t, state.settings.quietHours)) continue;
      const h = Math.floor(t / 60) % 24;
      const m = t % 60;
      const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!times.includes(hm)) times.push(hm);
    }
    // Cap at 6 reminders/day so power-user stacks don't spam.
    const reminderTimes = times.sort().slice(0, 6);
    const key = `${tz}|${reminderTimes.join(",")}`;
    if (key === lastSubKeyRef.current) return;
    lastSubKeyRef.current = key;
    subscribeToPush({ reminderTimes, timezone: tz }).catch(() => {});
  }, [
    state.settings.notificationsEnabled,
    state.settings.timezone,
    state.settings.bedtime,
    state.settings.wakeTime,
    state.installedPacks?.length,
    state.customPacks?.length,
    loading,
    state,
  ]);

  // Effect 2 — in-tab foreground reminders. Fires when the user has
  // the app open. Server pushes handle the background case.
  useEffect(() => {
    if (
      loading ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !state.settings.notificationsEnabled ||
      Notification.permission !== "granted"
    )
      return;

    const tz = getTz(state.settings);
    const today = dateKeyInTz(tz);
    const dayIdx = dayIndexInTz(tz);
    const log = getLogForDate(state, today);
    // Mirror Today's exact pipeline so reminders fire for precisely the set
    // visible on the board: applySwaps first (a swapped-away workout's original
    // is muted), shapeTimeline WITH the keystone + mastered opts (a graduated /
    // keystone-protected behavior mutes the same way), then one-offs (honoring
    // overrides), snoozes, and stacks (so a stacked follower fires at its
    // rebased time). Without this, reminders pinged hidden/swapped behaviors.
    const swapped = applySwaps(compileTimeline(state, dayIdx), log);
    const shaped = shapeTimeline(swapped, adapt(state).mode, {
      keystoneKey: keystone(state)?.key,
      mastered: masteredKeys(state, today),
    });
    const items = applyStacks(
      applySnoozes(injectOneOffs(shaped, log, state.behaviorOverrides), log),
      state.behaviorOverrides,
      log.snoozes
    );
    // tz-aware: deltas use the same wall-clock basis as the target so an
    // in-tab reminder fires at the right local time (and doesn't drift ~60min
    // across a DST transition like nowMinutes()'s device-clock did).
    const now = nowMinutesInTz(tz);

    const timers: number[] = [];
    let scheduled = 0;
    for (const it of items) {
      if (scheduled >= 8) break;
      if (it.muted || isDone(log, it.canonicalKey)) continue;
      // Per-behavior opt-out: the user silenced reminders for this one.
      if (state.behaviorOverrides?.[it.canonicalKey]?.reminderOff) continue;
      const sched = effectiveMinutes(it, state.settings);
      if (sched == null) continue;
      // Smart timing: prefer the learned typical completion time when there's
      // enough history (see learnedReminderMinutes); else the scheduled time.
      const t = learnedReminderMinutes(state, it.canonicalKey) ?? sched;
      // Quiet hours: never fire inside the user's do-not-disturb window.
      if (inQuietHours(t, state.settings.quietHours)) continue;
      const deltaMin = t - now;
      // Fire when the scheduled minute is NOW (deltaMin === 0) too — the
      // server path matches the current minute via times.includes(hm), so
      // dropping deltaMin===0 here meant a behavior due "this minute" never
      // fired in-tab. Only skip already-past (<0) or far-future (>12h) times.
      if (deltaMin < 0 || deltaMin > 12 * 60) continue;
      scheduled++;
      const id = window.setTimeout(() => {
        navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(it.title, {
              body: it.dose || "It's time — open Protocolize.",
              tag: `pz-${it.canonicalKey}`,
              icon: "/icon.svg",
              badge: "/icon.svg",
              silent: false,
            })
          )
          .catch(() => {});
      }, Math.max(0, deltaMin) * 60 * 1000);
      timers.push(id);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [state, loading]);

  return null;
}
