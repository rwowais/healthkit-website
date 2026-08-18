# Protocolize — briefing for legal counsel

**Purpose:** hand this to an attorney so a 1-hour review covers everything.
Lawyers bill for time; most of that time is normally spent extracting the
facts below. Walking in with them turns a multi-hour engagement into a
focused review.

Prepared 2026-08-18. Documents to review: `/terms` and `/privacy` on the live
site (currently LEGAL_VERSION 7).

---

## 1. The business

| | |
|---|---|
| Entity | **RO Group LLC** (formation state: _owner to confirm_) |
| Trading name | Protocolize (DBA status: _owner to confirm_) |
| Product | Consumer web app (installable PWA), habit/protocol tracking for longevity |
| Stage | Pre-launch. 5 accounts: owner + 3 friend testers + 1 demo. **Zero revenue to date.** |
| Model | Freemium. 7-day reverse trial → free tier, or Premium $8.99/mo · $79.99/yr · $179 lifetime |
| Payments | Stripe (not yet live). Stripe-hosted checkout; card data never touches our systems |
| Market | US-first; app is reachable worldwide, so EU/UK users are possible from day one |

## 2. What the product actually does — the risk surface

This is not a passive tracker. It generates **personalized** output:

- Merges "protocol packs" into a per-user daily timeline and **re-orders it**
  based on the user's logged sleep, energy and adherence.
- Suggests **when** to do behaviors, and warns when the user's own placement
  conflicts with a dependency or a recommended window (advisory only — the
  user can always override; nothing is blocked).
- Ships a supplement catalog with **specific dose ranges** ("2–4g combined
  EPA/DHA daily with food", "200–400mg magnesium before bed") and
  structure/function-style claims ("reduces systemic inflammation", "acts as
  a mild sedative"). We **do not sell supplements** and take no affiliate
  revenue today.
- Produces an "intelligence layer": keystone-habit identification, weekly
  review, correlations between logged variables.
- Has safety gating: users can flag pregnancy / medications / conditions and
  contraindicated supplements are filtered out.

**No generative AI / LLM is exposed to users.** (Claude is used internally by
the admin CMS to draft protocol content, which a human reviews before
publishing. No user data is sent to it.)

**Questions for counsel:**
1. Is our characterization defensible — "educational, algorithmically
   generated starting points" rather than advice — given the degree of
   personalization? Anything in the wording that undercuts it?
2. Does the supplement catalog (doses + structure/function claims, no sale)
   create FDA/FTC exposure beyond the DSHEA disclaimer we render?
3. Is there wellness-vs-medical-device line risk (FDA general wellness
   guidance) in re-ordering someone's day based on health inputs?

## 3. Data practices (the facts a privacy review needs)

**Collected:** email + hashed password (Supabase Auth); user-entered habit
logs, sleep/energy check-ins, notes; optional biomarkers; optional safety
flags (pregnancy, medications); plan/subscription status. **Not** collected:
name (unless typed), address, phone, location, contacts, device data,
browsing history, card numbers.

**Stored:** browser localStorage (`protocolize-v3`) + one Postgres row per
user (Supabase, US region), protected by row-level security so an account can
only read its own row. Entitlements are in a separate table only a server key
can write.

**Subprocessors:** Supabase (auth + DB), Vercel (hosting/logs), Stripe
(payments, when live), Anthropic (admin-side content drafting only).
**No advertising or analytics vendors today.**

**Rights implemented in-product:** self-serve export (full JSON) and
self-serve account deletion (removes the DB row; backups age out ≤30 days).

**Consent:** clickwrap at signup and at the end of onboarding; a version stamp
(`legalAcceptedVersion` + timestamp) is written into the user's own synced
record. A bump to `LEGAL_VERSION` shows every user a one-time in-app banner
that must be accepted. Acceptance is visible to the user in Profile.

**Questions for counsel:**
4. Washington My Health My Data — we treat this as applying to WA users
   (consumer health data). Is our consent framing sufficient, and do we need
   the separate MHMD-style consent page/authorization some apps publish?
5. Our privacy policy **reserves** de-identified/aggregated use (product
   improvement, research, aggregate stats). Is the de-identification standard
   we describe adequate, given the data is health-related and the user base
   will be small at first (re-identification risk)?
6. EU/UK: we rely on processors' standard contractual clauses rather than our
   own transfer mechanism. Adequate at our size? Do we need a DPA, a named EU
   representative, or a cookie banner (we set no advertising cookies)?

## 4. Key clauses as currently drafted — and why

| Clause | Position | Note |
|---|---|---|
| Medical disclaimer | Prominent, repeated (terms, Profile, supplements page) | Strongest section |
| Intelligence-layer disclaimer | Algorithmic, educational, **no professional relationship**, assumption of risk | Added 2026-08-18 |
| DSHEA / FDA line | On `/supplements` where doses render, plus terms | |
| Age | **18+** | Matches Oura/Whoop/Rise; BWS uses 16 |
| Liability cap | Amounts paid in the last 12 months | BWS uses "greater of 12 months or $100" |
| Indemnification | Scoped to breach / unlawful use; explicitly **not** ordinary good-faith use | Deliberately narrower than market |
| Arbitration | AAA consumer rules, **user's home state**, individual basis, small-claims carve-out, **30-day opt-out** | |
| Governing law | User's state of residence | *See Q7* |
| Data-use promises | **Present tense** + material changes apply only after re-acceptance | Owner wants ads/other revenue open later |
| Health data + advertising | Requires separate explicit opt-in (not foreclosed, but gated) | |
| Business transfer | Data may transfer on sale/merger, bound by same promises | |
| Refunds | Case-by-case within 14 days | BWS: none at all |

**Questions for counsel:**
7. Governing law is currently the **user's** state — unusual; most companies
   pick their own (BWS picks BC). Should this be RO Group LLC's home state,
   and does that change the arbitration seat?
8. Is the liability cap enforceable as written for a paid consumer health
   app, and should there be a dollar floor?
9. Is the 30-day arbitration opt-out + class waiver drafted well enough to
   survive a challenge?
10. Anything **missing** entirely that a consumer health subscription app
    should have?

## 5. Explicitly out of scope today

No wearable/HealthKit integrations, no user-facing AI, no social/sharing
features, no marketing email list, no ads, no affiliate revenue, no supplement
sales, no minors, no HIPAA-covered relationship (we are not a covered entity
or business associate — no provider relationship exists).

Several of these are plausible **future** additions; the policy is written to
allow them via re-acceptance rather than to promise they'll never happen.

---

### The one-line ask

*"These were drafted in-house, benchmarked against Oura, Rise Science and
Built With Science. We're not asking for a rewrite — we want to know what's
unenforceable, what's missing, and what exposes us given the personalization
described in §2."*
