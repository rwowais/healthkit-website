"use client";

import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/constants";

/**
 * Terms of Service. Plain-English, calm voice. Bumped when
 * LEGAL_VERSION changes.
 *
 * Critical points (the things that actually matter legally):
 *  - This is not medical advice. Hard, repeated, unambiguous.
 *  - The app can be wrong. Users accept that.
 *  - Premium subscriptions can be cancelled anytime.
 *  - We can terminate accounts for abuse but not for normal use.
 *  - Disputes go to arbitration (US users).
 *
 * Style note: avoid the wall-of-caps "AS IS" "NO WARRANTY" wording
 * dump. Use a paragraph with the key disclaimers in plain English
 * and surface the formal language in a single readable block at the
 * bottom for users who want it.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] py-12">
      <div className="mx-auto max-w-2xl px-6">
        <p className="t-eyebrow">Legal</p>
        <h1 className="t-title mt-2 mb-2">Terms of Service</h1>
        <p className="text-[12px] text-[var(--text-3)] mb-8">
          Version {LEGAL_VERSION} · Last updated April 2026
        </p>

        <div className="space-y-7 text-[15px] leading-relaxed text-[var(--text-2)]">
          <div
            className="rounded-[var(--r-md)] p-4"
            style={{
              background:
                "color-mix(in srgb, var(--alert) 10%, var(--surface-2))",
              border: "1px solid color-mix(in srgb, var(--alert) 30%, transparent)",
            }}
          >
            <p className="text-[14px] font-semibold text-[var(--alert)] mb-1.5">
              Important: Protocolize is not medical advice.
            </p>
            <p className="text-[13.5px] leading-relaxed text-[var(--text-2)]">
              Protocolize is a personal-tracking and habit-formation
              tool inspired by longevity research. It is not a doctor,
              dietician, pharmacist, or therapist. Nothing in the app
              diagnoses, treats, cures, or prevents any condition. If
              you are unwell, pregnant, taking medication, or
              considering meaningful changes to your routine, talk to
              a qualified clinician first. Always.
            </p>
          </div>

          <Section title="What you're agreeing to">
            <p>
              By using Protocolize you accept these terms and our{" "}
              <Link href="/privacy" className="text-[var(--readiness)] underline">
                Privacy Policy
              </Link>
              . If you don&apos;t agree, please don&apos;t use the app.
            </p>
          </Section>

          <Section title="Your account">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least 13 to create an account.</li>
              <li>Use a real email so you can recover your account.</li>
              <li>Keep your password to yourself.</li>
              <li>You&apos;re responsible for activity in your account.</li>
            </ul>
          </Section>

          <Section title="What you can do">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Install protocol packs and track behaviors.</li>
              <li>Create custom behaviors and packs for personal use.</li>
              <li>Export your data anytime.</li>
              <li>Cancel your subscription anytime.</li>
              <li>Delete your account anytime.</li>
            </ul>
          </Section>

          <Section title="What you can't do">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Scrape, reverse-engineer, or attempt to access other
                users&apos; data.
              </li>
              <li>
                Use the app to give other people medical advice or to
                pretend you&apos;re a clinician.
              </li>
              <li>
                Resell or commercially redistribute our protocol content
                without permission.
              </li>
              <li>Use the app for any unlawful purpose.</li>
            </ul>
          </Section>

          <Section title="Subscriptions and billing">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Free tier includes the full habit loop, three protocol
                packs, three biomarkers, and 7 days of insights.
              </li>
              <li>
                Premium unlocks the full intelligence layer, the
                complete library, biomarker-aware adaptation, and
                unlimited history.
              </li>
              <li>
                Billing is monthly, annually, or lifetime. You can
                cancel monthly/annual anytime from Profile; access
                continues through the end of the billing period.
              </li>
              <li>
                Refunds are handled case-by-case — email{" "}
                <a className="text-[var(--readiness)] underline" href="mailto:billing@protocolize.com">billing@protocolize.com</a>{" "}
                within 14 days of charge.
              </li>
              <li>
                We may change prices with at least 30 days&apos; notice
                for existing subscribers.
              </li>
            </ul>
          </Section>

          <Section title="The 14-day reverse trial">
            <p>
              New accounts start with full Premium for 14 days. If
              you&apos;ve been actively using the app, we may extend
              this once — quietly — so you have a fair chance to feel
              the value. After the trial, premium features lock and the
              free tier remains.
            </p>
          </Section>

          <Section title="Your data is yours">
            <p>
              You own everything you put in. We have a limited license
              to display it back to you, process it for the features
              you&apos;ve enabled, and back it up. We do not sell it.
              See the{" "}
              <Link href="/privacy" className="text-[var(--readiness)] underline">
                Privacy Policy
              </Link>{" "}
              for the full data picture.
            </p>
          </Section>

          <Section title="Our content">
            <p>
              Protocol packs, behavior descriptions, evidence
              summaries, and the app design are our intellectual
              property (or licensed to us). You can use them inside
              Protocolize for your personal practice. You can&apos;t
              redistribute them publicly without permission.
            </p>
          </Section>

          <Section title="If something goes wrong">
            <p>
              We try hard to make Protocolize accurate and reliable, but
              it&apos;s a tool, not an oracle. We can&apos;t guarantee
              uptime, accuracy of recommendations, or any specific
              health outcome. To the maximum extent allowed by law,
              we&apos;re not liable for indirect, incidental, or
              consequential damages from your use of the app. If we
              are liable for direct damages, our total liability is
              capped at the amount you paid us in the last 12 months.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You can delete your account anytime from Profile. We can
              terminate an account if it violates these terms (with
              warning when reasonable). If we terminate your account
              without cause, we&apos;ll refund any prepaid time you
              didn&apos;t use.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We&apos;ll update these terms when something material
              changes and bump the version. If the change affects you,
              you&apos;ll see a one-time banner asking you to
              acknowledge.
            </p>
          </Section>

          <Section title="Disputes (US users)">
            <p>
              You and Protocolize agree to first try to resolve any
              dispute informally by emailing{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:legal@protocolize.com">legal@protocolize.com</a>.
              If that doesn&apos;t work within 60 days, disputes will be
              resolved by binding arbitration under the American
              Arbitration Association&apos;s consumer rules, in your
              home state.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a className="text-[var(--readiness)] underline" href="mailto:legal@protocolize.com">legal@protocolize.com</a>
            </p>
          </Section>
        </div>

        <div className="mt-12 flex items-center justify-between text-[13px]">
          <Link
            href="/privacy"
            className="text-[var(--readiness)]"
          >
            Privacy Policy →
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
