/**
 * authoring.ts — relational read/write for the CMS protocols & behaviors.
 *
 * Behaviors are global (one row per canonical_key — the merge identity);
 * protocols link them via cms_protocol_behaviors with ordering. Editing
 * here changes NOTHING for users until an admin Publishes a bundle —
 * the runtime serves the built-in catalog until then.
 */
import { getSupabase, getUserId } from "../supabase";
import { activePacks } from "../knowledge";
import type { ProtocolPack, BehaviorDef, TimeBlock } from "../types";

type SB = NonNullable<ReturnType<typeof getSupabase>>;

export interface CmsProtocol {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  goal: string | null;
  accent: string | null;
  icon: string | null;
  source: string;
  status: string;
  version: number;
}
export interface CmsBehavior {
  id: string;
  canonical_key: string;
  title: string;
  block: string;
  anchor: string | null;
  offset_min: number;
  dose: string | null;
  leverage: number;
  kind: string;
  icon: string | null;
  rationale: string | null;
  status: string;
  /** AI-drafted rows carry this true; a human must clear it (Mark
   *  verified) before the row can ever reach a published bundle. */
  ai_unverified: boolean;
  version: number;
}

/**
 * THE publish gate for a behavior. Pure so the governance guarantee is
 * unit-tested directly: archived rows AND any still-unverified AI draft
 * are excluded from every assembled bundle — they can never reach users
 * even if accidentally marked 'published'.
 */
export function isPublishableBehavior(b: {
  status?: string | null;
  ai_unverified?: boolean | null;
}): boolean {
  return b.status !== "archived" && b.ai_unverified !== true;
}

async function rev(
  sb: SB,
  entityType: string,
  entityId: string,
  version: number,
  snapshot: unknown,
  note: string
) {
  const uid = await getUserId();
  try {
    await sb
      .from("cms_revisions")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        version,
        snapshot,
        change_note: note,
        author: uid,
      });
    await sb.from("cms_audit_log").insert({
      entity_type: entityType,
      entity_id: entityId,
      action: note,
      author: uid,
    });
  } catch {
    /* history is best-effort, never blocks an edit */
  }
}

/** Idempotent mirror of the built-in catalog into the CMS tables. */
export async function importBuiltin(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  try {
    const packs = activePacks();
    // 1. behaviors (global, by canonical_key)
    const behaviorRows = new Map<string, Record<string, unknown>>();
    for (const p of packs)
      for (const b of p.behaviors)
        behaviorRows.set(b.canonicalKey, {
          canonical_key: b.canonicalKey,
          title: b.title,
          block: b.block,
          anchor: b.anchor ?? null,
          offset_min: b.offsetMin ?? 0,
          dose: b.dose ?? null,
          leverage: b.leverage ?? 2,
          kind: b.kind ?? "action",
          icon: b.icon ?? null,
          rationale: b.rationale ?? null,
          status: "published",
          // ai_unverified intentionally omitted — the column defaults to
          // false, so seeding stays decoupled from the migration and
          // built-ins are never flagged as AI-drafted.
        });
    const { data: bRows, error: bErr } = await sb
      .from("cms_behaviors")
      .upsert([...behaviorRows.values()], {
        onConflict: "canonical_key",
      })
      .select("id, canonical_key");
    if (bErr) return { ok: false, reason: bErr.message };
    const bId = new Map(
      (bRows ?? []).map((r) => [r.canonical_key as string, r.id as string])
    );
    // 2. protocols (by slug = built-in pack id)
    const { data: pRows, error: pErr } = await sb
      .from("cms_protocols")
      .upsert(
        packs.map((p) => ({
          slug: p.id,
          name: p.name,
          tagline: p.tagline ?? null,
          goal: p.goal ?? null,
          accent: p.accent ?? null,
          icon: p.icon ?? null,
          source: p.source ?? "official",
          status: "published",
        })),
        { onConflict: "slug" }
      )
      .select("id, slug");
    if (pErr) return { ok: false, reason: pErr.message };
    const pId = new Map(
      (pRows ?? []).map((r) => [r.slug as string, r.id as string])
    );
    // 3. links
    const links: Record<string, unknown>[] = [];
    for (const p of packs)
      p.behaviors.forEach((b, i) => {
        const pi = pId.get(p.id);
        const bi = bId.get(b.canonicalKey);
        if (pi && bi)
          links.push({ protocol_id: pi, behavior_id: bi, position: i });
      });
    if (links.length) {
      const { error: lErr } = await sb
        .from("cms_protocol_behaviors")
        .upsert(links, { onConflict: "protocol_id,behavior_id" });
      if (lErr) return { ok: false, reason: lErr.message };
    }
    await rev(sb, "catalog", "import", 1, { packs: packs.length }, "seed");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Import failed.",
    };
  }
}

