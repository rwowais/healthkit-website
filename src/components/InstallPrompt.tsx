"use client";

import { useEffect, useState, useCallback } from "react";
import { useIsInstalled } from "@/hooks/useIsInstalled";

/**
 * Calm, platform-aware install prompt.
 *
 * Three audiences, three flows:
 *  - Android/Chrome/Edge: catches the `beforeinstallprompt` event and
 *    surfaces a custom card. One tap fires the OS install dialog.
 *  - iOS Safari: no beforeinstallprompt — Apple keeps install manual.
 *    We show an illustrated overlay pointing at the Share icon and
 *    "Add to Home Screen" so the user can do it themselves.
 *  - Desktop Chrome/Edge/Brave: same as Android — beforeinstallprompt
 *    fires, we surface a subtle bottom-right hint.
 *
 * Anti-annoyance rules:
 *  - Never shows if the user has already installed (useIsInstalled).
 *  - Never shows on the FIRST page view — only after 30s of session
 *    time OR after the user has navigated to a second route. New
 *    visitors shouldn't be hit with "install me" before they've even
 *    seen what the app does.
 *  - Once dismissed, doesn't re-appear for 14 days (per-device
 *    localStorage stamp). If they really want to dismiss it, they can.
 *  - Doesn't show on /privacy, /terms, /auth — distinct user intent.
 *  - On iOS, hidden inside non-Safari browsers (no Add-to-Home-Screen
 *    path exists there; lying about it would be cruel).
 */
const DISMISS_KEY = "pz-install-dismissed";
const DISMISS_DAYS = 14;
const SUPPRESS_PATHS = ["/privacy", "/terms", "/auth", "/auth/reset"];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android-chrome" | "ios-safari" | "desktop" | "ios-other" | "other";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  // Desktop heuristic: no touch event support typically means desktop.
  // (Imperfect but good enough for distinguishing "show a corner hint"
  //  from "show a centered card.")
  const touchPoints = window.navigator.maxTouchPoints || 0;
  if (touchPoints === 0) return "desktop";
  return "android-chrome";
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function stampDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

export default function InstallPrompt() {
  const installState = useIsInstalled();
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  // Detect platform + pick up beforeinstallprompt. Set the "ready"
  // gate to true only after 30 seconds OR after a navigation event —
  // whichever comes first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(detectPlatform());
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const onNav = () => setReady(true);
    window.addEventListener("popstate", onNav);
    const t = window.setTimeout(() => setReady(true), 30_000);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("popstate", onNav);
      window.clearTimeout(t);
    };
  }, []);

  // Decide whether to surface the card. Re-evaluates whenever the
  // gating inputs change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (installState !== "browser") return; // installed or unknown
    if (isDismissed()) return;
    if (!ready) return;
    if (SUPPRESS_PATHS.some((p) => window.location.pathname.startsWith(p)))
      return;
    if (platform === "ios-other") return; // can't install there
    // Android/desktop: need the deferred prompt to be available.
    if (
      (platform === "android-chrome" || platform === "desktop") &&
      !deferred
    )
      return;
    setOpen(true);
  }, [installState, ready, platform, deferred]);

  const onDismiss = useCallback(() => {
    stampDismiss();
    setOpen(false);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      stampDismiss(); // either way, don't re-prompt soon
      if (choice.outcome === "accepted") {
        setOpen(false);
      } else {
        setOpen(false);
      }
    } catch {
      setOpen(false);
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  if (!open) return null;

  // iOS Safari — illustrated guide. Apple requires manual install via
  // Share → Add to Home Screen. We show the user exactly which icons
  // to tap so they don't have to figure it out.
  if (platform === "ios-safari") {
    return (
      <div
        className="fixed inset-x-0 z-50 anim-rise"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
        role="dialog"
        aria-labelledby="install-title"
      >
        <div
          className="mx-auto max-w-md rounded-[var(--r-md)] p-5 shadow-2xl"
          style={{
            margin: "0 16px",
            background: "var(--surface-3)",
            border: "1px solid var(--hairline-strong)",
          }}
        >
          <p className="t-eyebrow" style={{ color: "var(--readiness)" }}>
            Add to home screen
          </p>
          <h2
            id="install-title"
            className="mt-1.5 text-[16px] font-semibold text-[var(--text-1)]"
          >
            Get the full Protocolize experience
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
            Adds an icon to your home screen, opens full-screen with no
            Safari bar, and lets reminders fire even when this page is
            closed.
          </p>
          <ol className="mt-4 space-y-3 text-[13.5px] text-[var(--text-2)]">
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                }}
              >
                1
              </span>
              <span>
                Tap the{" "}
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded mx-0.5 align-middle"
                  style={{ background: "var(--surface-2)" }}
                  aria-label="Share icon"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ color: "var(--readiness)" }}
                  >
                    <path d="M12 3v12" />
                    <path d="m7 8 5-5 5 5" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                </span>{" "}
                Share icon in Safari&apos;s toolbar
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                }}
              >
                2
              </span>
              <span>
                Scroll down and tap{" "}
                <strong className="text-[var(--text-1)]">
                  Add to Home Screen
                </strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                }}
              >
                3
              </span>
              <span>
                Tap <strong className="text-[var(--text-1)]">Add</strong> in
                the top-right corner
              </span>
            </li>
          </ol>
          <button
            onClick={onDismiss}
            className="press tr-fast mt-5 w-full rounded-[var(--r-pill)] bg-[var(--surface-2)] py-3 text-[13px] font-semibold text-[var(--text-2)]"
          >
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  // Android / desktop — one-tap install via beforeinstallprompt.
  // Subtler card at bottom; desktop gets bottom-right corner.
  const isDesktop = platform === "desktop";
  return (
    <div
      className="fixed z-50 anim-rise"
      style={
        isDesktop
          ? { bottom: 24, right: 24, maxWidth: 360 }
          : {
              insetInline: 0,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            }
      }
      role="dialog"
      aria-labelledby="install-title-cta"
    >
      <div
        className="mx-auto rounded-[var(--r-md)] p-4 shadow-2xl"
        style={{
          margin: isDesktop ? 0 : "0 16px",
          maxWidth: isDesktop ? 360 : 480,
          background: "var(--surface-3)",
          border: "1px solid var(--hairline-strong)",
        }}
      >
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-96.png"
            alt=""
            width={48}
            height={48}
            className="rounded-[12px] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2
              id="install-title-cta"
              className="text-[14.5px] font-semibold text-[var(--text-1)]"
            >
              Install Protocolize
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-3)]">
              {isDesktop
                ? "One click — Protocolize opens in its own window, no browser tab needed."
                : "Adds to your home screen. Reminders work even when the app is closed."}
            </p>
          </div>
        </div>
        <div className="mt-3.5 flex gap-2">
          <button
            onClick={onDismiss}
            className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--surface-2)] py-2 text-[12.5px] font-semibold text-[var(--text-2)]"
          >
            Not now
          </button>
          <button
            onClick={onInstall}
            className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12.5px] font-semibold text-[#08090B]"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
