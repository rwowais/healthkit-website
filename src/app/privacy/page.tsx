"use client";

import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/constants";

/**
 * Privacy policy. Plain-English, calm-system voice. Updated when
 * LEGAL_VERSION in src/lib/constants.ts is bumped — the bump triggers the
 * LegalGate re-acceptance banner for existing users (lib/legal.ts).
 *
 * Style: not legalese. Not enterprise jargon. The point is to actually
 * tell the user what we do with their data in language they understand.
 * If they want the formal legal version, they can ask their lawyer to
 * parse this one.
 *
 * v3 (2026-08-17) — the business-readiness pass:
 *  - PERSONAL data promises stay strong: never sold, never used for ads,
 *    shared only with the processors that run the service.
 *  - DE-IDENTIFIED/AGGREGATED use is now expressly reserved (product
 *    improvement, research, aggregate statistics). This is the deliberate
 *    keep-the-future-open clause: it cannot be added retroactively later
 *    without re-consent, so it is reserved now, honestly, before launch.
 *  - Breach promise softened from a flat "72 hours" (that's the GDPR
 *    regulator window, not a user-notification promise we should hard-code)
 *    to "promptly, and within any legally required window".
 *  - "Changes" section now describes the REAL acceptance banner (LegalGate)
 *    instead of promising a mechanism that didn't exist.
 *  - Benchmarked against Oura's and Rise's policies (2026-08-17): added
 *    retention, international transfers, US state rights (incl. WA My Health
 *    My Data — this IS a consumer-health-data app), explicit health-data
 *    consent framing, and the no-selling-to-AI-trainers line. All additive
 *    user protections, so no LEGAL_VERSION bump needed for them.
 *
 * Footprint check (what we actually do, not what we boilerplate):
 *  - Cloud storage: Supabase row keyed to the user's id. RLS enforces
 *    own-row access. Entitlements table is server-written only.
 *  - Local storage: protocolize-v3 key; local-only builds never sync.
 *  - Telemetry: not yet wired. When wired, Plausible-style aggregate only.
 *  - Email: transactional via Supabase Auth. No marketing list yet — if one
 *    is added it will be opt-in.
 *  - Payments: Stripe-hosted; card numbers never touch our code.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] py-12">
      <div className="mx-auto max-w-2xl px-6">
        <p className="t-eyebrow">Legal</p>
        <h1 className="t-title mt-2 mb-2">Privacy Policy</h1>
        <p className="text-[12px] text-[var(--text-3)] mb-8">
          Version {LEGAL_VERSION} · Last updated August 2026
        </p>

        <div className="space-y-7 text-[15px] leading-relaxed text-[var(--text-2)]">
          <Section title="The short version">
            <p>
              Your health data belongs to you. Today, Diurna Health shows no
              ads, doesn&apos;t sell personal data, and shares identifiable
              data only with the service providers that run the app (listed
              below). We may use <strong>de-identified, aggregated</strong>{" "}
              data — numbers that can&apos;t be traced back to you — to
              improve the product and understand what works. If how we use
              data ever changes materially, the change applies only after
              you&apos;ve accepted an updated version of this policy — and
              your logged health data will not be used to target advertising
              without your separate, explicit opt-in.
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account information</strong> — when you create an
                account: your email, hashed password (Supabase Auth handles
                this), and a unique user ID. We never see your password in
                plain text.
              </li>
              <li>
                <strong>Your protocol data</strong> — installed packs, custom
                behaviors, daily logs, biomarkers, sleep/energy check-ins, and
                any notes you add. Stored locally on your device; also stored
                in your private database row when you have an account.
              </li>
              <li>
                <strong>Personal factors you choose to share</strong> — safety
                flags (e.g. pregnant, taking specific medications). Used only
                to tailor what the app shows you, and excluded from the
                de-identified analysis described below.
              </li>
              <li>
                <strong>Billing status</strong> — when payments are active:
                your plan and subscription status, written by our payment
                processor. Card numbers are handled by Stripe and never touch
                our systems.
              </li>
            </ul>
          </Section>

          <Section title="What we don't collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your name (unless you choose to enter it).</li>
              <li>Your physical address or phone number.</li>
              <li>Location data.</li>
              <li>Browsing history outside the app.</li>
              <li>Contacts, photos, or other device data.</li>
              <li>Payment card numbers (Stripe processes those directly).</li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>To run the app for you</strong> — building your
                timeline, adapting to your signals, syncing across devices,
                sending the reminders you turn on. This is the core use, and
                it operates on your identifiable data because it has to.
              </li>
              <li>
                <strong>To improve the product, in de-identified form</strong>{" "}
                — we may analyze usage and outcomes in aggregate (for example,
                &quot;what share of users keep a morning-light habit past
                week 3&quot;) after removing anything that identifies you.
                De-identified data may also support research, published
                statistics, and the development of new features, including
                features informed by patterns across many users. We do not
                include your personal safety factors in these analyses, and we
                will never attempt to re-identify de-identified data.
              </li>
              <li>
                <strong>To communicate with you</strong> — today, transactional
                email only (sign-in links, password resets, billing receipts).
                If we add product news or offers later, every such email will
                have a one-tap unsubscribe, we&apos;ll honor opt-outs
                immediately, and we&apos;ll use opt-in consent where the law
                requires it.
              </li>
            </ul>
            <p className="mt-2">
              A note on health data specifically: it&apos;s treated as
              sensitive data everywhere that concept exists in law, and we
              process it <strong>only with your consent</strong> — which you
              give by choosing to log it, and withdraw at any time by deleting
              it or your account.
            </p>
            <p className="mt-2">
              What we <strong>don&apos;t</strong> do today: sell personal
              data, share identifiable data with advertisers or data brokers,
              license your data to train third-party AI models, or show ads.
              If any of that changes, it applies only after you&apos;ve been
              asked to accept an updated version of this policy — and your
              logged health data would additionally require your separate,
              explicit opt-in before any advertising use.
            </p>
          </Section>

          <Section title="Where your data lives">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>On your device</strong> — under the localStorage key{" "}
                <code className="text-[12px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                  protocolize-v3
                </code>
                . This is the source of truth when you&apos;re signed out.
              </li>
              <li>
                <strong>Supabase (US-region)</strong> — your account row.
                Row-level security ensures only you can read it. Encrypted at
                rest.{" "}
                <a
                  className="text-[var(--readiness)] underline"
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Vercel (hosting)</strong> — serves the app code.
                Receives standard web server logs (IP, user agent, response
                status) which Vercel retains per their policy.
              </li>
            </ul>
          </Section>

          <Section title="How long we keep data">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>While your account is active</strong> — your logs and
                history are kept so the app can work; nothing expires on its
                own.
              </li>
              <li>
                <strong>When you delete your account</strong> — your row is
                removed from the live database immediately. Residual copies in
                encrypted database backups age out automatically within 30
                days.
              </li>
              <li>
                <strong>Aggregated statistics</strong> — numbers that
                can&apos;t identify you may be retained after deletion (they
                contain nothing to delete about you).
              </li>
            </ul>
          </Section>

          <Section title="International transfers">
            <p>
              Our servers are in the United States. If you use Diurna Health
              from the EU, UK, or elsewhere, your data is transferred to and
              processed in the US. Our service providers protect these
              transfers with the EU-approved safeguards in their data
              processing agreements (standard contractual clauses).
            </p>
          </Section>

          <Section title="Service providers">
            <p>
              These are the companies that process data on our behalf, under
              their own contractual obligations, strictly to run the service:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong>Supabase</strong> — authentication + database.
              </li>
              <li>
                <strong>Vercel</strong> — hosting + edge serving.
              </li>
              <li>
                <strong>Stripe</strong> (when billing is active) — payment
                processing. The payment form is hosted by Stripe; we receive
                your plan and status, never your card.
              </li>
              <li>
                <strong>Anthropic</strong> — admin-side only. Our content
                system uses Claude to help draft protocol content for human
                review. Your personal data is not sent to Anthropic.
              </li>
            </ul>
            <p className="mt-2">
              We do not have advertising vendors, analytics vendors that track
              individual users, or data brokers in our stack. If a provider is
              added or replaced, we&apos;ll update this page — and if the
              change is material, you&apos;ll be asked to acknowledge it (see
              &quot;Changes&quot; below).
            </p>
          </Section>

          <Section title="Your rights">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Export</strong> your data — Profile → Export. You get
                a JSON file containing everything we have.
              </li>
              <li>
                <strong>Delete</strong> your account — Profile → Delete
                account. This removes your row from our database and clears
                local storage. The deletion is immediate and permanent.
                (Already-aggregated statistics can&apos;t be un-aggregated,
                but they contain nothing that identifies you.)
              </li>
              <li>
                <strong>Correct</strong> anything — every field is editable in
                the app. If you want help, email{" "}
                <a
                  className="text-[var(--readiness)] underline"
                  href="mailto:privacy@diurnahealth.com"
                >
                  privacy@diurnahealth.com
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="If you're in the EU/UK/CA">
            <p>
              GDPR / UK GDPR / PIPEDA apply. Our lawful bases are contract
              performance (we can&apos;t run the app without processing your
              data), legitimate interest (de-identified product analytics),
              and consent (everything optional). You have rights of access,
              rectification, erasure, restriction, portability, and
              objection. To exercise any of these, email{" "}
              <a
                className="text-[var(--readiness)] underline"
                href="mailto:privacy@diurnahealth.com"
              >
                privacy@diurnahealth.com
              </a>
              .
            </p>
          </Section>

          <Section title="If the business is ever sold">
            <p>
              If Diurna Health (or RO Group LLC) is acquired, merges, or sells
              the business, your data may transfer to the new owner as part of
              that transaction — bound by this policy&apos;s promises. If a
              new owner wants to materially change how your data is used,
              you&apos;ll be asked to accept the change first, same as any
              other material update.
            </p>
          </Section>

          <Section title="US state privacy rights">
            <p>
              Several states (California, Colorado, Connecticut, Virginia,
              Washington, and others) give you specific rights over personal
              data — access, correction, deletion, and portability, plus the
              right to appeal if we decline a request. Diurna Health&apos;s
              answers are simple because of how it&apos;s built: we don&apos;t
              sell personal data, we don&apos;t share it for targeted
              advertising, and export/delete are self-serve in Profile. For
              Washington residents: your health data here is &quot;consumer
              health data&quot; under the My Health My Data Act; the
              consent-based handling described above is how we meet it, and
              you may appeal any decision by emailing us (and, if unresolved,
              the Washington Attorney General).
            </p>
            <p>
              Browser signals like Global Privacy Control ask sites to stop
              selling or sharing your data for advertising. We currently do
              neither, so there is nothing for the signal to switch off — and
              where law treats it as a formal opt-out request, we honor it.
            </p>
          </Section>

          <Section title="Children">
            <p>
              Diurna Health is for adults — the Terms require you to be 18 to
              create an account, and we don&apos;t knowingly collect data from
              anyone younger. If you believe a minor has signed up, email us
              and we&apos;ll delete the account.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use Supabase Auth (bcrypt-hashed passwords, JWT sessions),
              row-level security so accounts can only read their own data,
              and HTTPS everywhere. Premium status is written only by our
              payment processor&apos;s server-side confirmation — it can&apos;t
              be granted or forged from a browser. No system is perfectly
              secure; if we experience a breach affecting your data,
              we&apos;ll notify you promptly and within any legally required
              window.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              When something material changes, we update this page, bump the
              version number at the top, and show you a one-time in-app notice
              asking you to review and accept the new version. Your acceptance
              (version and date) is recorded in your own account data, where
              you can see it and export it. We will not apply a materially
              broader use of your personal data retroactively without asking
              you first.
            </p>
          </Section>

          <Section title="Who we are">
            <p>
              Diurna Health is operated by <strong>RO Group LLC</strong>, which
              is the data controller for the personal data described in this
              policy. Contact:{" "}
              <a
                className="text-[var(--readiness)] underline"
                href="mailto:privacy@diurnahealth.com"
              >
                privacy@diurnahealth.com
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 flex items-center justify-between text-[13px]">
          <Link href="/terms" className="text-[var(--readiness)]">
            Terms of Service →
          </Link>
          <Link href="/today" className="text-[var(--text-3)]">
            ← Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[17px] font-semibold text-[var(--text-1)] mb-2.5">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
