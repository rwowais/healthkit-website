"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { STATE_EVENT } from "@/lib/datasource";
import { signOut } from "@/lib/auth";
import { Eyebrow } from "@/components/ui";

/**
 * Account + cloud-sync control in Profile. Signed-out state routes to the
 * premium /auth screen (single source of truth for auth). Rendered only
 * when Supabase is configured.
 */
export default function SupabaseAuth() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) =>
      setUserEmail(data.user?.email ?? null)
    );
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent(STATE_EVENT));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseEnabled) return null;

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
            onClick={async () => {
              await signOut();
              setUserEmail(null);
            }}
            className="press tr-fast shrink-0 rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold text-[var(--text-3)]"
            style={{ background: "var(--surface-3)" }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <>
          <p className="t-caption mt-2 leading-relaxed">
            Add an account to back up and sync across devices. Your local
            data is preserved — nothing is lost.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[#08090B]"
          >
            Sign in or create an account
          </button>
        </>
      )}
    </div>
  );
}
