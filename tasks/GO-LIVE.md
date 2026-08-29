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
- [ ] **Trademark clearance search for "Diurna Health" — DO THIS FIRST** —
      OWNER (via the attorney hour). A domain purchase gives nobody trademark
      rights, so a later buyer of `diurna.com` cannot claim our app name. The
      real risk runs the other way: someone who was ALREADY using "Diurna"
      in commerce for related goods/services would have priority over us.
      My own check was only a web search (found nothing in health/wellness),
      which is NOT clearance — an attorney runs a proper USPTO + common-law
      search. Cheap now, expensive after the brand is established.
      Note: `diurna.com`, `diurna.app` and `diurna.io` are all registered but
      appear to be parked/blank, i.e. reservers rather than operating brands.
- [ ] **File the USPTO trademark for "Diurna Health"** — OWNER, after
      clearance. This is the actual protection against the scenario the owner
      asked about; registration + documented first use in commerce is what
      lets us stop a copycat, and what stops a domain buyer from having any
      claim. Likely classes: 9 (software), 42 (SaaS), possibly 44 (health
      information services). Government fee is per class.
      Also: **document first use** — launch date, dated screenshots, the first
      paid receipt. US priority is date-based.
- [ ] **Buy the cheap defensive domains** — OWNER, ~$45 total:
      `diurnahealth.app` ($9.99), `getdiurna.com`, `trydiurna.com`,
      `diurnaapp.com` ($11.25 each). Point them all at the main site. Note
      `diurna.co` is priced at $308/yr (premium) and is not worth it.
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

- [ ] **Buy `diurnahealth.com` — $11.25/yr — DECIDED 2026-08-18** — OWNER.
      Name search is closed: ~215 domains checked, Diurna tested cleaner than
      every alternative (see the rejected-alternatives entry below). Runbook:
      1. Buy `diurnahealth.com`.
      2. **Set up the three email addresses** — they are PROMISED IN THE
         LEGAL DOCUMENTS and must not bounce: `privacy@` (GDPR/CCPA rights
         requests — a bouncing address here is a real compliance failure),
         `legal@` (disputes + the 30-day arbitration opt-out), and `hello@`
         (general + refund requests). Consolidated from four to three on
         2026-08-18 to fit iCloud+'s limit of 3 addresses per domain.
         **iCloud+ Custom Email Domain is a good fit** — unlike plain
         forwarding it lets you REPLY as `privacy@diurnahealth.com`, which
         matters when answering a data-rights request. Buying inside iCloud
         Settings routes through Cloudflare Registrar (at-cost, full DNS
         control), so step 3 still works. Verify you can add Vercel's
         A/CNAME records before relying on it.
         ⚠️ Buying via a personal Apple ID registers the domain to Rami
         personally rather than RO Group LLC — fine for now and transferable
         later, but it is the same entity-separation point as the Stripe
         account.
      3. Add it as a Vercel domain and follow the DNS steps.
      4. Set `NEXT_PUBLIC_SITE_URL=https://diurnahealth.com` in Vercel.
         (Code already falls back to this exact value, so the app is correct
         the moment DNS resolves — the env var just makes it explicit.)
      Until DNS is live, social/link previews point at a domain that doesn't
      resolve. Harmless pre-launch, but it's why this should happen before
      any public sharing.
- [ ] **Later: defensive Diurna domains** — OWNER, owner's call to defer
      (2026-08-18). ~$45 total: `diurnahealth.app` ($9.99), `getdiurna.com`,
      `trydiurna.com`, `diurnaapp.com` ($11.25 each). Point them at the main
      site. Skip `diurna.co` — premium-priced at $308/yr. Note `diurna.com`,
      `diurna.app` and `diurna.io` are held by parkers; an offer on
      `diurna.com` is a nice-to-have, never a blocker, since a domain confers
      no trademark rights.
- [ ] **(Decision recorded, no action) Two-word .com alternatives to Diurna —
      searched and rejected.** Owner asked 2026-08-18 for a different two-word
      name with an available .com. ~215 domains checked. Available options did
      exist at $11.25 (`emberlongevity`, `tidelongevity`, `lanternlongevity`,
      `harborlongevity`, `ridgelongevity`, `perenniallongevity`,
      `perennialdaily`, `protocolarc`, `protocolridge`,
      `theeverydayprotocol`, `quotidianapp`) — but conflict-checking the
      leaders killed them:
      - **Ember** — "Ember Health" is an operating NYC health company (~38
        staff) and EMBER is a registered healthcare trademark (Reg. 6846847,
        Ember LifeSciences).
      - **Tide** — "Tide AI" is a health app that syncs Oura/Whoop/Garmin/CGM
        and gives context-aware guidance: essentially our product. Also
        Tidepool and Tidelands Health in the same space.
      - Every common English word is already taken in health:
        `perennialhealth.com`, `quotidianhealth.com`, `vesperhealth.com`,
        `nocturnehealth.com`, `lanternhealth.com`, `tidehealth.com` are ALL
        registered.
      **Conclusion: Diurna tests cleaner than every alternative** — no
      trademark and no operating business found in health/wellness, because an
      uncommon Latin word is exactly what survives a saturated naming space.
      The owner's original worry (someone buying `diurna.com`) confers no
      trademark rights on that buyer, so it is not a reason to move. Keep the
      name; buy `diurnahealth.com`; let the attorney's clearance search be the
      real check.
- [ ] **Rename the GitHub repo** `healthkit-website` → `diurna-health` —
      OWNER (Settings → rename). Vercel follows automatically; your local
      remote needs `git remote set-url` afterwards, which Claude can do.
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
