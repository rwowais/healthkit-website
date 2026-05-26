"use client";

import { useEffect, useState } from "react";
import { SAVE_ERROR_EVENT } from "@/lib/storage";

/**
 * Listens for SAVE_ERROR_EVENT (dispatched from storage.ts and
 * datasource.ts when a localStorage or cloud write fails) and shows
 * a calm persistent banner the user can actually see + act on.
 *
 * Why a custom banner instead of the useToast primitive:
 *   Toasts auto-dismiss after a few seconds. A storage write failure
 *   is the kind of thing that needs to stay on screen until the user
 *   acknowledges it — otherwise they might miss it and lose hours of
 *   data thinking everything is fine. This banner is sticky and
 *   dismiss-only-on-user-action.
 *
 * Detail shapes (from storage.ts / datasource.ts):
 *   - "local"        — localStorage write failed (quota, private mode)
 *   - "cloud"        — Supabase write failed (network, RLS, schema)
 *   - "cloud-clear"  — Supabase clear failed (reset flow)
 */
export default function StorageSafetyNet() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (detail === "local") {
        setError(
          "Couldn't save your latest change locally — your device storage may be full or this tab is in private mode. Your previous data is still safe."
        );
      } else if (detail === "cloud") {
        setError(
          "Couldn't sync your latest change to the cloud — you're offline or our server is unreachable. Your local copy is up to date and will sync when you're back online."
        );
      } else if (detail === "cloud-clear") {
        setError(
          "Couldn't clear your cloud data — check your connection and try again from Profile."
        );
      } else {
        setError("A save attempt failed. Your local copy is still safe.");
      }
    };
    window.addEventListener(SAVE_ERROR_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(SAVE_ERROR_EVENT, handler as EventListener);
  }, []);

  if (!error) return null;
  return (
    <div
      className="fixed inset-x-0 z-50 px-4 anim-rise"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        className="mx-auto max-w-md rounded-[var(--r-md)] p-3.5 flex items-start gap-3 shadow-lg"
        style={{
          background: "var(--surface-3)",
          border: "1px solid var(--alert)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[var(--alert)]">
            Save problem
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {error}
          </p>
        </div>
        <button
          onClick={() => setError(null)}
          className="press text-[12px] font-semibold text-[var(--text-3)] shrink-0"
          aria-label="Dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
