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
  version: number;
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

/**
 * Reconstruct the runtime catalog from the CMS tables. Returns null when
 * the CMS is unseeded so Publish safely falls back to the built-in.
 */
export async function assembleBundleFromCMS(): Promise<
  ProtocolPack[] | null
> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: prot } = await sb
      .from("cms_protocols")
      .select("*")
      .neq("status", "archived");
    if (!prot || prot.length === 0) return null;
    const out: ProtocolPack[] = [];
    for (const p of prot as CmsProtocol[]) {
      const behaviors = (await getProtocolBehaviors(p.id))
        .filter((b) => b.status !== "archived")
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
      out.push({
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
    return out;
  } catch {
    return null;
  }
}
