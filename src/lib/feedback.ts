/**
 * feedback.ts — the one-way suggestion box behind Profile → "Request a
 * feature" (inspired by Built With Science's version, owner request
 * 2026-08-17).
 *
 * Deliberately NOT part of AppState/useAppState: feedback is not user state —
 * it must not sync, merge, export, or resurrect through tombstones. It's a
 * single INSERT into `protocolize_feedback`, RLS-restricted so users can only
 * write as themselves and only admins can read the queue.
 */
import { getSupabase, getUserId } from "./supabase";

export const FEEDBACK_TITLE_MAX = 120;
export const FEEDBACK_BODY_MAX = 4000;

export type FeedbackKind = "feature" | "bug";

export interface FeedbackResult {
  ok: boolean;
  reason?: string;
}

export async function submitFeedback(input: {
  kind: FeedbackKind;
  title: string;
  body: string;
}): Promise<FeedbackResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, reason: "Give it a short title first." };
  if (title.length > FEEDBACK_TITLE_MAX)
    return { ok: false, reason: "Keep the title under 120 characters." };
  if (body.length > FEEDBACK_BODY_MAX)
    return { ok: false, reason: "That's a bit long — 4000 characters max." };

  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Feedback needs cloud mode." };
  const userId = await getUserId().catch(() => null);
  if (!userId) return { ok: false, reason: "Sign in to send feedback." };

  const { error } = await sb.from("protocolize_feedback").insert({
    user_id: userId,
    kind: input.kind,
    title,
    body: body || null,
    // Vercel injects the commit SHA at build time; helps map a bug report to
    // the exact deploy it was filed against. Absent locally — that's fine.
    app_version:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
  });
  if (error) {
    // RLS refusals and network failures both land here; the user-facing
    // distinction doesn't matter — the send didn't happen.
    return { ok: false, reason: "Couldn't send right now — try again later." };
  }
  return { ok: true };
}
