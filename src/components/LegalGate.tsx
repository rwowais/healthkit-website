"use client";

/**
 * LegalGate — the one-time acceptance banner both legal pages promise.
 *
 * Shown when the user has finished onboarding but hasn't accepted the current
 * LEGAL_VERSION (see lib/legal.ts for the exact rules). A calm bottom sheet,
 * not a blocking wall: holding someone's health data hostage behind a legal
 * modal would be hostile, and courts don't require hostility — they require a
 * clear notice, a real link to the documents, and an affirmative act. The
 * banner persists until "I agree" is tapped; there is deliberately no
 * dismiss-without-accepting, because a dismissal records nothing.
 */
import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/hooks/useAppState";
import { needsLegalAcceptance, acceptanceStamp } from "@/lib/legal";

export default function LegalGate() {
  const { state, loading, updateSettings } = useAppState();
  const [saving, setSaving] = useState(false);

  if (loading || !needsLegalAcceptance(state)) return null;

  return (
    <div
      role="region"
      aria-label="Updated terms"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] bg-[var(--surface-1,var(--surface-2))] px-5 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] lg:pb-5"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="mx-auto max-w-[600px]">
        <p className="text-[13.5px] font-semibold text-[var(--text-1)]">
          We&rsquo;ve updated our Terms &amp; Privacy Policy
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
          Please review the{" "}
          <Link href="/terms" className="text-[var(--readiness)] underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-[var(--readiness)] underline">
            Privacy Policy
          </Link>
          . Continuing to use Protocolize means you accept the current
          versions.
        </p>
        <button
          disabled={saving}
          aria-busy={saving}
          onClick={() => {
            // updateSettings persists through the active data source, so the
            // stamp lands in the synced row — the record survives this device.
            setSaving(true);
            updateSettings(acceptanceStamp());
          }}
          className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[var(--bg)] disabled:opacity-60"
        >
          I agree
        </button>
      </div>
    </div>
  );
}
