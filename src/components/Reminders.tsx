"use client";

import { useEffect } from "react";
import { useAppState } from "@/hooks/useAppState";
import { getLogForDate } from "@/lib/storage";
import {
  compileTimeline,
  shapeTimeline,
  adapt,
  isDone,
} from "@/lib/engine";
import { resolveMinutes, nowMinutes } from "@/lib/time";

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Best-effort foreground reminders. While Protocolize is open in a tab,
 * schedules a notification at each upcoming behavior's anchored time.
 * (Full background reminders require the native app — communicated in UI.)
 */
export default function Reminders() {
  const { state, loading } = useAppState();

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

    const today = dateKey(new Date());
    const j = new Date().getDay();
    const dayIdx = j === 0 ? 6 : j - 1;
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
      if (deltaMin <= 0 || deltaMin > 12 * 60) continue; // next 12h only
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
