"use client";

/**
 * /library is a legacy route — the catalog lives in /protocols#discover
 * now (Library + Protocols were two tabs for one workflow). This page
 * exists to keep old bookmarks / search results / nav links working.
 * It auto-redirects on mount, AND renders a branded panel with an
 * explicit "Take me there" button so:
 *   - if the redirect hangs (slow client, JS disabled, prefetch race),
 *     the user gets a clear, tappable affordance instead of the
 *     previous unstyled "Redirecting…" line that looked broken;
 *   - the screen reads on-brand if shared as a link.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { Card, Eyebrow, Button } from "@/components/ui";

export default function LibraryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/protocols#discover");
  }, [router]);
  return (
    <Shell>
      <Card>
        <Eyebrow>The Library moved</Eyebrow>
        <h1 className="t-title mt-2 text-[var(--text-1)]">
          Now part of Protocols
        </h1>
        <p className="t-caption mt-2 leading-relaxed">
          Browse, install, and manage protocols all in one place.
          You&apos;ll be redirected — or tap below to jump now.
        </p>
        <div className="mt-5">
          <Button full onClick={() => router.replace("/protocols#discover")}>
            Take me to Protocols
          </Button>
        </div>
      </Card>
    </Shell>
  );
}
