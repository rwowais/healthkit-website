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
import type { ProtocolPack, Interaction } from "../types";
import { PACKS } from "../packs";
import { assembleBundleFromCMS } from "./authoring";
import { validateAtom } from "../engine";

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
  const cms = await assembleBundleFromCMS();
  const version = 0; // placeholder — checksum doesn't include version
  if (!cms) return buildCatalogBundle(version);
  // Bundle is a pure function of the CMS tables — no spread of the
  // currently-applied bundle. The CMS rows are the source of truth.
  // (An earlier merge with activeConfig() resurrected deleted overrides
  // whenever a browser session already had a prior bundle loaded —
  // exactly the bug we hit when "delete an override" didn't actually
  // remove it after publish.)
  return {
    schema: BUNDLE_SCHEMA,
    version,
    generatedAt: new Date().toISOString(),
    protocols: cms.protocols,
    config: cms.config,
    insightTemplates: cms.insightTemplates,
    adaptationRules: cms.adaptationRules,
    interactions: cms.interactions,
  };
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
export interface ConfigChange {
  key: string;
  prev: unknown;
  next: unknown;
}
export interface TemplateChange {
  kind: string;
}
export interface RuleChange {
  name: string;
}
export interface InteractionChange {
  /** Human label, e.g. "caffeine ✕ sleep (timing)". */
  label: string;
  /** Full identity (incl. direction + condition) — unique React key. */
  key: string;
  aKey: string;
  bKey: string;
  type: string;
}
export interface BundleDiff {
  protocolsAdded: { id: string; name: string }[];
  protocolsRemoved: { id: string; name: string }[];
  protocolsChanged: { id: string; name: string; fields: string[] }[];
  behaviorsAdded: BehaviorDiffRef[];
  behaviorsRemoved: BehaviorDiffRef[];
  behaviorsChanged: BehaviorChange[];
  configAdded: ConfigChange[];
  configRemoved: ConfigChange[];
  configChanged: ConfigChange[];
  templatesAdded: TemplateChange[];
  templatesRemoved: TemplateChange[];
  templatesChanged: TemplateChange[];
  rulesAdded: RuleChange[];
  rulesRemoved: RuleChange[];
  rulesChanged: RuleChange[];
  interactionsAdded: InteractionChange[];
  interactionsRemoved: InteractionChange[];
  interactionsChanged: InteractionChange[];
  unchanged: number;
  hasChanges: boolean;
}

