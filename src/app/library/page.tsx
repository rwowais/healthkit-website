"use client";

/**
 * /library is a legacy route — the catalog lives in /protocols#discover
 * now (Library + Protocols were two tabs for one workflow). This page
 * exists only to keep old bookmarks / search results / nav links
 * working; it redirects on mount and shows a one-line note if JS is
 * disabled or the redirect is slow. No design effort here on purpose —
 * users should never see this page for more than a render tick.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LibraryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/protocols#discover");
  }, [router]);
  return (
    <div className="min-h-screen p-6 text-[14px] text-[var(--text-3)]">
      Redirecting to Protocols…
    </div>
  );
}
