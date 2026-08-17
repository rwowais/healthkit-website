"use client";

/**
 * CheckoutReturn — the moment between paying Stripe and Premium appearing.
 *
 * Stripe redirects the customer back to us as soon as their card clears, but
 * the entitlement is written by the fulfillment WEBHOOK, which is a separate
 * server-to-server call. That call is usually sub-second and occasionally is
 * not. Without this screen the customer lands on a page that still says "Free"
 * and still shows an Upgrade button immediately after being charged — the
 * single worst moment in the whole funnel to look broken.
 *
 * So: poll the one entitlement row until Premium shows up, and be honest at
 * every stage. We never claim the payment failed — we can't know that from
 * here, and telling a paying customer their payment failed is worse than
 * telling them it's still processing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { activeDataSource } from "@/lib/datasource";

/** Total time we keep polling before switching to the "taking a while" copy. */
const DEADLINE_MS = 45_000;
const INTERVAL_MS = 2_000;

type Phase = "waiting" | "confirmed" | "slow";

export default function CheckoutReturn({ onDismiss }: { onDismiss: () => void }) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const deadline = Date.now() + DEADLINE_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled.current) return;
      let paid = false;
      try {
        const ent = await activeDataSource.refreshEntitlement();
        paid = ent?.paidTier === "premium";
      } catch {
        // Transient/offline — indistinguishable from "not written yet", so
        // just keep polling until the deadline.
      }
      if (cancelled.current) return;
      if (paid) {
        setPhase("confirmed");
        return;
      }
      if (Date.now() >= deadline) {
        setPhase("slow");
        return;
      }
      timer = setTimeout(poll, INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Full reload rather than a client-side route change: entitlement gating is
  // read during render all over the app, so the only way to guarantee every
  // surface sees Premium is to start a fresh load.
  const goToToday = useCallback(() => {
    if (typeof window !== "undefined") window.location.assign("/today");
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/95 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-return-title"
    >
      <div className="w-full max-w-sm text-center">
        {phase === "waiting" && (
          <>
            <div
              className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[var(--hairline)] border-t-[var(--text-1)]"
              aria-hidden="true"
            />
            <h1
              id="checkout-return-title"
              className="mt-5 text-[19px] font-semibold tracking-tight text-[var(--text-1)]"
            >
              Confirming your payment…
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
              This usually takes a second. Please don&rsquo;t close the app.
            </p>
          </>
        )}

        {phase === "confirmed" && (
          <>
            <div
              className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--vitality)]/15 text-[var(--vitality)]"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1
              id="checkout-return-title"
              className="mt-5 text-[19px] font-semibold tracking-tight text-[var(--text-1)]"
            >
              You&rsquo;re Premium
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
              Everything is unlocked, and anything that was paused is back
              exactly as you left it.
            </p>
            <button
              onClick={goToToday}
              className="press tr-fast mt-6 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3.5 text-[15px] font-semibold text-[var(--bg)]"
            >
              Go to Today
            </button>
          </>
        )}

        {phase === "slow" && (
          <>
            <h1
              id="checkout-return-title"
              className="text-[19px] font-semibold tracking-tight text-[var(--text-1)]"
            >
              Your payment is still processing
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
              Stripe has your payment — it just hasn&rsquo;t reached us yet.
              Premium will switch on by itself, usually within a few minutes.
              Nothing is lost, and you won&rsquo;t be charged twice.
            </p>
            <button
              onClick={goToToday}
              className="press tr-fast mt-6 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3.5 text-[15px] font-semibold text-[var(--bg)]"
            >
              Continue to Today
            </button>
            <button
              onClick={onDismiss}
              className="press tr-fast mt-2 w-full py-2 text-[13px] font-medium text-[var(--text-3)]"
            >
              Stay on this page
            </button>
          </>
        )}
      </div>
    </div>
  );
}
