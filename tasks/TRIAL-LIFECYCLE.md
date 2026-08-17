# Trial lifecycle — pre-launch review (2026-08-16)

_Full code trace of what a user experiences from trial start → expiry → free
life. File:line evidence in the audit transcript; key cites inline. STATUS:
findings reported to founder; fix plan below awaiting go._

## The journey as shipped

- **Start:** trial (14 days) is stamped ONLY at first onboarding completion
  (onboarding/page.tsx:305-317). CTA says "Start my 14 days" with ZERO
  explanation of what the trial is, what expires, or that nothing is charged.
- **During:** trial = full premium everywhere (live insights, correlation
  explorer, unlimited pack installs, custom builder). Gating is consistent —
  no surface wrongly treats a trial user as free.
- **Approaching expiry:** NO warning ladder. One neutral countdown ("Premium
  trial — N days left") that renders identically at day 14 and day 1 — and
  (post-declutter) lives inside the collapsed-away summary, so an ENGAGED
  user stops seeing it after their first tap each day. Low-engagement users
  (<6 engaged days) get a one-shot +7d auto-extend with a nice card.
- **Expiry day:** premium silently vanishes. NO "your trial ended" moment —
  no card, toast, push, or email. Insights quietly go 3-day-delayed with a
  banner that says "On the free plan…" as if they'd never had premium.
- **Free life:** genuinely decent (the 3-day-delay peek model is strong; no
  data is ever deleted; over-cap packs and custom packs KEEP WORKING). Six
  upgrade CTAs all dead-end at "paid plans are coming soon" with no
  email-capture, so all upgrade intent is discarded pre-Stripe.

## (a) BUGS / BROKEN PROMISES — fix before go-live

1. **"Unlimited history & trends" is sold but doesn't exist** (upgrade:34-38,
   terms:110). Free users already have unlimited history. → CUT the claim
   (simplest + honest). Also fix Terms' false "7 days of insights" (terms:105)
   → describe the real 3-day delay.
2. **"You have 3 of 3 free protocols installed" is FALSE for over-cap users**
   (protocols:1005-1008 renders the constant twice). Show the real count +
   correct guidance ("your N packs keep working; Premium is needed to add").
3. **Post-Stripe: paying customers would see "We extended your trial a week"**
   — maybeExtendTrial guards on settings.tier (entitlements:172), which stays
   "free" for cloud-paid users; the extension card has no access check
   (today:1672). → guard on getAccess().paid + gate card on !paid.
4. **Extension card re-fires after "Reset all data"** (pz:trial-ext-ack wiped,
   trialExtendedAt preserved). → key ack off the trialExtendedAt value, or
   exclude from the pz:* sweep.
5. **Import = permanent premium**: importState doesn't clamp
   premiumTrialEndsAt; a hand-edited backup with a 2099 date wins the merge
   forever (storage:1582, datasource:553-556). → clamp in normalize() to
   trialStartDate + 21d.
6. **Clock rollback resurrects premium** (no high-water mark). → persist
   max-seen-time; refuse to trust a clock behind it.
7. **mergeStates doesn't special-case trialExtendedAt** — one-shot guard held
   only by JSON dropping absent keys. → special-case it (keep the earliest).
8. **Invariant contradiction:** inv_free_tier_caps_held says >3 packs on a
   free user = violation, but shipped behavior (deliberately) lets over-cap
   packs keep working after expiry. DECISION: grandfathering is right (calm,
   generous, no rug-pull) → rewrite the invariant as "free users cannot ADD
   past 3", + add the missing over-cap-then-expire test.
9. Dead code to remove: TRIAL_DURATION_DAYS=7 (constants:48, contradicts the
   real 14), subscriptionStatus field (write-only, stuck at "trial" forever),
   PremiumPeek (never rendered), startCheckout's unreachable+wrong reason.

## (b) CONVERSION/TRUST UX — the go-live gaps

1. **A "your trial ended" moment** — one-time calm card on Today the first
   open after expiry: what changed (insights delayed, adding packs), what
   stays forever (their system, history, streaks). Conversion happens on the
   day of loss; today there is literally nothing there.
2. **A warning ladder** — at ≤3 days the countdown escalates and becomes
   un-hideable (rides the collapsed summary strip too); final-day copy.
3. **One sentence of trial framing at onboarding** — under "Start my 14
   days": full Premium, no card, core system free forever.
4. **Differentiate expired vs never-trialed Profile copy** (currently
   identical).
5. **Unify the Insights framing** — "Insights is a Premium feature" (insights:
   674) contradicts the honest "delayed view" banner on the same page.
6. Optional (needs new table): "email me when Premium opens" capture on
   /upgrade while Stripe is inert — turns 6 dead-end CTAs into a launch list.
7. Verify existing custom packs stay EDITABLE post-expiry (only create/fork
   entry points are gated — likely fine; needs one click-through/e2e).

## (c) Working as intended — keep
Peek-don't-wall insights · no data deletion ever · over-cap grandfathering ·
price table hidden while Stripe inert · no fake "restore purchase" · server
paid flag un-forgeable + canceled sub doesn't resurrect old trial (pinned).

## Test gaps to close alongside
Over-cap-then-expire persona · maybeExtendTrial under server entitlement ·
mergeStates trial fields · import clamp · clock rollback.

---

## How Rami can experience the real trial (without touching his own account)

`rwowais@gmail.com` will **never** show you the trial or the free tier. It
holds a manual lifetime Premium entitlement (`protocolize_entitlements`:
`paid_tier: premium`, `plan: lifetime`, `source: manual`, stamped 2026-07-23)
that was created while building server-authoritative entitlements. `getAccess()`
prefers that row over everything else, so the app is permanently unlocked for
it. **Keep the grant** — it is the owner account. Use a throwaway instead.

1. **Sign up** at the live app with a plus-address — Gmail delivers
   `rwowais+test1@gmail.com` to the normal inbox, and it is a distinct user to
   Supabase. (Do NOT reuse `rwowais+demo@gmail.com` if you still want that one.)
2. **Confirm** it from the Supabase dashboard (Authentication → Users → the
   row → confirm) if the email doesn't arrive.
3. **Run onboarding** normally. The final CTA reads "Start my 7 days" and
   stamps `settings.premiumTrialEndsAt` 7 days out.
4. **Jump to any trial state** by editing that user's row in
   `protocolize_state` (Table Editor → find `user_id` → edit the `state` JSON →
   `settings.premiumTrialEndsAt`), then reload the app:
   - **2 days out** → the conversion ladder banner appears (≤3 days; this one
     is intentionally not dismissible).
   - **in the past** → the trial-ended card appears, and Today drops to the
     free surface.
   Set the value as an ISO string, e.g. `"2026-08-14T00:00:00.000Z"`.
5. **Caveat — locking will NOT happen yet.** `capsEnforced()` returns false
   until the `NEXT_PUBLIC_STRIPE_CHECKOUT_*` env vars exist, so over-cap packs
   and supplements stay unlocked by design (nobody can pay yet, so nobody gets
   locked out). To feel the paused-pack/paused-supplement experience before
   Stripe, set one of those env vars locally in `.env.local` and run the dev
   server — do not set it in production until fulfillment ships.

### Two accounts that must never be treated as disposable
`gbushee+healthkit@gmail.com`, `idahabibi@gmail.com`, `ava.habibi@gmail.com`
are real tester friends — leave their rows alone in any cleanup or seeding.
