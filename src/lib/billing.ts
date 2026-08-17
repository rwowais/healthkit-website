/**
 * billing.ts — checkout entry point, env-gated like Supabase was.
 *
 * Inert until a Stripe payment link / checkout is configured by the
 * owner (NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL / _MONTHLY). Until then
 * `billingConfigured` is false and the UI shows a calm "coming soon"
 * instead of a broken button. No secret keys ever live client-side;
 * Stripe Payment Links are the simplest no-backend path.
 *
 * FULFILLMENT CONTRACT (the reason this file is not a one-liner):
 * a payment is only deliverable if Stripe can tell us WHOSE it was. We attach
 * the Supabase user id as Stripe's `client_reference_id`; the fulfillment
 * webhook (supabase/functions/stripe-webhook) reads it back and stamps that
 * user's row in protocolize_entitlements. Without it a customer is charged and
 * nothing can grant them Premium — so every failure path below REFUSES to open
 * checkout rather than sending someone to a checkout we cannot fulfill.
 */
import { getUserId } from "./supabase";

export type Plan = "annual" | "monthly" | "lifetime";

const LINKS: Record<Plan, string | undefined> = {
  annual: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL,
  monthly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_MONTHLY,
  lifetime: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_LIFETIME,
};

export const billingConfigured = Boolean(
  LINKS.annual || LINKS.monthly || LINKS.lifetime
);

export function planLink(plan: Plan): string | undefined {
  return LINKS[plan];
}

export interface CheckoutResult {
  ok: boolean;
  reason?: string;
  /** True when the only thing missing is a signed-in account. */
  needsAuth?: boolean;
}

/**
 * Attaches the buyer's user id to a Stripe Payment Link.
 *
 * Uses the URL API rather than string concatenation so a link that already
 * carries query params (e.g. `?prefilled_email=`) keeps them, and so a
 * malformed link throws here instead of silently producing a broken URL.
 * Exported for tests.
 */
export function withClientReference(url: string, userId: string): string {
  const u = new URL(url);
  u.searchParams.set("client_reference_id", userId);
  return u.toString();
}

/**
 * Sends the user to Stripe. Async because the buyer's identity has to be
 * resolved before we can safely hand off.
 */
export async function startCheckout(plan: Plan): Promise<CheckoutResult> {
  const url = LINKS[plan];
  if (!url) {
    // NOTE: currently unreachable from the UI (the upgrade page only renders
    // the checkout button when billingConfigured) — kept as the honest guard
    // for any future caller. Copy must not claim "trial access": the caller
    // may be a trial-expired user.
    return {
      ok: false,
      reason: "Payments aren't switched on yet — nothing to do here.",
    };
  }

  // No account = no row to grant Premium to. Stripe would take the money and
  // the webhook would have nothing to write against, so stop BEFORE checkout.
  let userId: string | null = null;
  try {
    userId = await getUserId();
  } catch {
    userId = null;
  }
  if (!userId) {
    return {
      ok: false,
      needsAuth: true,
      reason: "Sign in first so we can attach Premium to your account.",
    };
  }

  let target: string;
  try {
    target = withClientReference(url, userId);
  } catch {
    // A misconfigured link is an owner error, but the user must never be sent
    // to an unfulfillable checkout because of it.
    return {
      ok: false,
      reason: "Checkout isn't configured correctly — please contact support.",
    };
  }

  if (typeof window !== "undefined") window.location.href = target;
  return { ok: true };
}

export const PRICING = {
  annual: { price: "$79.99", per: "/year", note: "Best value · ~26% off" },
  monthly: { price: "$8.99", per: "/month", note: "Flexible" },
  lifetime: { price: "$179", per: "once", note: "Pay once, keep forever" },
} as const;
