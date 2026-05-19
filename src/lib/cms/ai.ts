/**
 * ai.ts — thin client wrapper for the server AI drafter.
 *
 * The browser never sees the Anthropic key. This sends the user's own
 * Supabase access token to `/api/cms/generate`, which re-verifies admin
 * server-side. Safe-by-default: with no Supabase / no session it returns
 * { ok:false } and never throws, mirroring the rest of the CMS rail.
 */
import { getSupabase } from "../supabase";
import type {
  AiBehaviorDraft,
  AiBehaviorDraftWithSuggestions,
} from "./aiSchema";

export type { AiBehaviorDraft } from "./aiSchema";

export interface GenerateResult {
  ok: boolean;
  draft?: AiBehaviorDraft;
  reason?: string;
}
export interface GenerateWithSuggestResult {
  ok: boolean;
  draft?: AiBehaviorDraftWithSuggestions;
  reason?: string;
}

/** Internal: POST a JSON body to /api/cms/generate with the user token. */
async function postGenerate<T extends { ok: boolean; reason?: string }>(
  body: unknown
): Promise<T> {
  const sb = getSupabase();
  if (!sb)
    return { ok: false, reason: "Cloud not configured." } as unknown as T;
  try {
    const {
      data: { session },
    } = await sb.auth.getSession();
    const token = session?.access_token;
    if (!token)
      return { ok: false, reason: "Sign in required." } as unknown as T;
    const res = await fetch("/api/cms/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!data) {
      // Concise diagnostic so we can read the real status from DevTools.
      console.error(
        "[ai] generate non-JSON response",
        res.status,
        res.statusText
      );
      return {
        ok: false,
        reason: `AI drafting failed (HTTP ${res.status}). Open DevTools → Network for details.`,
      } as unknown as T;
    }
    if (!data.ok) console.error("[ai] generate", res.status, data.reason);
    return data;
  } catch (e) {
    console.error("[ai] network error", e);
    return {
      ok: false,
      reason: "Network error. Try again.",
    } as unknown as T;
  }
}

export async function generateBehaviorDraft(
  description: string
): Promise<GenerateResult> {
  const desc = description.trim();
  if (!desc) return { ok: false, reason: "Describe the item first." };
  return postGenerate<GenerateResult>({ description: desc });
}

/**
 * Suggest-protocol mode: one call → draft + ranked protocols. The
 * model's slug claims are re-validated server-side against the slugs
 * we pass in `availableProtocols`.
 */
export async function generateBehaviorDraftAndSuggestProtocol(
  description: string,
  availableProtocols: {
    slug: string;
    name: string;
    tagline?: string;
    goal?: string;
  }[]
): Promise<GenerateWithSuggestResult> {
  const desc = description.trim();
  if (!desc) return { ok: false, reason: "Describe the idea first." };
  if (!availableProtocols.length)
    return { ok: false, reason: "No protocols available." };
  return postGenerate<GenerateWithSuggestResult>({
    description: desc,
    suggestProtocol: true,
    availableProtocols,
  });
}
