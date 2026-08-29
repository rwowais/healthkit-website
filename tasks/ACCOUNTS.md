# Accounts & infrastructure plan — what to buy, where, in whose name

Written 2026-08-18 for **RO Group LLC / Diurna Health**. The question behind
this: *what do I actually need, and what will I wish I'd done differently in
two years?*

Guiding rule: **anything the business depends on should be owned by the
business and easy to hand to someone else.** Every "I'll just use my personal
account" decision is a small debt you repay at the worst moment — hiring,
selling, or being unavailable.

---

## The recommendation in one table

| Need | Use | Cost | In whose name |
|---|---|---|---|
| Domain | **Vercel** (or Cloudflare Registrar) | ~$11/yr | RO Group LLC |
| Business email | **Google Workspace Business Starter** | ~$7–8/user/mo | RO Group LLC |
| Hosting | Vercel (already) | Free → $20/mo | RO Group LLC |
| Database / auth | Supabase (already) | Free → $25/mo | RO Group LLC |
| Payments | Stripe | 2.9% + 30¢ | **RO Group LLC + its EIN** |
| Analytics | Plausible | ~$9/mo | RO Group LLC |
| App email (magic links, receipts) | Supabase today → a real ESP later | Free → ~$20/mo | RO Group LLC |
| Insurance | Broker package | few hundred–low thousands/yr | RO Group LLC |

**Floor to launch: roughly $100–200/yr plus insurance.** The only genuinely
new recurring cost this plan adds is Workspace.

---

## 1. Domain — buy at Vercel, NOT through Apple

**Recommendation: buy `diurnahealth.com` at Vercel.**

Why not Apple, even though the iCloud flow is convenient:

- It registers the domain to a **personal Apple ID**, not RO Group LLC. That's
  the same entity-separation problem already flagged for Stripe, and a domain
  is the single hardest asset to lose access to.
- It pushes you toward iCloud Mail, which caps at **3 addresses per domain**
  (see §2) — a ceiling you'd hit almost immediately.
- Apple's flow is built around *email*, not around running a website. The site
  is the primary use here.

**Vercel** is the pragmatic pick: the app already lives there, DNS for the site
configures itself, and there's one less login to manage. **Cloudflare
Registrar** is the alternative if you want at-cost renewals forever (many
registrars are cheap year one, expensive after) and the best DNS console
available. The price difference is about a dollar a year — choose simplicity.

**Avoid GoDaddy** for the registration: aggressive upsells and expensive
renewals. (Fine to *buy from* if you ever pursue `diurna.com`, which they park.)

## 2. Email — Google Workspace, not iCloud

**Honest read: iCloud+ works today and boxes you in immediately.**

iCloud+ Custom Email Domain gives you 3 personalized addresses per domain. You
need exactly 3 right now (`privacy@`, `legal@`, `hello@`) — **zero headroom.**
The moment you want `support@`, `rami@`, `press@` or `founders@`, you're
migrating email for a live business, which is the worst time to do it.

**Google Workspace Business Starter (~$7–8/user/month)** instead:

- **Unlimited aliases on one mailbox.** `privacy@`, `legal@`, `hello@`,
  `support@`, `rami@` all land in one inbox, and you can *send as* any of them.
- Owned by RO Group LLC, with an admin console. Add a contractor later without
  restructuring anything.
- Docs/Sheets/Drive included — you'll want them for financials, the legal
  brief, and investor or partner material.
- Transfers cleanly if you ever sell the business.
- Deliverability and spam filtering are best-in-class.

$84/year to remove an entire category of future friction, for a business that's
about to take payments and handle health data. That's the right trade.

*(Free alternative if you want to defer the cost: Cloudflare Email Routing
gives unlimited forwarding addresses for $0 — but forward-only, so you can't
reply as `privacy@` without extra SMTP setup. Acceptable stopgap, not a
destination.)*

## 3. App email is a SEPARATE system — don't confuse the two

Sign-in links, password resets and payment receipts are **transactional email**
and today go through Supabase and Stripe. They are not Workspace's job, and
Workspace's terms don't permit bulk/app sending.

- **Today:** fine as-is. Supabase sends auth mail; Stripe sends receipts.
- **Later trigger — when auth emails start landing in spam, or you want them
  from `@diurnahealth.com` instead of Supabase's domain:** add a real email
  service (Resend, Postmark or SendGrid, ~$0–20/mo) and point Supabase's SMTP
  at it. This also earns you proper SPF/DKIM/DMARC on your domain, which is
  what actually keeps mail out of spam folders.
- **Marketing email, if you ever do it:** a third system again (an ESP with
  proper consent tracking). Never send marketing from Workspace.

## 4. Order of operations

1. Buy `diurnahealth.com` at Vercel, in the LLC's name.
2. Sign up for Google Workspace on that domain; verify it (Vercel DNS).
3. Create `privacy@`, `legal@`, `hello@` as aliases on your single mailbox.
4. Add the domain to the Vercel project; set
   `NEXT_PUBLIC_SITE_URL=https://diurnahealth.com`.
5. Confirm the three addresses receive **and** send.
6. Then continue the [GO-LIVE](GO-LIVE.md) blockers (insurance, Stripe).

## 5. Future triggers — decide once, act when the trigger fires

| When this happens | Do this |
|---|---|
| Auth emails hit spam, or you want them from your domain | Add Resend/Postmark; point Supabase SMTP at it |
| You hire or contract someone | Add a Workspace user (~$7/mo); never share a login |
| Traffic outgrows free tiers | Vercel Pro ($20/mo), Supabase Pro ($25/mo) |
| You want a newsletter | A separate ESP with consent tracking — and a LEGAL_VERSION bump if the privacy policy's email section changes |
| You take real revenue | Business bank account + bookkeeping, both under the LLC |
| You sell or raise | Everything above already sits under the LLC — that's the point |

## 6. What NOT to buy

- **A separate website builder / CMS** — the app is the site.
- **Premium DNS, SSL certificates, or "domain privacy" upsells** — Vercel and
  Cloudflare include these; registrars charge for them.
- **Microsoft 365** — no advantage here over Workspace for this stack.
- **A trademark-filing service** that isn't your attorney — you're already
  paying for an hour of counsel; file through them.
