"use client";

/**
 * /admin/metrics — the owner's business dashboard.
 *
 * Answers the questions the Supabase dashboard cannot: how many users exist,
 * where each sits in the 7-day trial, who is paying, and whether anyone is
 * actually using the thing. (Supabase's own "Reports" are infrastructure
 * metrics — API load, storage — not business state.)
 *
 * Data comes from the `admin_metrics()` Postgres function, NOT from client
 * queries. protocolize_state is RLS'd to "own row", which is correct and must
 * not be loosened just to build a dashboard; the function is SECURITY DEFINER
 * and refuses anyone absent from cms_admins, so no service-role key is ever
 * exposed to the browser.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

type UserRow = {
  email: string;
  joined: string;
  last_seen: string | null;
  onboarded: boolean;
  days_logged: number;
  tier: string;
  trial_days_left: number | null;
  trial_ended: boolean;
  plan: string | null;
  source: string | null;
  sub_status: string | null;
};
type Metrics = {
  generated_at: string;
  total_users: number;
  onboarded: number;
  activated: number;
  engaged: number;
  premium: number;
  paying: number;
  in_trial: number;
  trial_ended: number;
  no_trial: number;
  signups_7d: number;
  signups_30d: number;
  active_7d: number;
  users: UserRow[];
};

function Stat({
  n,
  label,
  sub,
  tone,
}: {
  n: number | string;
  label: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
      <div
        className="text-[26px] font-bold leading-none tracking-tight"
        style={{ color: tone ?? "var(--text-1)" }}
      >
        {n}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </div>
      {sub && <div className="mt-1 text-[12px] text-[var(--text-3)]">{sub}</div>}
    </div>
  );
}

/** Human status for one row — the same logic the owner asked to see at a glance. */
function statusOf(u: UserRow): { text: string; tone: string } {
  if (u.tier === "premium")
    return {
      text:
        u.source === "stripe"
          ? `Paying · ${u.plan ?? "?"}${u.sub_status ? ` · ${u.sub_status}` : ""}`
          : `Premium (${u.source ?? "manual"})`,
      tone: "var(--vitality)",
    };
  if (u.trial_days_left != null)
    return { text: `Trial · ${u.trial_days_left}d left`, tone: "var(--readiness)" };
  if (u.trial_ended) return { text: "Trial ended · free", tone: "var(--text-3)" };
  return { text: "Free · no trial", tone: "var(--text-3)" };
}

export default function AdminMetricsPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    isAdmin().then(async (admin) => {
      setOk(admin);
      if (!admin) return;
      const sb = getSupabase();
      if (!sb) return setErr("Cloud mode is off.");
      const { data, error } = await sb.rpc("admin_metrics");
      if (error) setErr(error.message);
      else setM(data as Metrics);
    });
  }, []);

  if (ok === null)
    return <div className="p-10 text-[14px] text-[var(--text-3)]">Checking…</div>;
  if (!ok)
    return (
      <div className="p-10">
        <p className="text-[15px] text-[var(--text-2)]">Not available.</p>
        <Link href="/today" className="mt-3 inline-block text-[14px] text-[var(--readiness)]">
          ← Back to Today
        </Link>
      </div>
    );

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
              Admin
            </p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-[var(--text-1)]">
              Metrics
            </h1>
          </div>
          <div className="flex gap-4 text-[13px]">
            <Link href="/admin" className="text-[var(--readiness)]">
              CMS
            </Link>
            <Link href="/today" className="text-[var(--text-3)]">
              ← Today
            </Link>
          </div>
        </div>

        {err && (
          <p className="mt-6 text-[14px] text-[var(--alert)]">Couldn&rsquo;t load: {err}</p>
        )}
        {!m && !err && (
          <p className="mt-6 text-[14px] text-[var(--text-3)]">Loading…</p>
        )}

        {m && (
          <>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat n={m.total_users} label="Total users" sub={`${m.signups_7d} in last 7d`} />
              <Stat
                n={m.activated}
                label="Activated"
                sub={`${pct(m.activated, m.total_users)}% logged ≥1 day`}
              />
              <Stat
                n={m.in_trial}
                label="In trial now"
                tone="var(--readiness)"
                sub="7-day reverse trial"
              />
              <Stat
                n={m.paying}
                label="Paying"
                tone={m.paying ? "var(--vitality)" : undefined}
                sub={m.premium > m.paying ? `+${m.premium - m.paying} comped` : "via Stripe"}
              />
              <Stat n={m.trial_ended} label="Trial ended" sub="now on free" />
              <Stat n={m.engaged} label="Engaged" sub="logged ≥3 days" />
              <Stat n={m.active_7d} label="Active 7d" sub="signed in" />
              <Stat
                n={m.onboarded}
                label="Onboarded"
                sub={`${pct(m.onboarded, m.total_users)}% finished setup`}
              />
            </div>

            <h2 className="mt-9 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
              Users
            </h2>
            <div className="mt-3 overflow-x-auto rounded-[var(--r-md)] border border-[var(--hairline)]">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wider text-[var(--text-3)]">
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Joined</th>
                    <th className="px-4 py-2.5 font-semibold">Last seen</th>
                    <th className="px-4 py-2.5 font-semibold">Days</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.users.map((u) => {
                    const s = statusOf(u);
                    return (
                      <tr key={u.email} className="border-t border-[var(--hairline)]">
                        <td className="px-4 py-2.5 text-[var(--text-1)]">{u.email}</td>
                        <td className="px-4 py-2.5 text-[var(--text-2)]">{u.joined}</td>
                        <td className="px-4 py-2.5 text-[var(--text-2)]">
                          {u.last_seen ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-2)]">{u.days_logged}</td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: s.tone }}>
                          {s.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-[12px] text-[var(--text-3)]">
              Generated {new Date(m.generated_at).toLocaleString()} · newest 100 users ·
              revenue and churn live in Stripe; traffic and funnel live in Plausible.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
