/**
 * governance.ts — Behavioral intelligence governance layer.
 *
 * The system has three classes of behavior:
 *   1. CURATED   — shipped in PACKS or STANDALONE_ATOMS, reviewed
 *                  metadata (evidenceTier, contraindications, etc.)
 *   2. DERIVED   — user picked a curated atom from the library and
 *                  customized it; carries `derivedFrom` pointer
 *   3. CUSTOM    — user free-typed; no curated lineage
 *
 * This module is the single source of truth for:
 *   - The atom registry (every known canonicalKey in the live catalog)
 *   - Trust-tier classification (governance class of any behavior)
 *   - Explainability: provenance, merge lineage, suppression reason
 *   - Ontology validators (collision detection, namespace integrity)
 *
 * Why a dedicated module: orchestration, recommendations, and the
 * admin dashboard all need governance answers from the same lens.
 * Putting it next to compileTimeline / shapeTimeline / intel keeps
 * cross-cutting governance logic from being copy-pasted into each
 * call site (and silently diverging).
 */
import type {
  AppState,
  BehaviorDef,
  ProtocolPack,
  SafetyFlag,
  TrustTier,
} from "./types";
import {
  CONFLICT_PAIRS,
  compileTimeline,
  shapeTimeline,
  trustTier,
  type TimelineItem,
} from "./engine";
import {
  PACKS,
  STANDALONE_ATOMS_REGISTRY,
} from "./packs";
import { activePacks } from "./knowledge";

// ── Atom registry ─────────────────────────────────────────────────

/**
 * Single record describing one canonical atom in the live catalog,
 * with its governance metadata flattened for inspection. The admin
 * dashboard reads from this; the engine reads the raw BehaviorDef.
 */
export interface AtomRegistryEntry {
  canonicalKey: string;
  title: string;
  trustTier: TrustTier;
  /** Pack ids this atom appears in (deduped). Empty for standalones. */
  fromPacks: string[];
  /** True if this atom lives in STANDALONE_ATOMS rather than a pack. */
  isStandalone: boolean;
  evidenceTier?: BehaviorDef["evidenceTier"];
  contraindications: SafetyFlag[];
  kind: BehaviorDef["kind"];
  leverage: BehaviorDef["leverage"];
  derivedFrom?: string;
  targets?: string[];
  block: BehaviorDef["block"];
  hasEvidenceText: boolean;
  hasTimingReason: boolean;
}

/**
 * The full atom universe — every canonical curated atom, exactly once,
 * keyed by canonicalKey. Powers the admin Intelligence dashboard and
 * cross-cutting validation (e.g., "does this derivedFrom point to a
 * real atom?").
 *
 * Built from the live `activePacks()` (= CMS bundle merged with built-in
 * PACKS) + STANDALONE_ATOMS so a CMS-published atom is queryable too.
 */
export function buildAtomRegistry(): Map<string, AtomRegistryEntry> {
  const registry = new Map<string, AtomRegistryEntry>();
  for (const pack of activePacks()) {
    if (pack.source !== "official") continue;
    for (const b of pack.behaviors) {
      const existing = registry.get(b.canonicalKey);
      if (existing) {
        if (!existing.fromPacks.includes(pack.id))
          existing.fromPacks.push(pack.id);
        continue;
      }
      registry.set(b.canonicalKey, atomEntry(b, [pack.id], false));
    }
  }
  for (const b of STANDALONE_ATOMS_REGISTRY) {
    if (registry.has(b.canonicalKey)) continue;
    registry.set(b.canonicalKey, atomEntry(b, [], true));
  }
  return registry;
}

function atomEntry(
  b: BehaviorDef,
  fromPacks: string[],
  isStandalone: boolean
): AtomRegistryEntry {
  return {
    canonicalKey: b.canonicalKey,
    title: b.title,
    trustTier: trustTier(b),
    fromPacks,
    isStandalone,
    evidenceTier: b.evidenceTier,
    contraindications: b.contraindications ?? [],
    kind: b.kind,
    leverage: b.leverage,
    derivedFrom: b.derivedFrom,
    targets: b.targets,
    block: b.block,
    hasEvidenceText: !!(b.evidence && b.evidence.trim().length > 0),
    hasTimingReason: !!(b.timingReason && b.timingReason.trim().length > 0),
  };
}

