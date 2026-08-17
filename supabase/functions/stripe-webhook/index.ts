// Supabase Edge Function — Stripe fulfillment webhook (SEC-1 Phase 2).
//
// ⚠️ NOT DEPLOYED YET. This is the fulfillment path that stamps a user's
// server-authoritative entitlement (public.protocolize_entitlements) after a
// successful payment. It is the ONLY thing (besides a manual admin grant) that
// can set paid_tier='premium'. Deploy it — and set the env/secrets below —
// BEFORE turning on any Stripe Payment Link, or customers would be charged
// without receiving Premium.
//
// ── Owner steps to go live (≈15 min) ────────────────────────────────────────
// 1. In Stripe: create your products/prices (monthly $8.99, annual $79.99,
//    lifetime $179 one-time) and the Payment Links.
//    a. Buyer identity: DO NOT rely on email matching. billing.ts appends
//       ?client_reference_id=<supabase user id> to the checkout URL (SHIPPED
//       2026-08-17), and it refuses to open checkout at all if it cannot
//       attach that id — so this webhook always knows whose entitlement to set.
//    b. On each Payment Link, set "After payment" → "Redirect customers to"
//       https://<your-domain>/upgrade?checkout=success
//       That query param drives the CheckoutReturn screen, which polls the
//       entitlement row until THIS webhook has written it. Without the
//       redirect the customer lands back on a page still selling Premium.
// 2. Deploy: `supabase functions deploy stripe-webhook --no-verify-jwt`
//    (--no-verify-jwt because Stripe calls it, not a signed-in user; we verify
//    the Stripe signature instead).
// 3. Set secrets:
//    supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//    supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   (from the endpoint)
//    (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// 4. In Stripe → Developers → Webhooks, add the function URL and subscribe to:
//    checkout.session.completed, customer.subscription.updated,
//    customer.subscription.deleted. Copy the signing secret into step 3.
// 5. Test in Stripe test mode end-to-end BEFORE flipping live keys.
//
// This file is authored but untested against a live Stripe account; treat the
// first real test-mode run as the verification step.

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  // service_role bypasses RLS — this is the only writer of the entitlements table.
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Map a Stripe subscription's billing interval to our plan label.
function planFromInterval(interval?: string | null): "monthly" | "annual" | null {
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}

// A Stripe subscription status → our (status, paid_tier). Keep premium through
// past_due (grace); drop to free only when the sub is genuinely inactive.
function fromSubStatus(s: string): { status: string; premium: boolean } {
  switch (s) {
    case "trialing":
      return { status: "trialing", premium: true };
    case "active":
      return { status: "active", premium: true };
    case "past_due":
      return { status: "past_due", premium: true }; // grace period
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return { status: "canceled", premium: false };
    default:
      return { status: "expired", premium: false };
  }
}

async function upsertEntitlement(row: Record<string, unknown>) {
  const { error } = await admin
    .from("protocolize_entitlements")
    .upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Later subscription events reference the customer/subscription, not our user.
// Resolve back to the user_id we stored on checkout.
async function userIdForSubscription(
  subscriptionId: string,
  customerId: string
): Promise<string | null> {
  const { data } = await admin
    .from("protocolize_entitlements")
    .select("user_id")
    .or(
      `stripe_subscription_id.eq.${subscriptionId},stripe_customer_id.eq.${customerId}`
    )
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Invalid signature: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id;
        if (!userId) {
          // No mapping — cannot fulfill. Log loudly; do NOT 500 (Stripe retries).
          console.error("[stripe-webhook] checkout without client_reference_id", s.id);
          break;
        }
        if (s.mode === "payment") {
          // One-time lifetime purchase.
          await upsertEntitlement({
            user_id: userId,
            paid_tier: "premium",
            status: "active",
            plan: "lifetime",
            current_period_end: null,
            stripe_customer_id: (s.customer as string) ?? null,
            source: "stripe",
          });
        } else if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          const { status, premium } = fromSubStatus(sub.status);
          await upsertEntitlement({
            user_id: userId,
            paid_tier: premium ? "premium" : "free",
            status,
            plan: planFromInterval(sub.items.data[0]?.price.recurring?.interval),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_customer_id: (s.customer as string) ?? null,
            stripe_subscription_id: sub.id,
            source: "stripe",
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForSubscription(sub.id, sub.customer as string);
        if (!userId) {
          console.error("[stripe-webhook] sub event with no known user", sub.id);
          break;
        }
        const { status, premium } = fromSubStatus(sub.status);
        await upsertEntitlement({
          user_id: userId,
          paid_tier: premium ? "premium" : "free",
          status,
          plan: planFromInterval(sub.items.data[0]?.price.recurring?.interval),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          source: "stripe",
        });
        break;
      }

      default:
        // Unhandled event types are fine — just ack so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
