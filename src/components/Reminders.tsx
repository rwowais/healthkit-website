"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import {
  compileTimeline,
  shapeTimeline,
  adapt,
  isDone,
} from "@/lib/engine";
import { resolveMinutes, nowMinutes } from "@/lib/time";
import { getTz, dateKeyInTz, dayIndexInTz } from "@/lib/tz";
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
    const items = shapeTimeline(
      compileTimeline(state, dayIdx),
      adapt(state).mode
    );
    const times: string[] = [];
    for (const it of items) {
      if (it.muted) continue;
      const t = resolveMinutes(it, state.settings);
      if (t == null) continue;
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
    const items = shapeTimeline(
      compileTimeline(state, dayIdx),
      adapt(state).mode
    );
    const now = nowMinutes();

    const timers: number[] = [];
    let scheduled = 0;
    for (const it of items) {
      if (scheduled >= 8) break;
      if (it.muted || isDone(log, it.canonicalKey)) continue;
      const t = resolveMinutes(it, state.settings);
      if (t == null) continue;
      const deltaMin = t - now;
      if (deltaMin <= 0 || deltaMin > 12 * 60) continue;
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
      }, deltaMin * 60 * 1000);
      timers.push(id);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [state, loading]);

  return null;
}
