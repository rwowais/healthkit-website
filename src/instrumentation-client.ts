/**
 * Client-side error monitoring (Sentry) — INERT until configured.
 *
 * The single biggest visibility gap for this app is browser errors:
 * it's client-first (PWA, localStorage, all pages "use client"), so the
 * crashes that actually bite users — React render errors, failed
 * Supabase client calls, hydration mismatches — never reach Vercel's
 * server logs. This wires Sentry to catch them.
 *
 * Env-gated exactly like Plausible/Stripe: with no
 * NEXT_PUBLIC_SENTRY_DSN the SDK is never even imported, so zero bytes
 * ship to users and there is no runtime cost until you flip it on by
 * setting the DSN in Vercel. To enable: create a free Sentry project,
 * copy its DSN, add NEXT_PUBLIC_SENTRY_DSN in Vercel env vars, redeploy.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Dynamic import so the Sentry bundle is excluded entirely when no DSN
  // is set (the import only runs inside this guard).
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      // Calm defaults for a low-volume PWA: errors only, no perf tracing
      // or session replay (opt in later if wanted), no PII.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      environment:
        process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    });
  });
}
