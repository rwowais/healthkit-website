# Server-side entitlements (SEC-1) — status & Stripe fulfillment

_Audit finding: `paid` was read from `settings.tier`, a user-writable field —
anyone could unlock Premium by editing localStorage. This makes it
un-forgeable and lays the fulfillment path for Stripe._

## Phase 1 — SHIPPED 2026-07-16 (server-authoritative paid flag)
- **`public.protocolize_entitlements`** table (applied to prod + in
  `supabase/schema.sql`). Columns: `user_id` PK (FK→auth.users ON DELETE
  CASCADE), `paid_tier`, `status`, `plan`, `current_period_end`,
  `stripe_customer_id`, `stripe_subscription_id`, `source`, `updated_at`.
  **RLS: users can READ their own row; NO write policy** → only the
  service_role (webhook / manual grant) can write it.
- **`getAccess()`** now derives `paid` from this entitlement in cloud mode
  (`entitlements.ts` — `setEntitlement`/`getEntitlement`, kept OUT of the synced
  AppState blob so it can't round-trip as user data). A forged `settings.tier`
  is ignored: a signed-in user with no row = free. Local-only mode (no cloud,
  no monetization) still trusts `settings.tier`, so all existing tests pass.
- **Datasource** `syncEntitlement()` runs on every cloud `load()` (real row, or
  synthesized `free` for a signed-in user / guest with no row); a read failure
  keeps the last-cached value (offline-safe). Cleared on any auth switch/sign-out.
- **Trial is unchanged** — it's time-boxed and self-limiting, so it stays
  client-side. (Forging the trial only extends a *free* trial the app already
  grants generously; the revenue-relevant hole was PAID premium, now closed.)
- The owner account is grandfathered (`source='manual'`, lifetime) so testing
  is uninterrupted. Manual comps = insert a premium row for that user_id.
- **Zero user impact today:** the table is empty (no Stripe), so everyone stays
  on trial exactly as before.
- Gates: tsc clean · full suite **632 passed** · build compiled · 5 new tests.

### Residual (documented, accepted)
Premium *content* still ships to every client (the app is local-first), so a
determined user can read it from the bundle regardless. Per the audit, a
local-first app can't fully hide client-delivered content — this is UX gating
over inherently-public data. `getAccess` refreshing from the server on every
load is the realistic bar; fully server-gating premium DATA is out of scope.

## Phase 2 — Stripe fulfillment webhook (BUILT, not deployed — owner-gated)
Code: `supabase/functions/stripe-webhook/index.ts` (complete, untested against a
live Stripe account). It's the ONLY automated writer of premium. Needs YOUR
Stripe account + secret, so it's a deliberate hand-off, not something I deploy.

**Do this when you're ready to charge (≈15 min, all in the file's header):**
1. Create Stripe products/prices + Payment Links (monthly/annual/lifetime).
2. `supabase functions deploy stripe-webhook --no-verify-jwt`.
3. `supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=…`.
4. Add the webhook endpoint in Stripe → subscribe to
   `checkout.session.completed`, `customer.subscription.updated/.deleted`.
5. **One small client change still needed:** the checkout redirect must append
   `?client_reference_id=<supabase user id>` so the webhook knows whose
   entitlement to stamp (billing.ts `startCheckout` + the upgrade page — a tiny
   edit I'll make as part of the "wire Stripe" task, kept out of this batch
   because it's inert without the links).
6. Test end-to-end in Stripe **test mode** before flipping live keys — that
   first test run is the webhook's verification.

**Do NOT set the `NEXT_PUBLIC_STRIPE_CHECKOUT_*` env vars until the webhook is
live** — otherwise checkout charges with no fulfillment (the pre-existing HIGH
in CLAUDE.md). With this webhook deployed, that gap is closed.
