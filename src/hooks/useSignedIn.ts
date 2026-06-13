"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

/**
 * Reactive "is there a signed-in cloud account" flag.
 *
 * Background ("app closed") push reminders are only stored server-side for a
 * signed-in user — a guest's subscription is discarded — so UI that promises
 * closed-app reminders must gate that claim on this.
 *
 *  - `false` when Supabase isn't configured (local-only build): there's no
 *    account to be signed into, and no server to receive a subscription.
 *  - `null` while the initial session check is in flight, so callers can avoid
 *    flickering copy on first paint.
 *  - tracks sign-in / sign-out live via onAuthStateChange.
 */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(
    supabaseEnabled ? null : false
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      setSignedIn(false);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setSignedIn(false);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (active) setSignedIn(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
