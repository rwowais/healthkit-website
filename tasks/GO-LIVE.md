# Protocolize — go-live checklist

**The single running list of everything that must happen before real users pay
real money.** Nothing goes live until the blockers are done.

Keep this file current: when an item ships, mark it `[x]` with the date, and
add new items here rather than burying them in a commit message.

Legend — **OWNER** = only Rami can do it (accounts, money, identity).
**CLAUDE** = code/config, no owner action needed.

Last reviewed: 2026-08-18 · LEGAL_VERSION 8 · HEAD after `ba79cf6`

---

## 🔴 BLOCKERS — do not take money until every one is done

- [ ] **Insurance in force** — OWNER. The biggest remaining gap, and no
      contract clause substitutes for it. Terms limit what you *owe*;
      insurance pays to *defend* you, which happens even when you win.
      Ask a broker for a package quoting all three:
      - general liability
      - professional liability / errors & omissions (the app gives guidance)
      - product liability (you recommend supplements with specific doses)
      Mention: consumer health/fitness app, pre-revenue, no supplement sales,
      no wearable integrations, US-only launch.
- [ ] **Stripe fulfillment deployed and tested** — OWNER + CLAUDE, in this
      order. Doing these out of order charges customers and delivers nothing:
      1. deploy `supabase/functions/stripe-webhook`
      2. set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
      3. create the 3 products/prices + Payment Links; set each link's
         "After payment" redirect to `/upgrade?checkout=success`
      4. set `NEXT_PUBLIC_STRIPE_PORTAL_URL` (customer portal login link)
      5. run a full **test-mode** purchase end-to-end and watch Premium unlock
      The webhook has never executed against a real Stripe account — treat
      that first test run as the verification step.
- [ ] **Stripe account owned by RO Group LLC** — OWNER. Its EIN, its bank
      account. A company named in the terms but paid into a personal account
      is the classic way an LLC's protection gets pierced.
- [ ] **Tell the 3 friend testers before payment links go live** — OWNER.
      Adding any `NEXT_PUBLIC_STRIPE_CHECKOUT_*` var flips `capsEnforced()`
      ON for everyone at once; their over-cap packs/supplements pause that
      day (nothing deleted, restored instantly on upgrade). They should hear
      it from you, not discover it.
      Accounts: `gbushee+healthkit@gmail.com`, `idahabibi@gmail.com`,
      `ava.habibi@gmail.com` — **never delete these in any cleanup.**

## 🟠 STRONGLY RECOMMENDED before launch

- [ ] **One hour with an attorney** — OWNER. Hand over
      [`LEGAL-BRIEF.md`](LEGAL-BRIEF.md); it front-loads every fact they'd
      otherwise bill to extract and ends with 12 specific questions. Priority
      ones: is the v8 aggressive pass at risk of being struck as
      unconscionable (Q11), and what insurance to carry (Q12).
- [ ] **Confirm RO Group LLC's formation state** — OWNER → then CLAUDE sets
      `ENTITY_STATE` in `src/lib/constants.ts` and both documents sharpen
      from "the state in which RO Group LLC is organized" to the named state.
- [ ] **Register "Protocolize" as a DBA / trade name** of RO Group LLC if it
      isn't already — OWNER. Usually a cheap state filing.
- [ ] **Enable leaked-password protection** — OWNER. Supabase dashboard →
      Authentication → Password settings. Flagged in the 2026-07-16 audit,
      still off.
