"use client";

/**
 * Route-level error boundary. Unlike global-error.tsx (which only fires
 * when the root layout itself throws and must re-render <html>), this
 * catches errors thrown while rendering any page *inside* the layout —
 * so the app chrome/theme stays intact and the user gets a calm, on-brand
 * recovery instead of a blank white screen. Reports to Sentry (a no-op
 * without a DSN, so safe whether or not monitoring is configured).
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <h2 className="text-[18px] font-bold text-[var(--text-1)]">
        Something went wrong
      </h2>
      <p className="mt-2.5 max-w-[320px] text-[14px] leading-relaxed text-[var(--text-3)]">
        A rare error interrupted this screen. Your data is saved on this device
        — nothing is lost.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="press tr-fast rounded-[var(--r-pill)] bg-[var(--text-1)] px-6 py-3 text-[13px] font-semibold text-[#08090B]"
        >
          Try again
        </button>
        <Link
          href="/today"
          className="press tr-fast rounded-[var(--r-pill)] px-6 py-3 text-[13px] font-medium text-[var(--text-3)]"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
