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
  const { state, loading, updateSettings, saveNow } = useAppState();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // While saving, keep rendering even though local state already satisfies
  // needsLegalAcceptance — the banner must not disappear until the stamp is
  // CONFIRMED in the cloud. Vanishing on the local write alone is what let a
  // slow connection silently drop the record (caught by CI, 2026-08-30).
  if (loading || (!needsLegalAcceptance(state) && !saving)) return null;

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
          . Continuing to use Diurna means you accept the current
          versions.
        </p>
        <button
          disabled={saving}
          aria-busy={saving}
          onClick={async () => {
            setSaving(true);
            setFailed(false);
            const stamp = acceptanceStamp();
            updateSettings(stamp);
            // Await the round-trip rather than trusting the debounce: this
            // stamp IS the legal record, so a silent failure is worse than a
            // visible retry. saveNow is given the next state explicitly
            // because setState has not applied yet at this point.
            const ok = await saveNow({
              ...state,
              settings: { ...state.settings, ...stamp },
            });
            setSaving(false);
            if (!ok) setFailed(true);
          }}
          className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[var(--bg)] disabled:opacity-60"
        >
          {saving ? "Saving…" : failed ? "Try again" : "I agree"}
        </button>
        {failed && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--alert)]">
            Couldn&rsquo;t save that just now — check your connection and tap
            again.
          </p>
        )}
      </div>
    </div>
  );
}
