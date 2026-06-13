"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/hooks/useAppState";
import { deviceTz, tzLabel, isValidTz, dateKeyInTz } from "@/lib/tz";

/**
 * Detects when the user's device timezone disagrees with the
 * timezone stored in settings (e.g. they travelled, or their phone
 * auto-shifted). Surfaces a one-time, dismissable banner offering to
 * update the stored zone. No automatic switching — the user owns the
 * choice (some users travel briefly and *want* their schedule to
 * stay anchored to home time).
 *
 * Why not auto-update:
 *   A user who's spending Saturday in another city probably wants
 *   their bedtime/wake/anchors to still reflect their home routine
 *   — silent re-anchoring would shift every behavior on their
 *   timeline. A relocation, on the other hand, definitely warrants
 *   the update. Only the user can tell those two apart, so we ask.
 *
 * Storage: once dismissed (no), we stamp localStorage with the
 * device tz so we don't nag again until the device tz changes
 * again. Once accepted, settings.timezone updates and the question
 * is moot.
 */
const DISMISS_KEY = "pz-tz-dismissed";

export default function TimezoneSentry() {
  const { state, updateSettings } = useAppState();
  const [show, setShow] = useState(false);
  const [device, setDevice] = useState("");

  useEffect(() => {
    const stored = state?.settings?.timezone;
    if (!stored || !isValidTz(stored)) {
      // No stored tz yet — let the user set it explicitly via Profile
      // or onboarding. Don't pop a "your timezone changed" banner for
      // someone who hasn't set one to begin with.
      return;
    }
    const dev = deviceTz();
    if (dev === stored) {
      // Home again (device matches the stored zone). Clear any stale "Not now"
      // dismiss so a FUTURE trip to a previously-dismissed zone prompts again —
      // a dismiss is meant to silence the current trip, not permanently mute
      // re-anchoring every time the traveler revisits that city.
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
      return;
    }
    // Has the user already dismissed this exact device tz?
    let dismissed = "";
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) ?? "";
    } catch {}
    if (dismissed === dev) return;
    setDevice(dev);
    setShow(true);
  }, [state?.settings?.timezone]);

  if (!show) return null;
  // Westward move (the new zone's current calendar day is EARLIER than the
  // stored zone's): accepting the update steps Today's board back a day. Warn
  // so the user isn't startled when the day appears to rewind — their logged
  // progress is preserved (readers are immune to a future-dated day) and
  // reappears when that date comes around.
  let dayWillRewind = false;
  try {
    const stored = state?.settings?.timezone;
    if (stored && isValidTz(stored) && device) {
      dayWillRewind = dateKeyInTz(device) < dateKeyInTz(stored);
    }
  } catch {
    dayWillRewind = false;
  }
  return (
    <div
      className="fixed inset-x-0 z-40 px-4 anim-rise"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="mx-auto max-w-md rounded-[var(--r-md)] p-4 shadow-lg"
        style={{
          background: "var(--surface-3)",
          border: "1px solid var(--hairline-strong)",
        }}
      >
        <p className="text-[12px] font-semibold text-[var(--readiness)]">
          Looks like you&apos;ve moved
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
          Your device is in <strong className="text-[var(--text-1)]">{tzLabel(device)}</strong>{" "}
          but your protocols are anchored to{" "}
          <strong className="text-[var(--text-1)]">
            {tzLabel(state?.settings?.timezone ?? "UTC")}
          </strong>. Update to your new timezone?
        </p>
        {dayWillRewind && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-3)]">
            It&apos;s an earlier date here, so today&apos;s board will step back
            a day. Anything you already logged stays saved.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, device);
              } catch {}
              setShow(false);
            }}
            className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--surface-2)] py-2 text-[12.5px] font-semibold text-[var(--text-2)]"
          >
            Not now
          </button>
          <button
            onClick={() => {
              updateSettings({ timezone: device });
              try {
                localStorage.removeItem(DISMISS_KEY);
              } catch {}
              setShow(false);
            }}
            className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12.5px] font-semibold text-[var(--bg)]"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
