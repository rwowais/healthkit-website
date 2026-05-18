"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { STATE_EVENT } from "@/lib/datasource";
import { Eyebrow } from "@/components/ui";

/**
 * Magic-link account + cloud sync control. Rendered only when Supabase
 * is configured; otherwise the app stays fully local.
 */
export default function SupabaseAuth() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      // Trigger a state reload so cloud data hydrates / migration runs.
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent(STATE_EVENT));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseEnabled) return null;

  const sendLink = async () => {
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/profile`
            : undefined,
      },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUserEmail(null);
  };

  return (
    <div className="mt-4 rounded-[var(--r-md)] bg-[var(--surface-2)] p-4">
      <Eyebrow color="var(--vitality)">Account & Cloud Sync</Eyebrow>
      {userEmail ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[var(--text-1)]">
              {userEmail}
            </p>
            <p className="t-caption mt-0.5">
              Synced — your protocols follow you across devices.
            </p>
          </div>
          <button
            onClick={signOut}
            className="press tr-fast shrink-0 rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold text-[var(--text-3)]"
            style={{ background: "var(--surface-3)" }}
          >
            Sign out
          </button>
        </div>
      ) : sent ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-2)]">
          Check <span className="text-[var(--text-1)]">{email}</span> — open
          the magic link on this device to finish signing in. Your existing
          data will move to the cloud automatically and safely.
        </p>
      ) : (
        <>
          <p className="t-caption mt-2 leading-relaxed">
            Add an account to back up and sync across devices. Your local
            data is preserved — nothing is lost.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="min-w-0 flex-1 rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
            />
            <button
              onClick={sendLink}
              disabled={busy || !email.trim()}
              className="press tr-fast shrink-0 rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-3 text-[14px] font-semibold text-[#08090B] disabled:opacity-40"
            >
              {busy ? "…" : "Send link"}
            </button>
          </div>
          {err && (
            <p className="mt-2 text-[12px] text-[var(--alert)]">{err}</p>
          )}
        </>
      )}
    </div>
  );
}
