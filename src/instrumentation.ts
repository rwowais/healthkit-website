/**
 * Server / edge error monitoring (Sentry) — INERT until configured.
 *
 * Mirrors instrumentation-client.ts for the server side (API routes like
 * /api/cms/generate and /api/push/*, plus the push cron). Static import
 * is fine here: server bundles never ship to the browser, so there's no
 * client-bundle cost. `register()` no-ops without a DSN, and
 * onRequestError is a no-op until Sentry.init has run — so this is fully
 * inert until SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return; // inert until configured
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? "development",
  });
}

// Next calls this on uncaught server/render errors; Sentry forwards them.
// No-op until init() above has run (i.e. until a DSN is configured).
export const onRequestError = Sentry.captureRequestError;
