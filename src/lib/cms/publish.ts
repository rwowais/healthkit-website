/**
 * publish.ts — the human-only publish / version / rollback pipeline,
 * plus the hybrid runtime refresh.
 *
 * Publishing snapshots the current effective catalog into an immutable,
 * versioned, checksummed `cms_publications` row. Rollback never deletes —
 * it re-publishes a prior bundle as a new version, so history is intact
 * and auditable. The live app, when online, refreshes to the newest
 * published bundle; otherwise the built-in default stands.
 */
import { getSupabase, getUserId } from "../supabase";
import {
  activePacks,
  activeConfig,
  applyPublishedBundle,
  bundleChecksum,
  BUNDLE_SCHEMA,
  type KnowledgeBundle,
} from "../knowledge";
import { assembleBundleFromCMS } from "./authoring";

const PUB_TABLE = "cms_publications";

export interface Publication {
  version: number;
  checksum: string;
  note: string | null;
  createdAt: string;
}

/** Snapshot the current effective knowledge into a bundle at `version`. */
export function buildCatalogBundle(version: number): KnowledgeBundle {
  return {
    schema: BUNDLE_SCHEMA,
    version,
    generatedAt: new Date().toISOString(),
    protocols: activePacks(),
    config: activeConfig(),
  };
}

export async function listPublications(): Promise<Publication[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from(PUB_TABLE)
      .select("bundle_version, checksum, note, created_at")
      .order("bundle_version", { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []).map((r) => ({
      version: r.bundle_version as number,
      checksum: r.checksum as string,
      note: (r.note as string) ?? null,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

async function latest(): Promise<{
  version: number;
  bundle: KnowledgeBundle;
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from(PUB_TABLE)
      .select("bundle_version, bundle")
      .order("bundle_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      version: data.bundle_version as number,
      bundle: data.bundle as KnowledgeBundle,
    };
  } catch {
    return null;
  }
}

async function audit(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  action: string,
  entityId: string
) {
  const uid = await getUserId();
  try {
    await sb.from("cms_audit_log").insert({
      entity_type: "bundle",
      entity_id: entityId,
      action,
      author: uid,
    });
  } catch {
    /* audit is best-effort, never blocks a publish */
  }
}

export type PublishResult =
  | { ok: true; version: number; checksum: string }
  | { ok: false; reason: string };

/** Publish the current effective catalog as the next immutable version. */
export async function publishBundle(
  note: string
): Promise<PublishResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  const cur = await latest();
  const version = (cur?.version ?? 0) + 1;
  // Assemble from the CMS authoring tables when seeded; otherwise the
  // built-in catalog (so publish still works pre-seed, byte-identical).
  const cmsPacks = await assembleBundleFromCMS();
  const bundle: KnowledgeBundle = cmsPacks
    ? {
        schema: BUNDLE_SCHEMA,
        version,
        generatedAt: new Date().toISOString(),
        protocols: cmsPacks,
        config: activeConfig(),
      }
    : buildCatalogBundle(version);
  const checksum = bundleChecksum(bundle);
  if (cur && bundleChecksum(cur.bundle) === checksum)
    return {
      ok: false,
      reason: "No changes since the last published bundle.",
    };
  try {
    const { error } = await sb.from(PUB_TABLE).insert({
      bundle_version: version,
      bundle,
      checksum,
      note: note || null,
      created_by: uid,
    });
    if (error) return { ok: false, reason: error.message };
    await audit(sb, "publish", String(version));
    return { ok: true, version, checksum };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Publish failed.",
    };
  }
}

/** Re-publish a prior version as a NEW version (immutable history). */
export async function rollbackTo(
  version: number
): Promise<PublishResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "Cloud not configured." };
  const uid = await getUserId();
  if (!uid) return { ok: false, reason: "Sign in required." };
  try {
    const { data: src } = await sb
      .from(PUB_TABLE)
      .select("bundle")
      .eq("bundle_version", version)
      .maybeSingle();
    if (!src?.bundle)
      return { ok: false, reason: `Version ${version} not found.` };
    const cur = await latest();
    const nextV = (cur?.version ?? 0) + 1;
    const bundle = {
      ...(src.bundle as KnowledgeBundle),
      version: nextV,
      generatedAt: new Date().toISOString(),
    };
    const checksum = bundleChecksum(bundle);
    const { error } = await sb.from(PUB_TABLE).insert({
      bundle_version: nextV,
      bundle,
      checksum,
      note: `Rollback to v${version}`,
      created_by: uid,
    });
    if (error) return { ok: false, reason: error.message };
    await audit(sb, "rollback", `${nextV}<-${version}`);
    return { ok: true, version: nextV, checksum };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Rollback failed.",
    };
  }
}

// ── Hybrid runtime refresh (best-effort, once per session) ────────────
let refreshed = false;

export async function fetchAndApplyPublished(): Promise<boolean> {
  if (refreshed) return false;
  refreshed = true;
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const cur = await latest();
    if (!cur) return false;
    // Integrity: only apply if the stored checksum matches the content.
    const { data } = await sb
      .from(PUB_TABLE)
      .select("checksum")
      .eq("bundle_version", cur.version)
      .maybeSingle();
    if (
      data?.checksum &&
      bundleChecksum(cur.bundle) !== data.checksum
    )
      return false;
    return applyPublishedBundle(cur.bundle);
  } catch {
    return false;
  }
}

/** Allow a fresh attempt (e.g. after sign-in). */
export function resetRefresh(): void {
  refreshed = false;
}