- [ ] **Security headers** — CLAUDE. `X-Frame-Options` / CSP
      `frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
      Open since the TEST-PLAN Run 1 finding.
- [ ] **Delete the demo account** (`rwowais+demo@gmail.com`) — OWNER.
      The only disposable account; the three testers are not.
- [ ] **Install and use the PWA on a real iPhone for a few days** — OWNER.
      Push notifications, install prompt and the standalone display mode have
      never been exercised on a physical device.

## 🟡 LAUNCH POLISH — can ship after, but soon

- [ ] **Buy the domain** — OWNER. `protocolize.com` is **not available**, but
      the research below says keep the name and take `.app`:
      - `protocolize.com` redirects to a **GoDaddy for-sale parking page** —
        a squatter, not a business. That's the good outcome: nobody is using
        "Protocolize" as a brand, so there's no trademark conflict. (A USPTO/
        web search for the name in health & fitness found nothing.) You can
        make an offer through GoDaddy later if you ever want the .com; a name
        like this typically lists in the high hundreds to low thousands.
      - **`protocolize.app` — $9.99/yr, available.** Recommended. `.app` is
        run by Google, HTTPS-only at the TLD level (a real security plus for
        a health app), and reads as intentional rather than second-choice.
      - Backups if you'd rather have a `.com`: `getprotocolize.com` or
        `tryprotocolize.com` ($11.25), `protocolize.co` ($4.99).
      - **80 domains checked 2026-08-18. ZERO clean exact-match `.com`s were
        available at registration price** — not dictionary words (healthspan,
        cadence, keystone, baseline, meridian, solstice, helios, keel), not
        Latin roots (aevum, vitae, diurna, circada, tempus), not two-word
        compounds (dailycompound, vitalstack, compoundhealth, protocolstack),
        not English phrases (longgame, steadystate, throughline, slowburn),
        and not even invented 5–6 letter coinages (aevia, longeva, protova,
        vitava, aeona, solvi, kaven). Domain investors hold essentially every
        pronounceable short string. The only `.com`s free are
        `get-`/`try-`/`-health`/`-labs` constructions, which are a weaker
        brand than the name we already have.
      - **The decisive consequence:** a clean `.com` for ANY good name costs
        squatter money, not $12. So renaming to get a `.com` means paying the
        rebrand cost *and* the squatter — strictly worse than simply buying
        `protocolize.com`, where the brand is already in the code, the legal
        documents and the dossier. **If we ever pay for a `.com`, pay for
        ours.**
      - **CORRECTION after a wider sweep (140 domains).** The "no .com
        available" conclusion was an artifact of only searching SHORT SINGLE
        WORDS. The comparables don't use those — `builtwithscience.com`,
        `risescience.com`, `eightsleep.com`, `functionhealth.com` are all two
        or three words. Searching that band, real `.com`s ARE available:

        | Name | Domain | $/yr | Read |
        |---|---|---|---|
        | **Ember Longevity** | `emberlongevity.com` | 11.25 | Brandable word + category, exactly the Rise Science pattern. "Ember" = slow sustained burn — an apt longevity metaphor. |
        | **The Everyday Protocol** | `theeverydayprotocol.com` | 11.25 | Keeps the "protocol" equity already built; clear and memorable, but long to type. |
        | **Diurna Health** | `diurnahealth.com` | 11.25 | Latin *diurna* = daily; distinctive, clean, matches the Function Health pattern. |
        | Circada | `circada.app` / `circadalabs.com` | 9.99 | Circadian association; exact `.com` taken. |
        | *(descriptive, weaker)* | `yourlongevityos.com`, `mylongevitysystem.com`, `yourdailysystem.com`, `oneprotocolday.com`, `builtwithprotocols.com` | 11.25 | Read as taglines rather than brands. |

        Still true: every SHORT single-word `.com` is held by investors
        (~120 checked across dictionary words, Latin roots, two-word
        compounds, English phrases and invented coinages).
      Then add it as a Vercel domain, follow the DNS steps, and set
      `NEXT_PUBLIC_SITE_URL=https://<domain>` so link previews resolve.
- [ ] **Turn on analytics** — OWNER. Plausible (cookie-less, already wired):
      add the site, then set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in Vercel.
      Without it you launch blind — no idea how many people finish
      onboarding or reach the paywall.
- [ ] **Email notification on new feedback** — CLAUDE (offered, not built).
      Feature requests currently land in `protocolize_feedback`, visible only
      via the Supabase dashboard.
- [ ] **Accept the current legal version once** — OWNER. One banner tap; the
      three version bumps on 2026-08-18 collapse into a single prompt.

## ✅ DONE — kept for the record

- [x] 2026-08-17 · **LLC exists**: RO Group LLC, named in `/terms` as the
      contracting party and in `/privacy` as data controller.
- [x] 2026-08-18 · **Legal foundation** — recorded, versioned consent
      (clickwrap at signup + onboarding, one-time re-accept banner, stamp
      visible in Profile). Benchmarked against Oura, Rise Science and Built
      With Science. v8 adds the health release, broad indemnity, 1-year
      limitations period, jury waiver, no-refunds default, company-state
      governing law.
- [x] 2026-08-18 · **Intelligence-layer disclaimer** + DSHEA/FDA line
      rendered on `/supplements` where the doses appear.
- [x] 2026-08-17 · **Stripe client half** — buyer identity attached to
      checkout (and checkout refuses to open if it can't attach one), the
      post-payment confirmation screen, and the cancel/manage billing portal.
- [x] 2026-08-16 · **Monetization model settled** — 7-day trial, free = 2
      packs + 3 supplements, lock-don't-delete at expiry.
- [x] 2026-08-16 · **Today decluttered** — every encouragement card has a
      per-day "Got it" plus a global off switch.
- [x] 2026-08-18 · **"Request a feature"** in Profile, with RLS proven
      against forged senders.

---

## Notes worth not re-deriving

- **Owner account is permanently Premium.** `rwowais@gmail.com` holds a
  manual lifetime entitlement, so it will never show the trial or free tier.
  To see what a real user sees, use `rwowais+test1@gmail.com` — full
  walkthrough in [`TRIAL-LIFECYCLE.md`](TRIAL-LIFECYCLE.md).
- **Cap enforcement is env-gated on purpose.** Nobody can be locked out of
  something they cannot yet pay to unlock.
- **"100% protected" isn't a thing.** The stack that gets closest is: LLC
  (done) → insurance (open) → operating through the entity (open) → strong
  terms (done) → not overclaiming in marketing copy (ongoing).