// P0: extended to cover every field on BehaviorDef that admins can
// edit. Today's commits added evidenceTier, contraindications,
// derivedFrom, targets, evidence, timingReason, recommendedBy —
// any of those changing on a curated atom NEEDS to appear in the
// publish diff so an admin can review the change before shipping.
// Without these, an admin can flip an atom from `evidenceTier:
// "established"` to `"exploratory"` and the diff says "unchanged."
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
  "evidence",
  "evidenceTier",
  "timingReason",
  "recommendedBy",
  "contraindications",
  "derivedFrom",
  "targets",
  "daysActive",
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

  // Config overrides — flat dict; track added / removed / changed.
  const prevCfg = (prev?.config ?? {}) as Record<string, unknown>;
  const nextCfg = (next.config ?? {}) as Record<string, unknown>;
  const configAdded: ConfigChange[] = [];
  const configRemoved: ConfigChange[] = [];
  const configChanged: ConfigChange[] = [];
  const allKeys = new Set([
    ...Object.keys(prevCfg),
    ...Object.keys(nextCfg),
  ]);
  for (const k of allKeys) {
    const inPrev = k in prevCfg;
    const inNext = k in nextCfg;
    if (!inPrev && inNext)
      configAdded.push({ key: k, prev: null, next: nextCfg[k] });
    else if (inPrev && !inNext)
      configRemoved.push({ key: k, prev: prevCfg[k], next: null });
    else if (
      JSON.stringify(prevCfg[k]) !== JSON.stringify(nextCfg[k])
    )
      configChanged.push({
        key: k,
        prev: prevCfg[k],
        next: nextCfg[k],
      });
  }

  // Insight templates — diff by `kind`.
  const prevT = (prev?.insightTemplates ?? []).reduce<
    Record<string, { kind: string; template: string }>
  >((m, t) => {
    m[t.kind] = { kind: t.kind, template: t.template };
    return m;
  }, {});
  const nextT = (next.insightTemplates ?? []).reduce<
    Record<string, { kind: string; template: string }>
  >((m, t) => {
    m[t.kind] = { kind: t.kind, template: t.template };
    return m;
  }, {});
  const templatesAdded: TemplateChange[] = [];
  const templatesRemoved: TemplateChange[] = [];
  const templatesChanged: TemplateChange[] = [];
  const allTKinds = new Set([...Object.keys(prevT), ...Object.keys(nextT)]);
  for (const k of allTKinds) {
    if (!prevT[k]) templatesAdded.push({ kind: k });
    else if (!nextT[k]) templatesRemoved.push({ kind: k });
    else if (prevT[k].template !== nextT[k].template)
      templatesChanged.push({ kind: k });
  }

  // Adaptation rules — diff by `name` (the human handle).
  const prevR = (prev?.adaptationRules ?? []).reduce<
    Record<string, { name: string; sig: string }>
  >((m, r) => {
    m[r.name] = { name: r.name, sig: JSON.stringify(r) };
    return m;
  }, {});
  const nextR = (next.adaptationRules ?? []).reduce<
    Record<string, { name: string; sig: string }>
  >((m, r) => {
    m[r.name] = { name: r.name, sig: JSON.stringify(r) };
    return m;
  }, {});
  const rulesAdded: RuleChange[] = [];
  const rulesRemoved: RuleChange[] = [];
  const rulesChanged: RuleChange[] = [];
  const allRNames = new Set([
    ...Object.keys(prevR),
    ...Object.keys(nextR),
  ]);
  for (const n of allRNames) {
    if (!prevR[n]) rulesAdded.push({ name: n });
    else if (!nextR[n]) rulesRemoved.push({ name: n });
    else if (prevR[n].sig !== nextR[n].sig)
      rulesChanged.push({ name: n });
  }

  // Interactions — identity is the (aKey, bKey, type) triple; any other
  // field changing (nudge, severity, gapHours, evidenceTier, source…) is a
  // "changed". A severity flip (soft↔firm) or a new conflict silently
  // muting a behavior MUST be reviewable before it ships.
  // Identity must include direction + condition: two interactions on the same
  // (aKey,bKey,type) but with different gates/directions are distinct rules,
  // and collapsing them here would hide one from the pre-publish review (and,
  // mirrored in the engine, drop it at runtime).
  const interKey = (i: Interaction) =>
    `${i.aKey}|${i.bKey}|${i.type}|${i.direction ?? "a_to_b"}|${
      i.condition ? JSON.stringify(i.condition) : ""
    }`;
  const interLabel = (i: Interaction) => {
    const verb =
      i.type === "conflict"
        ? "✕"
        : i.type === "synergy"
          ? "+"
          : i.type === "ordering"
            ? "→"
            : "·";
    return `${i.aKey} ${verb} ${i.bKey} (${i.type})`;
  };
  const prevI = (prev?.interactions ?? []).reduce<
    Record<string, { i: Interaction; sig: string }>
  >((m, i) => {
    m[interKey(i)] = { i, sig: JSON.stringify(i) };
    return m;
  }, {});
  const nextI = (next.interactions ?? []).reduce<
    Record<string, { i: Interaction; sig: string }>
  >((m, i) => {
    m[interKey(i)] = { i, sig: JSON.stringify(i) };
    return m;
  }, {});
  const interactionsAdded: InteractionChange[] = [];
  const interactionsRemoved: InteractionChange[] = [];
  const interactionsChanged: InteractionChange[] = [];
  const allIKeys = new Set([...Object.keys(prevI), ...Object.keys(nextI)]);
  for (const k of allIKeys) {
    const p = prevI[k];
    const n = nextI[k];
    const ref = (n ?? p).i;
    const change: InteractionChange = {
      label: interLabel(ref),
      key: k,
      aKey: ref.aKey,
      bKey: ref.bKey,
      type: ref.type,
    };
    if (!p) interactionsAdded.push(change);
    else if (!n) interactionsRemoved.push(change);
    else if (p.sig !== n.sig) interactionsChanged.push(change);
  }

  const hasChanges =
    protocolsAdded.length +
      protocolsRemoved.length +
      protocolsChanged.length +
      behaviorsAdded.length +
      behaviorsRemoved.length +
      behaviorsChanged.length +
      configAdded.length +
      configRemoved.length +
      configChanged.length +
      templatesAdded.length +
      templatesRemoved.length +
      templatesChanged.length +
      rulesAdded.length +
      rulesRemoved.length +
      rulesChanged.length +
      interactionsAdded.length +
      interactionsRemoved.length +
      interactionsChanged.length >
    0;

  return {
    protocolsAdded,
    protocolsRemoved,
    protocolsChanged,
    behaviorsAdded,
    behaviorsRemoved,
    behaviorsChanged,
    configAdded,
    configRemoved,
    configChanged,
    templatesAdded,
    templatesRemoved,
    templatesChanged,
    rulesAdded,
    rulesRemoved,
    rulesChanged,
    interactionsAdded,
    interactionsRemoved,
    interactionsChanged,
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
  // The bundle is a PURE function of the CMS rows — no spread of
  // activeConfig() — so deleting an override actually removes it from
  // the next bundle regardless of what the admin's browser session
  // happens to have applied.
  const cms = await assembleBundleFromCMS();
  const bundle: KnowledgeBundle = cms
    ? {
        schema: BUNDLE_SCHEMA,
        version,
        generatedAt: new Date().toISOString(),
        protocols: cms.protocols,
        config: cms.config,
        insightTemplates: cms.insightTemplates,
        adaptationRules: cms.adaptationRules,
        interactions: cms.interactions,
      }
    : buildCatalogBundle(version);
  const checksum = bundleChecksum(bundle);
  if (cur && bundleChecksum(cur.bundle) === checksum)
    return {
      ok: false,
      reason: "No changes since the last published bundle.",
    };
  // P0 GOVERNANCE GUARD: validate every atom + audit the assembled
  // ontology before letting the bundle ship. assembleBundleFromCMS
  // reads canonical_key straight from cms_behaviors with no shape
  // enforcement; without this gate, a row hand-edited to
  // `custom:malicious:fake-curated-key` would publish as a curated
  // atom and pollute every user's runtime registry. Errors block
  // publish; warnings surface in the reason text so the admin sees
  // them and can decide whether to address before shipping.
  const validation = validateBundleGovernance(bundle);
  if (validation.errors.length > 0) {
    return {
      ok: false,
      reason: `Bundle failed validation:\n${validation.errors
        .map((e) => `• ${e}`)
        .join("\n")}`,
    };
  }
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

/**
 * Pre-publish governance validation. Runs `validateAtom` over every
 * behavior in every protocol + `auditOntology` over the assembled
 * registry equivalent. Returns errors (blocking) and warnings
 * (surfaced but non-blocking). Pure: doesn't mutate state, doesn't
 * touch the network.
 */
export interface BundleValidationResult {
  errors: string[];
  warnings: string[];
}
export function validateBundleGovernance(
  bundle: KnowledgeBundle
): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Build the registry equivalent inline — every canonicalKey across
  // every official protocol in the bundle. We don't import governance
  // module's buildAtomRegistry here because that reads activePacks()
  // (live runtime) — the BUNDLE being validated may not be live yet.
  const knownKeys = new Set<string>();
  for (const p of bundle.protocols ?? []) {
    // Include EVERY protocol's keys (official + custom) so cross-references
    // (derivedFrom/targets) resolve across a custom CMS protocol too.
    for (const b of p.behaviors) knownKeys.add(b.canonicalKey);
  }
  for (const p of bundle.protocols ?? []) {
    // Validate every admin-authored protocol's behaviors regardless of
    // source — a custom CMS protocol publishes to all users too, so it must
    // pass validateAtom + the daysActive/rationale checks, not skip them.
    for (const b of p.behaviors) {
      const errs = validateAtom(b, knownKeys);
      for (const e of errs) {
        errors.push(`${p.id}:${b.canonicalKey} ${e.field}: ${e.message}`);
      }
      // Reserved-namespace check at publish time — curated atoms
      // shipping in a CMS bundle MUST NOT use the custom: or fork:
      // prefixes (those are user-space). The classifier would
      // otherwise treat them as user content at runtime.
      if (
        b.canonicalKey.startsWith("custom:") ||
        b.canonicalKey.startsWith("fork:")
      ) {
        errors.push(
          `${p.id}:${b.canonicalKey}: curated atoms cannot use the custom: or fork: namespace.`
        );
      }
      // Empty rationale is a quality issue — atom would render blank
      // in surfaces that fall back to rationale (Up Next message,
      // BehaviorSheet body).
      if (!b.rationale || !b.rationale.trim()) {
        warnings.push(
          `${p.id}:${b.canonicalKey}: empty rationale — will render blank in some surfaces.`
        );
      }
      // Evidence text without evidenceTier — claim with no humility
      // framing.
      if (b.evidence && b.evidence.trim() && !b.evidenceTier) {
        warnings.push(
          `${p.id}:${b.canonicalKey}: has evidence text but no evidenceTier — humility framing won't apply.`
        );
      }
      // avoid-kind without targets — the avoid card can't link to
      // the behavior it references.
      if (b.kind === "avoid" && (!b.targets || b.targets.length === 0)) {
        warnings.push(
          `${p.id}:${b.canonicalKey}: avoid-kind atom without targets[] — no visual link to the referenced behavior.`
        );
      }
      // All-false daysActive — atom never renders. Probably a bug.
      if (
        b.daysActive &&
        b.daysActive.length === 7 &&
        b.daysActive.every((v) => v === false)
      ) {
        errors.push(
          `${p.id}:${b.canonicalKey}: daysActive is all-false — atom would never render.`
        );
      }
    }
  }

  // Interactions — previously exempt from governance. A firm conflict can
  // silently MUTE a behavior, so flag the two ways one ships broken:
  //  • references a key in neither this bundle's protocols nor the built-in
  //    catalog → the rule is inert (the engine can't resolve the behavior);
  //  • "firm" severity on a non-conflict type → firm only mutes for conflicts,
  //    so it has no effect (likely an authoring mistake).
  // Warnings (not errors): a dangling ref is harmless at runtime, and built-in
  // references are legitimate, so we never block a publish on this.
  const builtinKeys = new Set<string>();
  for (const p of PACKS)
    for (const b of p.behaviors) builtinKeys.add(b.canonicalKey);
  for (const ix of bundle.interactions ?? []) {
    const id = `${ix.aKey} → ${ix.bKey} (${ix.type})`;
    for (const k of [ix.aKey, ix.bKey]) {
      if (!knownKeys.has(k) && !builtinKeys.has(k))
        warnings.push(
          `interaction ${id}: references "${k}", absent from this bundle's protocols and the built-in catalog — it will be inert.`
        );
    }
    if (ix.severity === "firm" && ix.type !== "conflict")
      warnings.push(
        `interaction ${id}: "firm" severity only mutes for type "conflict"; on "${ix.type}" it has no muting effect.`
      );
  }
  return { errors, warnings };
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
