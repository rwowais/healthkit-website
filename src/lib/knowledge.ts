/**
 * knowledge.ts — the runtime seam between the Protocol Intelligence CMS
 * and the live app.
 *
 * Delivery model (per design): HYBRID.
 *  - Default / offline: the built-in catalog that ships with the build
 *    (src/lib/packs.ts) IS the v1 bundle — version-controlled, instant,
 *    works with zero network.
 *  - Online (optional): the app may refresh to the newest *published*
 *    bundle (cms_publications, RLS-readable, immutable, checksummed).
 *
 * Authoring lives in the relational cms_* tables; a human Publish step
 * snapshots the approved set into a denormalised bundle whose shape is
 * exactly the runtime contract (ProtocolPack[]), so consumers never
 * change and equivalence is provable. Inert until a bundle is published.
 *
 * P1 establishes + proves this seam. Nothing consumes the override yet
 * (no publish path exists until P3) — the app stays byte-identical.
 */
import type { ProtocolPack, Interaction } from "./types";
import { PACKS } from "./packs";

export const BUNDLE_SCHEMA = 1;

/** A copy template the intelligence layer can substitute at render time. */
export interface InsightTemplate {
  kind: string;
  template: string;
  conditions?: unknown;
}

export interface KnowledgeBundle {
  schema: number;
  /** Monotonic published version (0 = built-in default). */
  version: number;
  generatedAt: string;
  protocols: ProtocolPack[];
  /** Tunables that were hardcoded constants (thresholds etc.). */
  config: Record<string, number | string | boolean>;
  /** Optional — CMS-authored insight copy. Older bundles omit this; the
   *  intelligence layer falls back to its built-in default copy. */
  insightTemplates?: InsightTemplate[];
  /** Optional — CMS-authored adaptation rules. Older bundles omit this;
   *  adapt() then runs purely on the hardcoded baseline. */
  adaptationRules?: import("./cms/rules").AdaptationRule[];
  /** Optional — CMS-authored behavior-to-behavior interactions. Older
   *  bundles omit this; the engine then runs purely on the built-in
   *  CONFLICT_PAIRS fallback. */
  interactions?: Interaction[];
}

/** Stable, order-independent checksum for bundle integrity. */
export function bundleChecksum(b: {
  protocols: ProtocolPack[];
  config: Record<string, unknown>;
  insightTemplates?: unknown;
  adaptationRules?: unknown;
  interactions?: unknown;
}): string {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.keys(o)
        .sort()
        .reduce<Record<string, unknown>>((a, k) => {
          a[k] = canon(o[k]);
          return a;
        }, {});
    }
    return v;
  };
  // Only include `t` (insightTemplates) and `r` (adaptationRules) in
  // the canonical form when they exist AND are non-empty — keeps
  // backward compatibility with every bundle published before Wave D
  // so stored integrity checksums still validate on read-back.
  const canonObj: Record<string, unknown> = { p: b.protocols, c: b.config };
  if (Array.isArray(b.insightTemplates) && b.insightTemplates.length > 0) {
    canonObj.t = b.insightTemplates;
  }
  if (Array.isArray(b.adaptationRules) && b.adaptationRules.length > 0) {
    canonObj.r = b.adaptationRules;
  }
  // Same backward-compat rule: only fold interactions into the checksum
  // when present AND non-empty, so every bundle published before this
  // field existed still validates on read-back.
  if (Array.isArray(b.interactions) && b.interactions.length > 0) {
    canonObj.x = b.interactions;
  }
  const s = JSON.stringify(canon(canonObj));
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** The built-in bundle: the shipped catalog, version 0. */
export function builtinBundle(): KnowledgeBundle {
  return {
    schema: BUNDLE_SCHEMA,
    version: 0,
    generatedAt: "builtin",
    protocols: PACKS,
    config: {},
  };
}

// ── Active catalog (override-aware) ───────────────────────────────────
let published: KnowledgeBundle | null = null;

