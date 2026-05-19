/**
 * suggestions.ts — the constrained AI-augmentation rail.
 *
 * Governance, by design:
 *  - A suggestion (from a human, a script, or a future model) only ever
 *    lands in cms_ai_suggestions as `pending`. Nothing is auto-applied.
 *  - A human Approves → the proposed fields are merged into the target's
 *    DRAFT row (versioned + audited). Still not live.
 *  - A human Publishes (existing pipeline) → only then do users see it.
 *  AI never writes to protocols/behaviors and never publishes. Evidence
 *  rows are out of scope here (verified-only, never AI-mutated).
 */
import { getSupabase, getUserId } from "../supabase";
import { saveProtocol, saveBehavior } from "./authoring";

type SB = NonNullable<ReturnType<typeof getSupabase>>;
export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface Suggestion {
  id: string;
  entity_type: "protocol" | "behavior";
  entity_id: string;
  proposed: Record<string, unknown>;
  rationale: string | null;
  model: string | null;
  status: SuggestionStatus;
  created_at: string;
}

export async function listSuggestions(
  status: SuggestionStatus = "pending"
): Promise<Suggestion[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_ai_suggestions")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as Suggestion[];
  } catch {
    return [];
  }
}

/**
 * The single entry point for a proposal — used by the admin "draft a
 * suggestion" form today, and exactly the row shape a future model /
 * batch job inserts. It can ONLY create a pending row.
 */
export async function createSuggestion(input: {
  entityType: "protocol" | "behavior";
  entityId: string;
  proposed: Record<string, unknown>;
  rationale: string;
  model?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  try {
    const { error } = await sb.from("cms_ai_suggestions").insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      proposed: input.proposed,
      rationale: input.rationale,
      model: input.model ?? "manual",
      status: "pending",
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Failed.",
    };
  }
}

async function setStatus(
  sb: SB,
  id: string,
  status: SuggestionStatus
): Promise<boolean> {
  const uid = await getUserId();
  const { error } = await sb
    .from("cms_ai_suggestions")
    .update({ status, reviewed_by: uid })
    .eq("id", id);
  return !error;
}

/**
 * Approve → merge the proposed fields into the target's DRAFT row via
 * the audited authoring path. Never publishes.
 */
export async function approveSuggestion(
  s: Suggestion
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  try {
    const table =
      s.entity_type === "behavior" ? "cms_behaviors" : "cms_protocols";
    const { data: cur, error: cErr } = await sb
      .from(table)
      .select("*")
      .eq("id", s.entity_id)
      .maybeSingle();
    if (cErr || !cur)
      return { ok: false, reason: "Target no longer exists." };
    const merged = { ...cur, ...s.proposed, id: s.entity_id };
    const res =
      s.entity_type === "behavior"
        ? await saveBehavior(merged)
        : await saveProtocol(merged);
    if (!res.ok) return res;
    await setStatus(sb, s.id, "approved");
    try {
      await sb.from("cms_audit_log").insert({
        entity_type: s.entity_type,
        entity_id: s.entity_id,
        action: "approve suggestion",
        diff: s.proposed,
        author: uid,
      });
    } catch {
      /* audit best-effort */
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Approve failed.",
    };
  }
}

export async function rejectSuggestion(
  id: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const ok = await setStatus(sb, id, "rejected");
    return ok ? { ok: true } : { ok: false, reason: "Reject failed." };
  } catch {
    return { ok: false, reason: "Reject failed." };
  }
}