/**
 * Set of every known curated canonicalKey. Cheap to compute from the
 * registry; useful for validateAtom() derivedFrom/targets reference
 * checks at publish time.
 */
export function knownCuratedKeys(): Set<string> {
  return new Set(buildAtomRegistry().keys());
}

// ── Ontology integrity checks ─────────────────────────────────────

export interface OntologyIssue {
  severity: "error" | "warning";
  kind: string;
  message: string;
  canonicalKey?: string;
}

/**
 * Catalog-level invariants. Runs across the entire registry — catches
 * problems that per-atom `validateAtom` can't see (e.g., a curated
 * atom shipped with the same title as another curated atom, or a
 * derivedFrom pointer to a missing key).
 *
 * Run at:
 *   - CMS bundle publish time (reject if any error)
 *   - Build-time test (asserts the live catalog is clean)
 *   - Admin diagnostics tab (surfaces warnings for human review)
 */
export function auditOntology(
  registry: Map<string, AtomRegistryEntry> = buildAtomRegistry()
): OntologyIssue[] {
  const issues: OntologyIssue[] = [];

  // 1. Title duplicates across distinct canonicalKeys → likely
  //    fragmentation. Multiple atoms with title "Magnesium" is a
  //    code smell — collapse to one canonical or rename one.
  const titleMap = new Map<string, string[]>();
  for (const a of registry.values()) {
    const norm = a.title.trim().toLowerCase();
    const prev = titleMap.get(norm) ?? [];
    prev.push(a.canonicalKey);
    titleMap.set(norm, prev);
  }
  for (const [title, keys] of titleMap) {
    if (keys.length > 1) {
      issues.push({
        severity: "warning",
        kind: "title-collision",
        message: `Title "${title}" used by ${keys.length} canonical atoms (${keys.join(", ")}). Likely fragmentation — collapse or rename.`,
      });
    }
  }

  // 2. Curated atom using a reserved namespace prefix. The custom:
  //    and fork: prefixes are user-owned; nothing curated should use
  //    them.
  for (const a of registry.values()) {
    if (a.trustTier !== "curated") continue;
    if (
      a.canonicalKey.startsWith("custom:") ||
      a.canonicalKey.startsWith("fork:")
    ) {
      issues.push({
        severity: "error",
        kind: "reserved-namespace",
        message: `Curated atom "${a.canonicalKey}" uses a reserved namespace prefix (custom: / fork:) — those are user-owned only.`,
        canonicalKey: a.canonicalKey,
      });
    }
  }

  // 3. derivedFrom pointers that reference a missing key. A curated
  //    atom shouldn't have derivedFrom set at all (curated atoms are
  //    canonical, not derived); flag those as errors.
  for (const a of registry.values()) {
    if (!a.derivedFrom) continue;
    if (a.trustTier === "curated") {
      issues.push({
        severity: "error",
        kind: "curated-derives-from",
        message: `Curated atom "${a.canonicalKey}" has derivedFrom="${a.derivedFrom}" — curated atoms should be canonical, not derived.`,
        canonicalKey: a.canonicalKey,
      });
    } else if (!registry.has(a.derivedFrom)) {
      issues.push({
        severity: "error",
        kind: "dangling-derived-from",
        message: `Atom "${a.canonicalKey}" derivedFrom="${a.derivedFrom}" but that key isn't in the registry.`,
        canonicalKey: a.canonicalKey,
      });
    }
  }

  // 4. targets that reference a missing key. Avoid-kind atoms link
  //    to their referenced behavior; broken links break the visual
  //    "→ Strength training" affordance on Today.
  for (const a of registry.values()) {
    for (const t of a.targets ?? []) {
      if (!registry.has(t)) {
        issues.push({
          severity: "error",
          kind: "dangling-target",
          message: `Atom "${a.canonicalKey}" targets "${t}" which isn't in the registry.`,
          canonicalKey: a.canonicalKey,
        });
      }
    }
  }

  // 5. evidence text without evidenceTier. If the atom makes a
  //    scientific claim (evidence field has content), it should also
  //    declare its tier so the surface can frame it appropriately.
  for (const a of registry.values()) {
    if (a.hasEvidenceText && !a.evidenceTier) {
      issues.push({
        severity: "warning",
        kind: "missing-evidence-tier",
        message: `Atom "${a.canonicalKey}" has evidence text but no evidenceTier — humility framing won't apply.`,
        canonicalKey: a.canonicalKey,
      });
    }
  }

  return issues;
}

