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
import type { ProtocolPack } from "../types";
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

/**
 * Assemble the bundle that WOULD be published right now, without
 * writing anything. Mirrors publishBundle's branch (CMS-when-seeded
 * else built-in) so the diff preview is a faithful preview.
 */
export async function previewNextBundle(): Promise<KnowledgeBundle> {
  const cmsPacks = await assembleBundleFromCMS();
  const version = 0; // placeholder — checksum doesn't include version
  return cmsPacks
    ? {
        schema: BUNDLE_SCHEMA,
        version,
        generatedAt: new Date().toISOString(),
        protocols: cmsPacks,
        config: activeConfig(),
      }
    : buildCatalogBundle(version);
}

/** Fetch the latest published bundle (or null if none / no cloud). */
export async function getLatestPublishedBundle(): Promise<KnowledgeBundle | null> {
  const r = await latest();
  return r?.bundle ?? null;
}

// ── Pure bundle diff (testable, no I/O) ─────────────────────────────
export interface BehaviorDiffRef {
  protocolId: string;
  protocolName: string;
  canonicalKey: string;
  title: string;
}
export interface BehaviorChange extends BehaviorDiffRef {
  fields: string[]; // names of fields whose values differ
}
export interface BundleDiff {
  protocolsAdded: { id: string; name: string }[];
  protocolsRemoved: { id: string; name: string }[];
  protocolsChanged: { id: string; name: string; fields: string[] }[];
  behaviorsAdded: BehaviorDiffRef[];
  behaviorsRemoved: BehaviorDiffRef[];
  behaviorsChanged: BehaviorChange[];
  unchanged: number;
  hasChanges: boolean;
}

const BEHAVIOR_FIELDS: (keyof ProtocolPack["behaviors"][number])[] = [
  "title",
  "block",
  "anchor",
  "offsetMin",
  "dose",
  "rationale",
  "leverage",
  "kind",
  "icon",
];

const PROTOCOL_FIELDS: (keyof ProtocolPack)[] = [
  "name",
  "tagline",
  "goal",
  "accent",
  "icon",
  "source",
];

function fieldsDiffer<T>(a: T, b: T, keys: (keyof T)[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const av = a[k] ?? null;
    const bv = b[k] ?? null;
    if (JSON.stringify(av) !== JSON.stringify(bv)) out.push(String(k));
  }
  return out;
}

/**
 * Compute a per-behavior diff between two bundles. Pure — no I/O. Used
 * by the Publish tab so an admin can see exactly what's about to ship
 * before clicking the irreversible button.
 */
export function diffBundles(
  prev: KnowledgeBundle | null,
  next: KnowledgeBundle
): BundleDiff {
  const prevPacks = prev?.protocols ?? [];
  const nextPacks = next.protocols ?? [];
  const prevById = new Map(prevPacks.map((p) => [p.id, p]));
  const nextById = new Map(nextPacks.map((p) => [p.id, p]));

  const protocolsAdded: BundleDiff["protocolsAdded"] = [];
  const protocolsRemoved: BundleDiff["protocolsRemoved"] = [];
  const protocolsChanged: BundleDiff["protocolsChanged"] = [];
  const behaviorsAdded: BehaviorDiffRef[] = [];
  const behaviorsRemoved: BehaviorDiffRef[] = [];
  const behaviorsChanged: BehaviorChange[] = [];
  let unchanged = 0;

  for (const np of nextPacks) {
    const pp = prevById.get(np.id);
    if (!pp) {
      protocolsAdded.push({ id: np.id, name: np.name });
      for (const b of np.behaviors)
        behaviorsAdded.push({
          protocolId: np.id,
          protocolName: np.name,
          canonicalKey: b.canonicalKey,
          title: b.title,
        });
      continue;
    }
    const pFields = fieldsDiffer(pp, np, PROTOCOL_FIELDS);
    if (pFields.length)
      protocolsChanged.push({ id: np.id, name: np.name, fields: pFields });
    const ppBs = new Map(pp.behaviors.map((b) => [b.canonicalKey, b]));
    const npBs = new Map(np.behaviors.map((b) => [b.canonicalKey, b]));
    for (const [k, nb] of npBs) {
      const pb = ppBs.get(k);
      if (!pb) {
        behaviorsAdded.push({
          protocolId: np.id,
          protocolName: np.name,
          canonicalKey: k,
          title: nb.title,
        });
        continue;
      }
      const fields = fieldsDiffer(pb, nb, BEHAVIOR_FIELDS);
      if (fields.length)
        behaviorsChanged.push({
          protocolId: np.id,
          protocolName: np.name,
          canonicalKey: k,
          title: nb.title,
          fields,
        });
      else unchanged++;
    }
    for (const [k, pb] of ppBs) {
      if (!npBs.has(k))
        behaviorsRemoved.push({
          protocolId: np.id,
          protocolName: np.name,
          canonicalKey: k,
          title: pb.title,
        });
    }
  }
  for (const pp of prevPacks) {
    if (!nextById.has(pp.id)) {
      protocolsRemoved.push({ id: pp.id, name: pp.name });
      for (const b of pp.behaviors)
        behaviorsRemoved.push({
          protocolId: pp.id,
          protocolName: pp.name,
          canonicalKey: b.canonicalKey,
          title: b.title,
        });
    }
  }

  const hasChanges =
    protocolsAdded.length +
      protocolsRemoved.length +
      protocolsChanged.length +
      behaviorsAdded.length +
      behaviorsRemoved.length +
      behaviorsChanged.length >
    0;

  return {
    protocolsAdded,
    protocolsRemoved,
    protocolsChanged,
    behaviorsAdded,
    behaviorsRemoved,
    behaviorsChanged,
    unchanged,
    hasChanges,
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
