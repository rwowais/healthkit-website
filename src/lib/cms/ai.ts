/**
 * ai.ts — thin client wrapper for the server AI drafter.
 *
 * The browser never sees the Anthropic key. This sends the user's own
 * Supabase access token to `/api/cms/generate`, which re-verifies admin
 * server-side. Safe-by-default: with no Supabase / no session it returns
 * { ok:false } and never throws, mirroring the rest of the CMS rail.
 */
import { getSupabase } from "../supabase";
import type { AiBehaviorDraft } from "./aiSchema";

export type { AiBehaviorDraft } from "./aiSchema";

export interface GenerateResult {
  ok: boolean;
  draft?: AiBehaviorDraft;
  reason?: string;
}

export async function generateBehaviorDraft(
  description: string
): Promise<GenerateResult> {
  const desc = description.trim();
  if (!desc) return { ok: false, reason: "Describe the item first." };

  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };

  try {
    const {
      data: { session },
    } = await sb.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, reason: "Sign in required." };

    const res = await fetch("/api/cms/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: desc }),
    });

    const data = (await res.json().catch(() => null)) as
      | GenerateResult
      | null;
    if (!data) {
      // Concise diagnostic in the console so we can read the real status
      // from DevTools when something fails in production.
      console.error(
        "[ai] generate non-JSON response",
        res.status,
        res.statusText
      );
      return {
        ok: false,
        reason: `AI drafting failed (HTTP ${res.status}). Open DevTools → Network for details.`,
      };
    }
    if (!data.ok)
      console.error("[ai] generate", res.status, data.reason);
    return data;
  } catch (e) {
    console.error("[ai] network error", e);
    return { ok: false, reason: "Network error. Try again." };
  }
}
