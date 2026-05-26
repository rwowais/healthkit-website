"use client";

import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/constants";

/**
 * Privacy policy. Plain-English, calm-system voice. Updated when
 * LEGAL_VERSION in src/lib/constants.ts is bumped — that bump triggers
 * re-acknowledgement for existing users.
 *
 * Style: not legalese. Not enterprise jargon. The point is to actually
 * tell the user what we do with their data in language they understand.
 * If they want the formal legal version, they can ask their lawyer to
 * parse this one.
 *
 * Footprint check (what we actually do, not what we boilerplate):
 *  - Cloud storage: optional Supabase row keyed to the user's id. RLS
 *    enforces own-row access. No third party reads it.
 *  - Local storage: protocolize-v3 key, never leaves the device unless
 *    the user signs in.
 *  - Telemetry: not yet wired (phase 0.9). When wired, will be
 *    privacy-first (Plausible-style: no individual user IDs, no
 *    cookies, just aggregate counts).
 *  - Email: only transactional via Supabase Auth (magic links, password
 *    reset). No marketing list. No third-party email vendors yet.
 *  - Third parties: Supabase (cloud sync), Vercel (hosting), Anthropic
 *    (the CMS AI suggestions — admin-side only, user content does not
 *    leave the device for AI processing).
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] py-12">
      <div className="mx-auto max-w-2xl px-6">
        <p className="t-eyebrow">Legal</p>
        <h1 className="t-title mt-2 mb-2">Privacy Policy</h1>
        <p className="text-[12px] text-[var(--text-3)] mb-8">
          Version {LEGAL_VERSION} · Last updated April 2026
        </p>

        <div className="space-y-7 text-[15px] leading-relaxed text-[var(--text-2)]">
          <Section title="The short version">
            <p>
              Protocolize collects the minimum data needed to run the
              app and never sells it. Your behavior logs, biomarkers,
              and check-ins are yours. If you don&apos;t sign up for an
              account, nothing ever leaves your device.
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account information</strong> — when you create an
                account: your email, hashed password (Supabase
                Auth handles this), and a unique user ID. We never see
                your password in plain text.
              </li>
              <li>
                <strong>Your protocol data</strong> — installed packs,
                custom behaviors, daily logs, biomarkers, sleep/energy
                check-ins, and any notes you add. Stored locally on
                your device; also stored in your private Supabase row
                if you have an account.
              </li>
              <li>
                <strong>Personal factors you choose to share</strong> —
                safety flags (e.g. pregnant, taking specific
                medications). These never leave your account row and
                are not used for any purpose other than tailoring what
                we show you.
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
              <li>Payment card numbers (handled by Stripe directly when billing is enabled).</li>
            </ul>
          </Section>

          <Section title="Where your data lives">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>On your device</strong> — under the localStorage
                key <code className="text-[12px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">protocolize-v3</code>.
                This is the source of truth when you&apos;re signed out.
              </li>
              <li>
                <strong>Supabase (US-region)</strong> — your account row
                if you signed up for cloud sync. Row-level security
                ensures only you can read it. Database is encrypted at
                rest. <a className="text-[var(--readiness)] underline" href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase privacy policy</a>.
              </li>
              <li>
                <strong>Vercel (hosting)</strong> — serves the app code.
                Receives standard web server logs (IP, user agent,
                response status) which Vercel retains per their policy.
              </li>
            </ul>
          </Section>

          <Section title="Third parties">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Supabase</strong> — auth + database.
              </li>
              <li>
                <strong>Vercel</strong> — hosting + edge serving.
              </li>
              <li>
                <strong>Stripe</strong> (when billing is active) —
                payment processing. We never see your card numbers; the
                payment form is hosted by Stripe.
              </li>
              <li>
                <strong>Anthropic</strong> — admin-side only. Our CMS
                uses Claude to help draft protocol content for review.
                Your user data is never sent to Anthropic; only the
                admin-side authoring prompts.
              </li>
            </ul>
            <p className="mt-2">
              We do not have advertising vendors, analytics vendors that
              track individual users, or any data brokers in our stack.
            </p>
          </Section>

          <Section title="Your rights">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Export</strong> your data — Profile → Export.
                You get a JSON file containing everything we have.
              </li>
              <li>
                <strong>Delete</strong> your account — Profile → Delete
                account. This removes your row from our database and
                clears local storage. The deletion is immediate and
                permanent.
              </li>
              <li>
                <strong>Correct</strong> anything — every field is
                editable in the app. If you want help, email{" "}
                <a className="text-[var(--readiness)] underline" href="mailto:privacy@protocolize.com">privacy@protocolize.com</a>.
              </li>
            </ul>
          </Section>

          <Section title="If you're in the EU/UK/CA">
            <p>
              GDPR / UK GDPR / PIPEDA apply. Our lawful basis for
              processing your data is contract performance (we can&apos;t
              run the app without it) and your consent (everything
              optional). You have rights of access, rectification,
              erasure, restriction, portability, and objection. To
              exercise any of these, email{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:privacy@protocolize.com">privacy@protocolize.com</a>.
            </p>
          </Section>

          <Section title="Children">
            <p>
              Protocolize is not directed at children under 13. We don&apos;t
              knowingly collect data from anyone under that age. If you
              believe a child has signed up, email us and we&apos;ll delete
              the account.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use Supabase Auth (bcrypt-hashed passwords, JWT
              sessions) and HTTPS everywhere. No system is perfectly
              secure; if we ever experience a breach affecting your
              data, we&apos;ll notify you within 72 hours.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We&apos;ll update this page when something material
              changes and bump the version. If the change affects you,
              you&apos;ll see a one-time banner asking you to
              acknowledge the new version.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a className="text-[var(--readiness)] underline" href="mailto:privacy@protocolize.com">privacy@protocolize.com</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 flex items-center justify-between text-[13px]">
          <Link
            href="/terms"
            className="text-[var(--readiness)]"
          >
            Terms of Service →
          </Link>
          <Link
            href="/today"
            className="text-[var(--text-3)]"
          >
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