// ── Explainability ────────────────────────────────────────────────

/**
 * Full provenance for a single behavior in the user's compiled
 * timeline. Answers: "where did this come from, why is it here,
 * why is it muted (or not), what's its governance class?"
 *
 * The dashboard and (eventually) a user-facing "Why is this here?"
 * affordance both consume this.
 */
export interface BehaviorExplanation {
  canonicalKey: string;
  effectiveKey: string;
  title: string;
  trustTier: TrustTier;
  /** Pack names contributing this behavior to the user's day. */
  fromPacks: string[];
  /** True if multiple installed packs merged into one row. */
  mergedFromMultiple: boolean;
  /** Concrete reason the behavior is muted, if it is. */
  muted: boolean;
  muteReason?: string;
  /** Override fields the user has set (timing/dose/days). */
  hasUserOverrides: boolean;
  /** Whether the engine treats this as a system-recommendation source. */
  recommendationEligible: boolean;
  /** Whether this can become the user's keystone. */
  keystoneEligible: boolean;
  /** Curated atom key if this is derived/custom-derived. */
  derivedFrom?: string;
  /** Safety flags that would suppress this atom from the timeline. */
  contraindications: SafetyFlag[];
  /** Atoms muted by this one (only applies to restraint kinds). */
  mutesByConflictPair: string[];
  /** Atoms that would mute this one if active. */
  mutedByRestraints: string[];
  /** Evidence tier for the surfaced rationale + evidence text. */
  evidenceTier?: BehaviorDef["evidenceTier"];
  /** Notes worth surfacing (e.g., "contraindicated by your pregnancy
   *  flag — currently suppressed"). */
  notes: string[];
}

/**
 * Build the full provenance + governance explanation for a single
 * behavior currently on (or suppressed from) the user's compiled
 * timeline. Looks at the SHAPED timeline so muteReason is populated.
 *
 * Returns null when the canonicalKey isn't in any installed pack.
 */
export function explainBehavior(
  state: AppState,
  canonicalKey: string,
  dayIndex: number = 0,
  mode: Parameters<typeof shapeTimeline>[1] = "normal"
): BehaviorExplanation | null {
  // Compile + shape so we see the user's actual muteReason / merge
  // state, not just the catalog default.
  const compiled = compileTimeline(state, dayIndex);
  const shaped = shapeTimeline(compiled, mode, {});
  // Find by canonicalKey OR derivedFrom (the user might be asking
  // about either the namespaced custom key or the curated original).
  const item =
    shaped.find((i) => i.canonicalKey === canonicalKey) ??
    shaped.find((i) => i.derivedFrom === canonicalKey);
  if (!item) return null;
  return explainTimelineItem(state, item);
}

/**
 * Lower-level helper that takes an already-shaped TimelineItem and
 * builds the explanation. Useful for batch inspection (e.g., the
 * admin dashboard wants explanations for every row at once).
 */