/** Validate a candidate bundle before it can replace the catalog. */
export function isValidBundle(b: unknown): b is KnowledgeBundle {
  if (!b || typeof b !== "object") return false;
  const x = b as Partial<KnowledgeBundle>;
  return (
    x.schema === BUNDLE_SCHEMA &&
    typeof x.version === "number" &&
    Array.isArray(x.protocols) &&
    x.protocols.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        Array.isArray((p as ProtocolPack).behaviors)
    ) &&
    !!x.config &&
    typeof x.config === "object"
  );
}

/**
 * The catalog the runtime should use. CMS-published bundles take
 * precedence pack-by-pack, but any built-in PACK not present in the
 * bundle is included as a fallback. Without this merge, shipping a
 * new built-in protocol (e.g., Jetlag Recovery) requires republishing
 * the CMS bundle before users can see it — the CMS would otherwise
 * silently shadow newer code.
 *
 * Identity is by `id`. A bundle with id "longevity-foundation"
 * overrides the built-in with the same id; a built-in id absent from
 * the bundle is appended at the end.
 */
export function activePacks(): ProtocolPack[] {
  const bundled = published?.protocols ?? [];
  if (bundled.length === 0) return PACKS;
  const bundleIds = new Set(bundled.map((p) => p.id));
  const builtInExtras = PACKS.filter((p) => !bundleIds.has(p.id));
  return [...bundled, ...builtInExtras];
}

export function activeConfig(): Record<string, number | string | boolean> {
  return published?.config ?? {};
}

export function activeBundleVersion(): number {
  return published?.version ?? 0;
}

/**
 * Typed config readers — every entitlement gate / threshold goes through
 * these so a Publish that includes overrides actually takes effect
 * without re-deploying code. The default is the source-of-truth fallback
 * when no override has been published. Numbers accept stringified ints
 * (Postgres jsonb returns "14" / 14 interchangeably depending on insert).
 */
export function getCfgNumber(key: string, def: number): number {
  const v = activeConfig()[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}
export function getCfgString(key: string, def: string): string {
  const v = activeConfig()[key];
  return typeof v === "string" ? v : def;
}
export function getCfgBool(key: string, def: boolean): boolean {
  const v = activeConfig()[key];
  return typeof v === "boolean" ? v : def;
}

/** Current insight templates from the active bundle (empty if none). */
export function activeInsightTemplates(): InsightTemplate[] {
  return published?.insightTemplates ?? [];
}

/** Current CMS adaptation rules from the active bundle (empty if none). */
export function activeAdaptationRules(): import("./cms/rules").AdaptationRule[] {
  return published?.adaptationRules ?? [];
}

/** Current CMS-authored interactions from the active bundle (empty if none). */
export function activeInteractions(): Interaction[] {
  return published?.interactions ?? [];
}

/**
 * Look up a template by kind; return the default copy if no CMS row
 * exists. Same fall-through contract as getCfg* — never throws, never
 * blocks the runtime.
 */
export function getInsightTemplate(
  kind: string,
  defaultCopy: string
): string {
  const t = activeInsightTemplates().find((x) => x.kind === kind);
  return t?.template ?? defaultCopy;
}

/** Minimal {var} interpolation for template copy. Missing keys → "". */
export function renderTemplate(
  tpl: string,
  vars: Record<string, unknown>
): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * Apply a fetched published bundle (hybrid online refresh). Only a
 * newer, structurally-valid bundle replaces the catalog; anything off
 * is ignored and the built-in stays in force. Returns whether applied.
 */
export function applyPublishedBundle(b: unknown): boolean {
  if (!isValidBundle(b)) return false;
  if (b.version <= activeBundleVersion()) return false;
  published = b;
  return true;
}

/** Reset to the built-in catalog (tests / sign-out hygiene). */
export function resetKnowledge(): void {
  published = null;
}
