"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { isPublicPath } from "@/lib/authGate";

/**
 * AuthGate — the account wall.
 *
 * When Supabase is configured (the live app), nobody may use the app
 * without a signed-in account: any visit to a protected route while
 * signed out is redirected to /auth. The free trial activates during
 * onboarding, which is itself behind the wall, so the funnel is:
 *
 *   landing → create account / log in → onboarding (trial starts) → app
 *
 * When Supabase is NOT configured (local dev with no env), the wall is
 * inert and the app runs in its original guest/local mode — so the app
 * stays fully buildable and testable without an auth backend.
 *
 * Data safety: this gate only ever NAVIGATES. It never clears local
 * storage. An existing guest's local data is therefore intact when they
 * land on /auth, and the datasource's first-sign-in merge uploads it into
 * their new account on the next load (no data loss on the cutover).
 */

type Status = "pending" | "authed" | "anon";

/**
 * True when the current URL is an auth callback — a magic-link / OAuth /
 * email-confirmation return that lands (per auth.ts redirects) on a PROTECTED
 * route like /today with the session tokens still in the URL. The Supabase
 * client parses these asynchronously (detectSessionInUrl), so getSession() can
 * read null for one tick before SIGNED_IN fires. We must NOT treat that
 * transient null as "signed out" or we'd bounce a just-authenticated user
 * back to /auth.
 */
function urlHasAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  const s = window.location.search;
  return (
    h.includes("access_token") ||
    h.includes("error_description") ||
    /[?&](code|token_hash|error)=/.test(s)
  );
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    // No wall when Supabase is off → treat everyone as authed (guest mode).
    supabaseEnabled ? "pending" : "authed"
  );

  // Resolve the session once and keep it in sync. getSession() is local
  // (no network), so the "pending" splash is a single tick for real users.
  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = getSupabase();
    if (!sb) {
      setStatus("authed");
      return;
    }
    let alive = true;
    // On an auth-callback URL, hold "pending" on a null session and let the
    // SIGNED_IN event (below) resolve it — see urlHasAuthCallback().
    const callback = urlHasAuthCallback();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      if (session) setStatus("authed");
      else if (!callback) setStatus("anon");
      // else: stay pending; the auth event resolves it.
    });
    // Re-evaluate on sign-in / sign-out so signing out bounces to /auth and
    // a fresh sign-in (incl. email-link / OAuth return) drops the wall.
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, session) => {
      if (alive) setStatus(session ? "authed" : "anon");
    });
    // Safety net: never strand a user on the splash. If a callback never
    // yields a session (e.g. an expired/invalid link), fall back to anon so
    // the wall sends them to /auth instead of an infinite spinner.
    const t = callback
      ? setTimeout(() => {
          if (alive) setStatus((s) => (s === "pending" ? "anon" : s));
        }, 4000)
      : null;
    return () => {
      alive = false;
      subscription.unsubscribe();
      if (t) clearTimeout(t);
    };
  }, []);

  const isPublic = isPublicPath(pathname);

  // Redirect a signed-out visitor off any protected route. Effect (not
  // render) so navigation is a side effect, never during render.
  useEffect(() => {
    if (!supabaseEnabled) return;
    if (status === "anon" && !isPublic) {
      router.replace("/auth");
    }
  }, [status, isPublic, router]);

  // Public routes always render (landing, auth, legal). Protected routes
  // render only once we KNOW the visitor is authed; while pending, or while
  // an anon redirect is in flight, show a calm splash so no protected
  // content (or its data fetches) mounts behind the wall.
  if (isPublic || !supabaseEnabled || status === "authed") {
    return <>{children}</>;
  }
  return <GateSplash />;
}

function GateSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
      <span
        className="grid h-10 w-10 animate-pulse place-items-center rounded-[12px]"
        style={{
          background: "linear-gradient(145deg, var(--sleep), var(--readiness))",
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--bg)]" />
      </span>
    </div>
  );
}
