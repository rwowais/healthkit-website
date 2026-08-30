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
| Refunds | Non-refundable by default; discretionary exceptions | Matched to BWS (v8) |
| Health release | User represents fitness to participate + releases injury claims | Added v8 — the highest-value clause for this product type |
| Limitations period | Claims barred after **1 year** | Added v8 |
| Jury waiver | Explicit, alongside class waiver | Added v8 |

**Questions for counsel:**
7. Governing law now points at **RO Group LLC's own state** (v8). Until the
   owner confirms the formation state the docs say "the state in which RO
   Group LLC is organized" — is that entity-relative phrasing acceptable, or
   must the state be named to be enforceable?
8. Is the liability cap enforceable as written for a paid consumer health
   app, and should there be a dollar floor?
9. Is the 30-day arbitration opt-out + class waiver drafted well enough to
   survive a challenge?
10. Anything **missing** entirely that a consumer health subscription app
    should have?
11. **v8 was drafted for maximum defensibility at the owner's direction**
    (health release, broad indemnity, 1-year limitations period, jury waiver,
    no-refunds default). Is any of it likely to be found unconscionable — and
    is there a risk that an aggressive clause causes a court to strike the
    whole arbitration agreement rather than just that clause?
12. **Insurance:** what coverage should be in place before revenue — general
    liability, professional liability / E&O, product liability given the
    supplement guidance? This is the owner's top priority and no drafting
    substitutes for it.

## 4b. Brand / trademark (added 2026-08-18)

The app was renamed **Protocolize → Diurna Health** on 2026-08-18 (the .com was
available). Owner's question: if someone later buys `diurna.com`, can they
claim our app name?

Our understanding, for confirmation: a domain registration confers no
trademark rights, so a later buyer would have no claim; priority turns on use
in commerce. Facts: `diurna.com`, `diurna.app` and `diurna.io` are all
registered but appear parked/blank (no operating brand found). An in-house web
search found no "Diurna" trademark in health/wellness — explicitly NOT a
clearance search.

**Questions for counsel:**
13. Please run a proper clearance search on **"Diurna Health"** (and bare
    "Diurna") before the brand is established. *diurna* is a Latin dictionary
    word meaning "daily", which makes the mark suggestive for a daily-habit
    health app — registrable, but weaker than a coined term. Does that change
    your advice on the name, or on how to file?
14. Which classes should we file — 9 (software), 42 (SaaS), 44 (health
    information services)? File now (intent-to-use) or after launch?
15. Anything we should be doing NOW to establish and document first use in
    commerce so priority is defensible?

## 4c. Entity structure (added 2026-08-18)

RO Group LLC is the owner's **pre-existing consulting entity**, now also
operating Diurna Health. One LLC, two lines of business, no subsidiaries.

**Questions for counsel:**
16. Is running a consumer health app inside the same LLC as a consulting
    practice acceptable, or should the app be carved into its own entity?
    Note the asymmetry: an LLC shields the owner personally, but does NOT
    wall off one business from the other — a health claim could reach
    consulting assets and receivables, and the app is the materially
    higher-risk activity of the two.
17. If a separate entity is advisable, is it better done **now** (cheap,
    pre-revenue, nothing to migrate) or at a revenue/fundraise trigger?
18. Do any existing consulting client contracts contain exclusivity,
    conflict-of-interest or indemnity terms that this affects?
19. What should be documented internally to keep the two lines of business
    distinct for liability and tax purposes within one entity?

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