export function explainTimelineItem(
  state: AppState,
  item: TimelineItem
): BehaviorExplanation {
  const overrides = state.behaviorOverrides?.[item.canonicalKey];
  const hasUserOverrides = !!(
    overrides &&
    (overrides.block !== undefined ||
      overrides.customTime !== undefined ||
      overrides.dose !== undefined ||
      overrides.daysActive !== undefined)
  );

  // Restraint relationships (for kind: "avoid" behaviors that target
  // others, or training behaviors that get muted by restraints). The
  // CONFLICT_PAIRS lookup is mirrored from engine.ts; we read it via
  // dynamic import to avoid a circular dep.
  // For now, copy the relevant subset of pairs inline — keep it
  // small and explicit.
  const mutesByConflictPair: string[] = [];
  const mutedByRestraints: string[] = [];
  const effective = item.derivedFrom ?? item.canonicalKey;
  for (const pair of CONFLICT_PAIRS) {
    if (pair.restraint === effective) mutesByConflictPair.push(pair.target);
    if (pair.target === effective) mutedByRestraints.push(pair.restraint);
  }

  const notes: string[] = [];
  if (item.trustTier === "custom") {
    notes.push(
      "Custom behavior — outside the recommendation engine. The system tracks your completions but doesn't surface this as a keystone or pause it automatically."
    );
  }
  if (item.trustTier === "derived" && item.derivedFrom) {
    notes.push(
      `Derived from curated atom "${item.derivedFrom}" — inherits its evidence + contraindication metadata.`
    );
  }
  if (item.evidenceTier === "exploratory") {
    notes.push(
      "Exploratory evidence: mechanistic / observational basis with thin human RCT data."
    );
  }
  if (item.evidenceTier === "emerging") {
    notes.push(
      "Emerging evidence: meaningful but still being characterized."
    );
  }

  return {
    canonicalKey: item.canonicalKey,
    effectiveKey: effective,
    title: item.title,
    trustTier: item.trustTier,
    fromPacks: item.fromPacks,
    mergedFromMultiple: item.fromPacks.length > 1,
    muted: item.muted,
    muteReason: item.muteReason,
    hasUserOverrides,
    // Recommendation eligibility = the system would offer this atom
    // as a suggestion. Customs (free-text) are intentionally never
    // recommendation sources.
    recommendationEligible: item.trustTier !== "custom",
    // Keystone eligibility — same gate as keystone() in intel.ts.
    keystoneEligible: item.trustTier !== "custom",
    derivedFrom: item.derivedFrom,
    contraindications: item.contraindications ?? [],
    mutesByConflictPair,
    mutedByRestraints,
    evidenceTier: item.evidenceTier,
    notes,
  };
}

// ── User-facing provenance signals ────────────────────────────────

/**
 * Calm provenance language for a single behavior. The user never sees
 * the words "tier" or "governance" — this helper translates the
 * internal trust system into asymmetric ownership cues:
 *
 *   Curated  → no pill on the row; the line in About-this-behavior
 *              names the source ("From your Better Sleep protocol.")
 *   Derived  → no pill; line says "Adapted from Morning sunlight."
 *   Custom   → tiny "Personal" pill on the row; line in About says
 *              "Your personal behavior — kept just for you, not part
 *              of our recommendations."
 *
 * Asymmetry is the design: curated is the *default*; non-curated
 * wears the gentle ownership badge.
 *
 * `atomRegistry` is optional; when omitted, derived items show
 * their derivedFrom key as fallback. Callers that have the registry
 * handy should pass it so the line reads with the human title.
 */
export interface ProvenanceLabel {
  /** Short pill text shown on the Today timeline row. null = no pill. */
  shortLabel: string | null;
  /**
   * Calm one-line provenance for the BehaviorSheet "About this
   * behavior" section. null = the row already speaks for itself.
   */
  fullLine: string | null;
}

export function provenanceLabel(
  b: {
    canonicalKey: string;
    title?: string;
    derivedFrom?: string;
    fromPacks?: string[];
    trustTier?: TrustTier;
  },
  atomRegistry?: Map<string, AtomRegistryEntry>
): ProvenanceLabel {
  // If trustTier wasn't pre-computed (e.g., raw BehaviorDef, not a
  // TimelineItem), derive it from the canonical key shape.
  const tier =
    b.trustTier ??
    (b.canonicalKey.startsWith("custom:")
      ? b.derivedFrom
        ? "derived"
        : "custom"
      : b.canonicalKey.startsWith("fork:")
        ? "derived"
        : "curated");

  if (tier === "custom") {
    return {
      shortLabel: "Personal",
      fullLine:
        "Your personal behavior — kept just for you, not part of our recommendations.",
    };
  }
  if (tier === "derived" && b.derivedFrom) {
    const originalTitle =
      atomRegistry?.get(b.derivedFrom)?.title ?? b.derivedFrom;
    return {
      shortLabel: null,
      fullLine: `Adapted from ${originalTitle}.`,
    };
  }
  // Curated — name the protocol(s) it came from so the user can
  // anchor the recommendation to their own installed system.
  if (b.fromPacks && b.fromPacks.length > 0) {
    if (b.fromPacks.length === 1) {
      return {
        shortLabel: null,
        fullLine: `From your ${b.fromPacks[0]} protocol.`,
      };
    }
    return {
      shortLabel: null,
      fullLine: `Common across ${b.fromPacks.length} of your protocols.`,
    };
  }
  return { shortLabel: null, fullLine: null };
}