export async function listCmsProtocols(): Promise<CmsProtocol[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_protocols")
      .select("*")
      .order("name");
    return (data ?? []) as CmsProtocol[];
  } catch {
    return [];
  }
}

/** Generate a URL-safe slug from a name, with a tiny suffix for uniqueness. */
function slugifyWithSuffix(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${base || "protocol"}-${Date.now().toString(36).slice(-4)}`;
}

/** Create a brand-new protocol shell. Returns the new id. */
export async function createProtocol(fields: {
  name: string;
  tagline?: string;
  goal?: string;
  accent?: string;
  icon?: string;
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  if (!fields.name.trim())
    return { ok: false, reason: "Name required." };
  try {
    const slug = slugifyWithSuffix(fields.name);
    const { data, error } = await sb
      .from("cms_protocols")
      .insert({
        slug,
        name: fields.name.trim(),
        tagline: fields.tagline?.trim() || null,
        goal: fields.goal?.trim() || null,
        accent: fields.accent?.trim() || "var(--readiness)",
        icon: fields.icon ?? "sparkle",
        source: "custom",
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, reason: error?.message ?? "Create failed." };
    await rev(
      sb,
      "protocol",
      data.id as string,
      1,
      { slug, ...fields },
      "create protocol"
    );
    return { ok: true, id: data.id as string };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Create failed.",
    };
  }
}

/** Fetch a single behavior row by id (used by AI Review to diff). */
export async function getBehaviorById(
  id: string
): Promise<CmsBehavior | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("cms_behaviors")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as CmsBehavior) ?? null;
  } catch {
    return null;
  }
}

/** Read the last N revisions of a single entity (behavior, protocol…). */
export interface RevisionRow {
  id: number;
  version: number;
  change_note: string | null;
  author: string | null;
  created_at: string;
  snapshot: unknown;
}
export async function listRevisions(
  entityType: string,
  entityId: string,
  limit = 10
): Promise<RevisionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_revisions")
      .select("id, version, change_note, author, created_at, snapshot")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("version", { ascending: false })
      .limit(limit);
    return (data ?? []) as RevisionRow[];
  } catch {
    return [];
  }
}

// ── Evidence rail ───────────────────────────────────────────────────
export interface EvidenceRow {
  id: string;
  target_type: string;
  target_ref: string;
  tier: string;
  source_label: string | null;
  url: string | null;
  summary: string | null;
}
export async function listEvidence(
  targetType: string,
  targetRef: string
): Promise<EvidenceRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_evidence")
      .select("id, target_type, target_ref, tier, source_label, url, summary")
      .eq("target_type", targetType)
      .eq("target_ref", targetRef)
      .order("id");
    return (data ?? []) as EvidenceRow[];
  } catch {
    return [];
  }
}
/**
 * Upsert-by-target: at most one evidence row per (target_type,
 * target_ref). Find-then-(update|insert) so no schema constraint is
 * required and existing data stays clean.
 */
export async function upsertEvidence(input: {
  targetType: string;
  targetRef: string;
  tier: string;
  sourceLabel?: string;
  url?: string | null;
  summary?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { data: existing } = await sb
      .from("cms_evidence")
      .select("id")
      .eq("target_type", input.targetType)
      .eq("target_ref", input.targetRef)
      .maybeSingle();
    const row = {
      target_type: input.targetType,
      target_ref: input.targetRef,
      tier: input.tier,
      source_label: input.sourceLabel ?? null,
      url: input.url ?? null,
      summary: input.summary ?? null,
    };
    const { error } = existing?.id
      ? await sb.from("cms_evidence").update(row).eq("id", existing.id)
      : await sb.from("cms_evidence").insert(row);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

// ── Explanation rail (why / timing copy) ────────────────────────────
export interface ExplanationRow {
  id: string;
  target_type: string;
  target_ref: string;
  kind: string;
  text: string;
  status: string;
}
export async function listExplanations(
  targetType: string,
  targetRef: string
): Promise<ExplanationRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_explanations")
      .select("id, target_type, target_ref, kind, text, status")
      .eq("target_type", targetType)
      .eq("target_ref", targetRef)
      .order("kind");
    return (data ?? []) as ExplanationRow[];
  } catch {
    return [];
  }
}
// ── Admin allowlist ─────────────────────────────────────────────────
export interface AdminRow {
  user_id: string;
  added_at: string;
}
export async function listAdmins(): Promise<AdminRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_admins")
      .select("user_id, added_at")
      .order("added_at");
    return (data ?? []) as AdminRow[];
  } catch {
    return [];
  }
}
export async function addAdmin(
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const id = userId.trim();
  // Loose uuid check — Supabase will reject otherwise; this gives a
  // nicer error than a Postgres syntax message.
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { ok: false, reason: "User id must be a uuid." };
  try {
    const { error } = await sb.from("cms_admins").insert({ user_id: id });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Add failed.",
    };
  }
}
export async function removeAdmin(
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  // Lockout guard: never let an admin remove themselves from the UI;
  // they'd lose access immediately and need SQL to recover.
  const me = await getUserId();
  if (me && me === userId)
    return {
      ok: false,
      reason: "Refusing to remove yourself — you'd be locked out.",
    };
  try {
    const { error } = await sb
      .from("cms_admins")
      .delete()
      .eq("user_id", userId);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Remove failed.",
    };
  }
}

// ── Audit log (read-only) ───────────────────────────────────────────
export interface AuditRow {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  diff: unknown;
  author: string | null;
  created_at: string;
}
export async function listAuditLog(limit = 30): Promise<AuditRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_audit_log")
      .select(
        "id, entity_type, entity_id, action, diff, author, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as AuditRow[];
  } catch {
    return [];
  }
}

// ── Intelligence config (key/value, runtime adoption pending) ───────
export interface ConfigOverrideRow {
  key: string;
  value: unknown;
  description: string | null;
}
export async function listConfigOverrides(): Promise<ConfigOverrideRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_intelligence_config")
      .select("key, value, description")
      .order("key");
    return (data ?? []) as ConfigOverrideRow[];
  } catch {
    return [];
  }
}
export async function upsertConfigOverride(input: {
  key: string;
  value: unknown;
  description?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  if (!input.key.trim()) return { ok: false, reason: "Key required." };
  try {
    const row = {
      key: input.key.trim(),
      value: input.value,
      description: input.description?.trim() || null,
    };
    const { error } = await sb
      .from("cms_intelligence_config")
      .upsert(row, { onConflict: "key" });
    if (error) return { ok: false, reason: error.message };
    await rev(
      sb,
      "config",
      input.key.trim(),
      1,
      row,
      "upsert config override"
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}
export async function deleteConfigOverride(
  key: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { error } = await sb
      .from("cms_intelligence_config")
      .delete()
      .eq("key", key);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Delete failed.",
    };
  }
}

// ── Insight templates (runtime adoption pending) ───────────────────
export interface InsightTemplateRow {
  id: string;
  kind: string;
  template: string;
  conditions: unknown;
  status: string;
  version: number;
}
export async function listInsightTemplates(): Promise<
  InsightTemplateRow[]
> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_insight_templates")
      .select("id, kind, template, conditions, status, version")
      .order("kind");
    return (data ?? []) as InsightTemplateRow[];
  } catch {
    return [];
  }
}
export async function saveInsightTemplate(
  t: Partial<InsightTemplateRow> & {
    kind: string;
    template: string;
  }
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  if (!t.kind.trim() || !t.template.trim())
    return { ok: false, reason: "Kind + template required." };
  try {
    const row = {
      kind: t.kind.trim(),
      template: t.template,
      conditions: t.conditions ?? {},
      status: t.status ?? "draft",
      version: ((t.version as number | undefined) ?? 0) + 1,
    };
    const { error } = t.id
      ? await sb
          .from("cms_insight_templates")
          .update(row)
          .eq("id", t.id)
      : await sb.from("cms_insight_templates").insert(row);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}
export async function deleteInsightTemplate(
  id: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { error } = await sb
      .from("cms_insight_templates")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Delete failed.",
    };
  }
}

// ── Adaptation rules (Wave D-3: runtime adopts via adapt()) ────────
export interface AdaptationRuleRow {
  id: string;
  name: string;
  priority: number;
  trigger: unknown;
  effect: unknown;
  status: string;
  version: number;
}
export async function listAdaptationRules(): Promise<AdaptationRuleRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_adaptation_rules")
      .select("id, name, priority, trigger, effect, status, version")
      .order("priority");
    return (data ?? []) as AdaptationRuleRow[];
  } catch {
    return [];
  }
}
export async function saveAdaptationRule(
  r: Partial<AdaptationRuleRow> & {
    name: string;
    priority: number;
    trigger: unknown;
    effect: unknown;
  }
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  if (!r.name.trim())
    return { ok: false, reason: "Name required." };
  try {
    const row = {
      name: r.name.trim(),
      priority: r.priority,
      trigger: r.trigger ?? {},
      effect: r.effect ?? {},
      status: r.status ?? "draft",
      version: ((r.version as number | undefined) ?? 0) + 1,
    };
    const { error } = r.id
      ? await sb
          .from("cms_adaptation_rules")
          .update(row)
          .eq("id", r.id)
      : await sb.from("cms_adaptation_rules").insert(row);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}
export async function deleteAdaptationRule(
  id: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { error } = await sb
      .from("cms_adaptation_rules")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Delete failed.",
    };
  }
}

// ── Recommendation templates (runtime adoption pending) ────────────
export interface RecTemplateRow {
  id: string;
  context: string;
  copy: string;
  variables: unknown;
  status: string;
}
export async function listRecTemplates(): Promise<RecTemplateRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_recommendation_templates")
      .select("id, context, copy, variables, status")
      .order("context");
    return (data ?? []) as RecTemplateRow[];
  } catch {
    return [];
  }
}
export async function saveRecTemplate(
  t: Partial<RecTemplateRow> & { context: string; copy: string }
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  if (!t.context.trim() || !t.copy.trim())
    return { ok: false, reason: "Context + copy required." };
  try {
    const row = {
      context: t.context.trim(),
      copy: t.copy,
      variables: t.variables ?? [],
      status: t.status ?? "draft",
    };
    const { error } = t.id
      ? await sb
          .from("cms_recommendation_templates")
          .update(row)
          .eq("id", t.id)
      : await sb.from("cms_recommendation_templates").insert(row);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}
export async function deleteRecTemplate(
  id: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { error } = await sb
      .from("cms_recommendation_templates")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Delete failed.",
    };
  }
}

/** Upsert-by-(target,kind): one explanation per (target, kind). */
export async function upsertExplanation(input: {
  targetType: string;
  targetRef: string;
  kind: string; // 'why' | 'timing' | 'rationale'
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { data: existing } = await sb
      .from("cms_explanations")
      .select("id")
      .eq("target_type", input.targetType)
      .eq("target_ref", input.targetRef)
      .eq("kind", input.kind)
      .maybeSingle();
    const row = {
      target_type: input.targetType,
      target_ref: input.targetRef,
      kind: input.kind,
      text: input.text,
      status: "draft",
    };
    const { error } = existing?.id
      ? await sb.from("cms_explanations").update(row).eq("id", existing.id)
      : await sb.from("cms_explanations").insert(row);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function getProtocolBehaviors(
  protocolId: string
): Promise<CmsBehavior[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("cms_protocol_behaviors")
      .select("position, cms_behaviors(*)")
      .eq("protocol_id", protocolId)
      .order("position");
    return (data ?? [])
      .map(
        (r) =>
          (r as unknown as { cms_behaviors: CmsBehavior }).cms_behaviors
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveProtocol(
  p: Partial<CmsProtocol> & { id: string }
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const next = (p.version ?? 1) + 1;
    const { error } = await sb
      .from("cms_protocols")
      .update({
        name: p.name,
        tagline: p.tagline,
        goal: p.goal,
        accent: p.accent,
        icon: p.icon,
        source: p.source,
        status: p.status,
        version: next,
      })
      .eq("id", p.id);
    if (error) return { ok: false, reason: error.message };
    await rev(sb, "protocol", p.id, next, p, "edit protocol");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function saveBehavior(
  b: Partial<CmsBehavior> & { id: string }
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const next = (b.version ?? 1) + 1;
    const { error } = await sb
      .from("cms_behaviors")
      .update({
        title: b.title,
        block: b.block,
        anchor: b.anchor,
        offset_min: b.offset_min,
        dose: b.dose,
        leverage: b.leverage,
        kind: b.kind,
        icon: b.icon,
        rationale: b.rationale,
        status: b.status,
        version: next,
      })
      .eq("id", b.id);
    if (error) return { ok: false, reason: error.message };
    await rev(sb, "behavior", b.id, next, b, "edit behavior");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export interface NewBehaviorFields {
  title: string;
  block: string;
  leverage: number;
  dose?: string | null;
  rationale?: string;
  anchor?: string;
  offsetMin?: number;
  kind?: string;
  icon?: string;
  /** Set true for AI-drafted rows — gates them out of publish until a
   *  human clears it. */
  aiUnverified?: boolean;
  /** Optional starter evidence row (tier is already capped upstream). */
  evidence?: {
    tier: string;
    sourceLabel?: string;
    url?: string | null;
    summary?: string;
  };
  /** Optional why/timing explanation rows. */
  explanation?: { why?: string; timing?: string };
}

/**
 * Create a brand-new behavior and link it to a protocol at the end.
 * Accepts the full field set (used by the AI drafter) while staying
 * backward-compatible with the minimal manual "Add behavior" form.
 * Evidence + explanation are persisted as draft rows, best-effort.
 */
export async function createBehavior(
  protocolId: string,
  fields: NewBehaviorFields
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  if (!fields.title.trim())
    return { ok: false, reason: "Title required." };
  try {
    const key =
      fields.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) +
      "-" +
      Date.now().toString(36).slice(-4);
    const row: Record<string, unknown> = {
      canonical_key: key,
      title: fields.title.trim(),
      block: fields.block,
      anchor:
        fields.anchor ?? (fields.block === "evening" ? "bed" : "wake"),
      offset_min: fields.offsetMin ?? 0,
      dose: fields.dose ?? null,
      leverage: fields.leverage,
      kind: fields.kind ?? "action",
      icon: fields.icon ?? "sparkle",
      rationale: fields.rationale ?? "Custom behavior.",
      status: "draft", // never anything else on create
    };
    // Only write the flag when it must be TRUE (the AI path). Omitting
    // it on the manual path lets the column default (false) apply, so
    // manual adds work even before the ai_unverified migration is run.
    if (fields.aiUnverified === true) row.ai_unverified = true;
    const { data: b, error: bErr } = await sb
      .from("cms_behaviors")
      .insert(row)
      .select("id")
      .single();
    if (bErr || !b) return { ok: false, reason: bErr?.message };
    const { count } = await sb
      .from("cms_protocol_behaviors")
      .select("*", { count: "exact", head: true })
      .eq("protocol_id", protocolId);
    const { error: lErr } = await sb
      .from("cms_protocol_behaviors")
      .insert({
        protocol_id: protocolId,
        behavior_id: b.id,
        position: count ?? 0,
      });
    if (lErr) return { ok: false, reason: lErr.message };

    // Evidence + explanation as draft rows — best-effort, never blocks.
    try {
      if (fields.evidence?.tier) {
        await sb.from("cms_evidence").insert({
          target_type: "behavior",
          target_ref: key,
          tier: fields.evidence.tier,
          source_label: fields.evidence.sourceLabel ?? null,
          url: fields.evidence.url ?? null,
          summary: fields.evidence.summary ?? null,
        });
      }
      const ex = fields.explanation;
      const exRows = [
        ex?.why && { kind: "why", text: ex.why },
        ex?.timing && { kind: "timing", text: ex.timing },
      ].filter(Boolean) as { kind: string; text: string }[];
      if (exRows.length)
        await sb.from("cms_explanations").insert(
          exRows.map((r) => ({
            target_type: "behavior",
            target_ref: key,
            kind: r.kind,
            text: r.text,
            status: "draft",
          }))
        );
    } catch {
      /* evidence/explanation are enrichment, never block creation */
    }

    await rev(
      sb,
      "behavior",
      b.id as string,
      1,
      { key, ...fields },
      fields.aiUnverified ? "create behavior (AI draft)" : "create behavior"
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Create failed.",
    };
  }
}

/**
 * Clear the AI-unverified flag after a human has checked the draft
 * against its source. Versioned + audited. Only after this can the
 * behavior be included in a published bundle.
 */
export async function clearUnverified(
  behaviorId: string,
  version: number
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  try {
    const next = (version ?? 1) + 1;
    const { error } = await sb
      .from("cms_behaviors")
      .update({ ai_unverified: false, version: next })
      .eq("id", behaviorId);
    if (error) return { ok: false, reason: error.message };
    await rev(
      sb,
      "behavior",
      behaviorId,
      next,
      { ai_unverified: false },
      "mark verified"
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Failed.",
    };
  }
}

/** Move a behavior one slot up/down within a protocol (swap positions). */
export async function reorderBehavior(
  protocolId: string,
  behaviorId: string,
  dir: -1 | 1
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  try {
    const { data } = await sb
      .from("cms_protocol_behaviors")
      .select("behavior_id, position")
      .eq("protocol_id", protocolId)
      .order("position");
    const rows = (data ?? []) as {
      behavior_id: string;
      position: number;
    }[];
    const i = rows.findIndex((r) => r.behavior_id === behaviorId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length)
      return { ok: false, reason: "Out of range." };
    const a = rows[i];
    const b = rows[j];
    await sb
      .from("cms_protocol_behaviors")
      .update({ position: b.position })
      .eq("protocol_id", protocolId)
      .eq("behavior_id", a.behavior_id);
    await sb
      .from("cms_protocol_behaviors")
      .update({ position: a.position })
      .eq("protocol_id", protocolId)
      .eq("behavior_id", b.behavior_id);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Reorder failed.",
    };
  }
}

/**
 * Reconstruct the runtime catalog from the CMS tables. Returns null when
 * the CMS is unseeded so Publish safely falls back to the built-in.
 */
export interface AssembledBundle {
  protocols: ProtocolPack[];
  config: Record<string, number | string | boolean>;
  insightTemplates: {
    kind: string;
    template: string;
    conditions?: unknown;
  }[];
  adaptationRules: {
    name: string;
    priority: number;
    trigger: unknown;
    effect: unknown;
  }[];
}

export async function assembleBundleFromCMS(): Promise<AssembledBundle | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: prot } = await sb
      .from("cms_protocols")
      .select("*")
      .neq("status", "archived");
    if (!prot || prot.length === 0) return null;
    const protocols: ProtocolPack[] = [];
    for (const p of prot as CmsProtocol[]) {
      const behaviors = (await getProtocolBehaviors(p.id))
        .filter(isPublishableBehavior)
        .map(
          (b): BehaviorDef =>
            ({
              canonicalKey: b.canonical_key,
              title: b.title,
              block: b.block as TimeBlock,
              anchor: (b.anchor ?? "wake") as BehaviorDef["anchor"],
              offsetMin: b.offset_min ?? 0,
              dose: b.dose ?? undefined,
              leverage: (b.leverage ?? 2) as BehaviorDef["leverage"],
              kind: (b.kind ?? "action") as BehaviorDef["kind"],
              icon: (b.icon ?? "sparkle") as BehaviorDef["icon"],
              rationale: b.rationale ?? "",
            }) as BehaviorDef
        );
      protocols.push({
        id: p.slug,
        name: p.name,
        tagline: p.tagline ?? "",
        goal: p.goal ?? "custom",
        accent: p.accent ?? "var(--readiness)",
        icon: (p.icon ?? "sparkle") as ProtocolPack["icon"],
        source: (p.source ?? "official") as ProtocolPack["source"],
        durationLabel: "Ongoing",
        behaviors,
      } as ProtocolPack);
    }

    // Config overrides from cms_intelligence_config — only numeric /
    // string / boolean values are honored (bundle.config's contract).
    // Objects/arrays would also typecheck as jsonb but are skipped here
    // so the bundle stays a flat dictionary of scalar tunables.
    const config: Record<string, number | string | boolean> = {};
    try {
      const { data: cfgRows } = await sb
        .from("cms_intelligence_config")
        .select("key, value");
      for (const row of (cfgRows ?? []) as {
        key: string;
        value: unknown;
      }[]) {
        const v = row.value;
        if (
          typeof v === "number" ||
          typeof v === "string" ||
          typeof v === "boolean"
        )
          config[row.key] = v;
      }
    } catch {
      /* config is enrichment; assembly continues without it */
    }

    // Insight templates — only "published" status rows flow into the
    // bundle. Drafts stay in the CMS until promoted.
    const insightTemplates: AssembledBundle["insightTemplates"] = [];
    try {
      const { data: tplRows } = await sb
        .from("cms_insight_templates")
        .select("kind, template, conditions, status");
      for (const row of (tplRows ?? []) as {
        kind: string;
        template: string;
        conditions: unknown;
        status: string;
      }[]) {
        if (row.status === "published")
          insightTemplates.push({
            kind: row.kind,
            template: row.template,
            conditions: row.conditions,
          });
      }
    } catch {
      /* templates are enrichment; assembly continues without them */
    }

    // Adaptation rules — only "published" rows; drafts/archived held back.
    const adaptationRules: AssembledBundle["adaptationRules"] = [];
    try {
      const { data: ruleRows } = await sb
        .from("cms_adaptation_rules")
        .select("name, priority, trigger, effect, status")
        .order("priority");
      for (const row of (ruleRows ?? []) as {
        name: string;
        priority: number;
        trigger: unknown;
        effect: unknown;
        status: string;
      }[]) {
        if (row.status === "published")
          adaptationRules.push({
            name: row.name,
            priority: row.priority,
            trigger: row.trigger,
            effect: row.effect,
          });
      }
    } catch {
      /* rules are enrichment; assembly continues without them */
    }

    return { protocols, config, insightTemplates, adaptationRules };
  } catch {
    return null;
  }
}
