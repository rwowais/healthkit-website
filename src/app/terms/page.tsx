"use client";

import Link from "next/link";
import { LEGAL_VERSION, ENTITY_STATE, ENTITY_NAME } from "@/lib/constants";
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
/** Precise state once the owner confirms it; valid entity-relative fallback until then. */
const governingLaw = ENTITY_STATE
  ? `the State of ${ENTITY_STATE}`
  : `the state in which ${ENTITY_NAME} is organized`;

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
              Important: Diurna Health is not medical advice.
            </p>
            <p className="text-[13.5px] leading-relaxed text-[var(--text-2)]">
              Diurna Health is a personal-tracking and habit-formation
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
              Diurna Health (&quot;we&quot;, &quot;us&quot;). By using
              Diurna Health you accept these terms and our{" "}
              <Link href="/privacy" className="text-[var(--readiness)] underline">
                Privacy Policy
              </Link>
              . If you don&apos;t agree, please don&apos;t use the app.
            </p>
          </Section>

          <Section title="What the intelligence layer is — and isn't">
            <p>
              Diurna Health generates personalized suggestions: when to do a
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
                Using Diurna Health creates <strong>no doctor-patient or other
                professional relationship</strong> with us, ever.
              </li>
              <li>
                Supplement doses shown are common ranges in published
                research, not doses chosen for you. Supplements can interact
                with medications and conditions — clear anything new with
                your doctor or pharmacist first. These statements have not
                been evaluated by the FDA; Diurna Health does not diagnose,
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

          <Section title="Your health, and the risk you accept">
            <p>
              By using Diurna Health you confirm that you are physically able to
              undertake the activities you choose to log, that you have
              consulted a physician if you have any condition, injury,
              pregnancy, or medication that could make them unsafe, and that
              you are not relying on us to tell you what is safe for you.
            </p>
            <p>
              Exercise, dietary change, sleep change and supplementation carry
              inherent risks, including injury and, rarely, serious harm.{" "}
              <strong>
                You voluntarily assume all of those risks, and to the fullest
                extent permitted by law you release {ENTITY_NAME} from claims
                for injury, illness, loss or damage arising out of your use of
                the app or your decision to follow anything it suggests.
              </strong>{" "}
              Stop immediately and seek medical care if you feel unwell.
            </p>
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
                Except where the law requires otherwise, fees are
                non-refundable and non-transferable, including for partial
                periods and unused time. We may still make exceptions at our
                discretion — email{" "}
                <a className="text-[var(--readiness)] underline" href="mailto:hello@diurnahealth.com">hello@diurnahealth.com</a>{" "}
                within 14 days of a charge and we&apos;ll look at it.
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
              product. Today we don&apos;t sell it and share identifiable
              data only with the providers that run the service; material
              changes to how data is used take effect only after you accept
              an updated policy.
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
              suggestions — we can use it freely to improve Diurna Health,
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
              Diurna Health for your personal practice. You can&apos;t
              redistribute them publicly without permission.
            </p>
          </Section>

          <Section title="The service will evolve">
            <p>
              Diurna Health is actively developed. Features may be added,
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
              We try hard to make Diurna Health accurate and reliable, but
              it&apos;s a tool, not an oracle. We can&apos;t guarantee
              uptime, accuracy of recommendations, or any specific
              health outcome. To the maximum extent allowed by law,
              we&apos;re not liable for indirect, incidental, or
              consequential damages from your use of the app. If we
              are liable for direct damages, our total liability for all
              claims combined is capped at the amount you paid us in the 12
              months before the claim arose. Some states don&apos;t allow
              some of these limits, in which case they apply to the fullest
              extent those states permit.
            </p>
          </Section>

          <Section title="If your use of the app causes a problem">
            <p>
              You agree to defend, indemnify and hold harmless {ENTITY_NAME}
              and its members, officers and contractors from any claim,
              damage, loss, liability and expense (including reasonable legal
              fees) arising out of or connected with your use of Diurna Health,
              your breach of these terms, your violation of any law, or your
              infringement of anyone&apos;s rights. We may take over the
              defense of any such claim at your expense, and you agree to
              cooperate with us.
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
              terminate or suspend an account that violates these terms, or
              where we reasonably suspect fraud, abuse or unlawful use — in
              those cases no refund is owed for prepaid time. If we terminate
              your account <em>without</em> cause, we&apos;ll refund any
              prepaid time you didn&apos;t use.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              When something material changes we update this page, bump the
              version number at the top, and show a one-time in-app notice
              asking you to review and accept. Your acceptance (version and
              date) is recorded in your account data. Continuing to use
              Diurna Health after accepting means the current version applies.
              If you don&apos;t agree with a change, you can export your data
              and delete your account at any time.
            </p>
          </Section>

          <Section title="Disputes (US users)">
            <p>
              You and Diurna Health agree to first try to resolve any
              dispute informally by emailing{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:legal@diurnahealth.com">legal@diurnahealth.com</a>.
              If that doesn&apos;t work within 60 days, disputes will be
              resolved by binding arbitration under the American
              Arbitration Association&apos;s consumer rules, governed by{" "}
              {governingLaw} (without regard to its conflict-of-laws rules).
              Either of us can still bring an individual claim in small-claims
              court instead.
            </p>
            <p className="text-[13.5px] leading-relaxed">
              TO THE EXTENT PERMITTED BY LAW, YOU AND {ENTITY_NAME.toUpperCase()}{" "}
              EACH WAIVE THE RIGHT TO A TRIAL BY JURY, AND EACH WAIVE THE
              RIGHT TO BRING OR PARTICIPATE IN ANY CLASS, COLLECTIVE OR
              REPRESENTATIVE ACTION. DISPUTES ARE RESOLVED INDIVIDUALLY.
            </p>
            <p>
              Any claim relating to Diurna Health must be brought within{" "}
              <strong>one year</strong> after it arises, or it is permanently
              barred — except where a longer period is required by law.
            </p>
            <p>
              You can opt out of arbitration entirely by emailing{" "}
              <a className="text-[var(--readiness)] underline" href="mailto:legal@diurnahealth.com">legal@diurnahealth.com</a>{" "}
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
              <li>
                <strong>Other people&apos;s content and services</strong> —
                links, references, research summaries and any third-party
                products mentioned are provided for information only. We
                don&apos;t control them, don&apos;t endorse them, and
                aren&apos;t responsible for them.
              </li>
              <li>
                <strong>What survives</strong> — the health release, the
                disclaimers, limitation of liability, indemnification,
                dispute-resolution and this fine print all continue to apply
                after your account ends.
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              <a className="text-[var(--readiness)] underline" href="mailto:legal@diurnahealth.com">legal@diurnahealth.com</a>
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