/**
 * One-sentence evidence framing appended to the rationale. Lives here
 * so the language is auditable and consistent — the calm "humility"
 * voice that should never feel clinical or anxiety-inducing.
 *
 * Returns null for "established" / undefined — the rationale itself
 * is enough; no need to qualify it.
 */
export function evidenceFraming(
  evidenceTier?: BehaviorDef["evidenceTier"]
): string | null {
  if (!evidenceTier || evidenceTier === "established") return null;
  if (evidenceTier === "emerging")
    return "The evidence here is encouraging but still maturing.";
  if (evidenceTier === "exploratory")
    return "This sits in earlier research — treat it as experimental.";
  return null;
}

/**
 * Numeric rank for sorting behaviors most → least evidence-based (lower =
 * stronger). Built on the EXISTING evidenceTier union — not a new scale:
 *   established (0) > emerging (1) > foundational/absent (2) > exploratory (3).
 * "Absent" = the atom makes no extraordinary claim (a walk, hydration); it
 * sorts NEUTRALLY in the middle, never punished below experimental
 * compounds. "exploratory" (thin human data) sorts last but is never
 * hidden. Presentation + a final tie-break only — never mutes or
 * down-weights a behavior.
 */
export function evidenceRank(tier?: BehaviorDef["evidenceTier"]): number {
  switch (tier) {
    case "established":
      return 0;
    case "emerging":
      return 1;
    case "exploratory":
      return 3;
    default:
      return 2;
  }
}

// ── Inventory + counts (for admin dashboard) ──────────────────────

export interface CatalogInventory {
  totalCurated: number;
  totalPacks: number;
  totalStandalones: number;
  byEvidenceTier: Record<string, number>;
  byTrustTier: Record<TrustTier, number>;
  withContraindications: number;
  withTargets: number;
  withRecommendedBy: number;
  contraindicationCounts: Record<string, number>;
}

/**
 * Aggregate stats for the admin Intelligence dashboard. The dashboard
 * uses these to surface "you have 100 curated atoms, 12 with
 * contraindications, 4 missing evidence tiers" at a glance.
 */
export function catalogInventory(
  registry: Map<string, AtomRegistryEntry> = buildAtomRegistry()
): CatalogInventory {
  const inv: CatalogInventory = {
    totalCurated: 0,
    totalPacks: new Set(PACKS.map((p) => p.id)).size,
    totalStandalones: 0,
    byEvidenceTier: { established: 0, emerging: 0, exploratory: 0, none: 0 },
    byTrustTier: { curated: 0, derived: 0, custom: 0 },
    withContraindications: 0,
    withTargets: 0,
    withRecommendedBy: 0,
    contraindicationCounts: {},
  };
  for (const a of registry.values()) {
    inv.totalCurated++;
    inv.byTrustTier[a.trustTier]++;
    if (a.isStandalone) inv.totalStandalones++;
    const tier = a.evidenceTier ?? "none";
    inv.byEvidenceTier[tier] = (inv.byEvidenceTier[tier] ?? 0) + 1;
    if (a.contraindications.length > 0) inv.withContraindications++;
    if (a.targets && a.targets.length > 0) inv.withTargets++;
    for (const f of a.contraindications) {
      inv.contraindicationCounts[f] =
        (inv.contraindicationCounts[f] ?? 0) + 1;
    }
  }
  return inv;
}
