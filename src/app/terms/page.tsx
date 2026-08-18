"use client";

import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/constants";
import { TRIAL_DAYS } from "@/lib/entitlements";

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
          Version {LEGAL_VERSION} · Last updated August 2026
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
              These terms are an agreement between you and{" "}
              <strong>RO Group LLC</strong>, the company that operates
              Protocolize (&quot;we&quot;, &quot;us&quot;). By using
              Protocolize you accept these terms and our{" "}
              <Link href="/privacy" className="text-[var(--readiness)] underline">
                Privacy Policy
              </Link>
              . If you don&apos;t agree, please don&apos;t use the app.
            </p>
          </Section>

          <Section title="What the intelligence layer is — and isn't">
            <p>
              Protocolize generates personalized suggestions: when to do a
              behavior, how to order your day, which supplements people
              commonly take and in what ranges, what your patterns look like,
              and gentle warnings when a plan conflicts with itself. All of it
              is produced <strong>algorithmically</strong>, from what you log
              plus general published research — not by a person who knows you,
              and not by anyone licensed to advise you.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                Suggestions are <strong>educational starting points</strong>,
                not instructions or prescriptions. They can be wrong,
                incomplete, out of date, or simply wrong <em>for you</em> —
                the assumptions behind them may not fit your body, your
                medications, or your situation.
              </li>
              <li>
                Using Protocolize creates <strong>no doctor-patient or other
                professional relationship</strong> with us, ever.
              </li>
              <li>
                Supplement doses shown are common ranges in published
                research, not doses chosen for you. Supplements can interact
                with medications and conditions — clear anything new with
                your doctor or pharmacist first. These statements have not
                been evaluated by the FDA; Protocolize does not diagnose,
                treat, cure, or prevent any disease.
              </li>
              <li>
                <strong>You assume the risk</strong> of acting on any
                suggestion. Changes to exercise, diet, supplements, or sleep
                carry inherent risk; you are the one who decides what is safe
                for you, and any reliance on the app&apos;s output is at your
                own risk. If something feels wrong, stop and seek medical
                care.
              </li>
            </ul>
          </Section>

          <Section title="Your account">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least 18 to create an account.</li>
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
                users&apos; data — including harvesting our content or data to
                train AI models.
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
                Free tier includes the full daily habit loop, two active
                protocol packs, tracking for up to three supplements, your
                full history and streaks, and insights on a 3-day delay.
              </li>
              <li>
                Premium unlocks the complete protocol library, your full
                supplement stack, real-time insights and correlations, the
                custom protocol builder, and biomarker-aware adaptation.
              </li>
              <li>
                If your trial ends with more packs or supplements than the
                free tier includes, the extras pause — nothing is deleted,
                and upgrading restores them exactly as they were.
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

          <Section title="The reverse trial">
            <p>
              New accounts start with full Premium for {TRIAL_DAYS} days. If
              you&apos;ve been actively using the app, we may extend
              this once — quietly — so you have a fair chance to feel
              the value. After the trial, premium features lock and the
              free tier remains.
            </p>
          </Section>

          <Section title="Your data is yours">
            <p>
              You own everything you put in. We have a limited license to
              display it back to you, process it for the features you&apos;ve
              enabled, back it up, and analyze it in{" "}
              <strong>de-identified, aggregated form</strong> to improve the
              product. We do not sell it, and we never share anything that
              identifies you except with the providers that run the service.
              See the{" "}
              <Link href="/privacy" className="text-[var(--readiness)] underline">
                Privacy Policy
              </Link>{" "}
              for the full data picture.
            </p>
          </Section>

          <Section title="Ideas you send us">
            <p>
              If you send us feedback — feature requests, bug reports,
              suggestions — we can use it freely to improve Protocolize,
              without owing payment or credit. Your health data is not
              &quot;feedback&quot;; this covers only the ideas you choose to
              send.
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

          <Section title="The service will evolve">
            <p>
              Protocolize is actively developed. Features may be added,
              changed, moved between the free and Premium tiers, or retired;
              free-tier limits may change. Two promises hold through any of
              it: your data is never deleted by a plan change (anything over a
              limit pauses, and restores exactly when unlocked), and if
              you&apos;ve paid for something we materially remove, we&apos;ll
              offer a fair remedy — a comparable feature, credit, or a
              pro-rated refund.
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

          <Section title="If your use of the app causes a problem">
            <p>
              If your breach of these terms, or your unlawful use of
              Protocolize, gets us sued or fined, you agree to cover the
              costs and damages that result. This doesn&apos;t apply to
              ordinary, good-faith use of the app.
            </p>
          </Section>

          <Section title="The formal version">
            <p className="text-[13.5px] leading-relaxed">
              THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THIS
              PARAGRAPH EXISTS BECAUSE THE LAW REQUIRES DISCLAIMERS TO BE
              CONSPICUOUS — THE PLAIN-ENGLISH MEANING IS THE SAME AS THE
              SECTIONS ABOVE: THE APP IS A TOOL, NOT A GUARANTEE.
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
              When something material changes we update this page, bump the
              version number at the top, and show a one-time in-app notice
              asking you to review and accept. Your acceptance (version and
              date) is recorded in your account data. Continuing to use
              Protocolize after accepting means the current version applies.
              If you don&apos;t agree with a change, you can export your data
              and delete your account at any time.
            </p>
          </Section>

          <Section title="Disputes (US users)">
            <p>
              You and Protocolize agree to first try to resolve any
              dispute informally by emailing{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:legal@protocolize.com">legal@protocolize.com</a>.
              If that doesn&apos;t work within 60 days, disputes will be
              resolved by binding arbitration under the American
              Arbitration Association&apos;s consumer rules, in your home
              state, under the laws of your state of residence. Either of us
              can still bring an individual claim in small-claims court
              instead. Disputes are resolved individually — not as part of a
              class or representative action.
            </p>
            <p>
              You can opt out of arbitration entirely by emailing{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:legal@protocolize.com">legal@protocolize.com</a>{" "}
              within 30 days of first accepting these terms, with the subject
              line &quot;Arbitration opt-out&quot;. Opting out doesn&apos;t
              affect anything else in these terms.
            </p>
          </Section>

          <Section title="The fine print">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>If the business changes hands</strong> — we may assign
                these terms as part of a merger, acquisition, or sale of the
                business; your data and these promises travel with it (see the
                Privacy Policy). You can&apos;t assign your account to someone
                else.
              </li>
              <li>
                <strong>If a piece is struck down</strong> — the rest of these
                terms still stand.
              </li>
              <li>
                <strong>Whole agreement</strong> — these terms plus the
                Privacy Policy are the entire agreement between us.
              </li>
              <li>
                <strong>Not enforcing isn&apos;t waiving</strong> — if we
                don&apos;t enforce a term today, we can still enforce it
                later.
              </li>
              <li>
                <strong>Events beyond our control</strong> — we&apos;re not
                liable for failures caused by things like outages, disasters,
                or acts of government.
              </li>
            </ul>
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
