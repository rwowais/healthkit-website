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
import { getUserId, getUserEmail } from "./supabase";

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

/**
 * ── Managing an existing subscription ──────────────────────────────────────
 *
 * Stripe's HOSTED customer portal login page
 * (Dashboard → Settings → Billing → Customer portal → share a login link).
 * The customer enters the email they paid with and Stripe emails them a link
 * into the portal, where they can cancel, switch plan, update their card and
 * download invoices.
 *
 * Why the hosted page rather than a one-click portal session: creating a
 * session requires the Stripe SECRET key, which means a server we do not have
 * (the whole reason checkout is Payment Links). A secret key can never live in
 * this bundle. The hosted page costs the customer one extra step and keeps the
 * app backend-free. If a server appears later, swap this for a portal session
 * and the call site below does not change.
 */
const PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL;

export const portalConfigured = Boolean(PORTAL_URL);

/**
 * May this user be offered billing management?
 *
 * Both halves matter. Without a configured portal there is nowhere to send
 * them; and an entitlement that did NOT come from Stripe (a manual comp —
 * e.g. the owner's lifetime grant) has no Stripe customer record behind it, so
 * the portal would dead-end on "we couldn't find that account". Offering a
 * broken exit is worse than offering none.
 */
export function canManageBilling(
  entitlement: { source?: string | null } | null | undefined
): boolean {
  return portalConfigured && entitlement?.source === "stripe";
}

/**
 * Opens the billing portal, prefilling the signed-in email so the customer
 * usually just clicks "send link".
 *
 * Gate the call site with canManageBilling().
 */
export async function openBillingPortal(): Promise<CheckoutResult> {
  if (!PORTAL_URL) {
    return { ok: false, reason: "Billing management isn't available yet." };
  }
  let target: string;
  try {
    const u = new URL(PORTAL_URL);
    const email = await getUserEmail().catch(() => null);
    // Prefill is a convenience only — the portal works without it, so a
    // missing email must not block someone from reaching their subscription.
    if (email) u.searchParams.set("prefilled_email", email);
    target = u.toString();
  } catch {
    return { ok: false, reason: "Billing management isn't configured correctly." };
  }
  if (typeof window !== "undefined") window.location.href = target;
  return { ok: true };
}

export const PRICING = {
  annual: { price: "$79.99", per: "/year", note: "Best value · ~26% off" },
  monthly: { price: "$8.99", per: "/month", note: "Flexible" },
  lifetime: { price: "$179", per: "once", note: "Pay once, keep forever" },
} as const;
