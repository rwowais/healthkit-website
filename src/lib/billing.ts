/**
 * billing.ts — checkout entry point, env-gated like Supabase was.
 *
 * Inert until a Stripe payment link / checkout is configured by the
 * owner (NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL / _MONTHLY). Until then
 * `billingConfigured` is false and the UI shows a calm "coming soon"
 * instead of a broken button. No secret keys ever live client-side;
 * Stripe Payment Links are the simplest no-backend path.
 */
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

/** Returns false (with reason) when billing isn't wired yet. */
export function startCheckout(plan: Plan): { ok: boolean; reason?: string } {
  const url = LINKS[plan];
  if (!url) {
    return {
      ok: false,
      reason:
        "Payments aren't switched on yet — you're on the free plan with full trial access. Nothing to do.",
    };
  }
  if (typeof window !== "undefined") window.location.href = url;
  return { ok: true };
}

export const PRICING = {
  annual: { price: "$79.99", per: "/year", note: "Best value · ~26% off" },
  monthly: { price: "$8.99", per: "/month", note: "Flexible" },
  lifetime: { price: "$179", per: "once", note: "Pay once, keep forever" },
} as const;
