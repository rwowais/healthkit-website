/**
 * supplements.ts — the curated supplement registry, separation logic,
 * and helpers for supplement-specific surfaces.
 *
 * Why this exists:
 *   Supplements were originally modeled as `BehaviorDef` atoms inside
 *   protocol packs. That worked for the basic "tick a daily item"
 *   flow but conflated two genuinely different concepts:
 *     - Behaviors: practices the user is building over time. Each
 *       has a clock-time anchor, a streak, intelligence-layer
 *       interactions (keystone, conflict pairs, recovery demote).
 *     - Supplements: items the user takes. They're bundled by block
 *       (morning / afternoon / evening), they have inventory and
 *       dose, they cluster by intent ("longevity stack") and don't
 *       interact with the behavior intelligence layer.
 *
 *   The separation lets each get the UX it deserves. Today renders a
 *   single "Morning supplements (5)" pill instead of 5 stacked rows;
 *   the supplement library can ship inventory, refill prompts, stack
 *   templates, and a weekly grid view that wouldn't fit the behavior
 *   model.
 *
 * Migration policy:
 *   Existing user data must survive the cutover. The migration in
 *   storage.ts (`migrateSupplementsOnce`) reads existing
 *   behaviorCompletions for known supplement canonical keys, copies
 *   them into the new `supplementCompletions` field, and creates
 *   matching Supplement entries in `state.supplements`. The original
 *   behavior data is left untouched for one schema version so a
 *   rollback is non-destructive.
 *
 * This file is the single source of truth for "which canonical keys
 * are supplements" — referenced by the migration, the engine, and
 * the rendering layer.
 */
import { PACKS, STANDALONE_ATOMS_REGISTRY as STANDALONE_ATOMS } from "./packs";
import type {
  BehaviorDef,
  Supplement,
  TimeBlock,
  SafetyFlag,
} from "./types";

/**
 * Canonical keys of every curated behavior that semantically IS a
 * supplement (something a user swallows for nutritional/longevity
 * effect). Verified against the catalog in packs.ts by a one-shot
 * audit. Adding a new curated supplement: add the canonicalKey here
 * AND make sure the atom def exists in packs.ts. Removing one: the
 * migration is idempotent, so removed keys just stop being extracted
 * for new users; existing users keep theirs as user-custom rows.
 */
export const SUPPLEMENT_CANONICAL_KEYS: ReadonlySet<string> = new Set([
  // Shared atoms (referenced across multiple packs)
  "magnesium-pm",
  "omega-3",
  "strategic-melatonin",
  // Pack-bound staples
  "vitamin-d3",
  "creatine",
  // Standalone library
  "vitamin-c",
  "b-complex",
  "zinc",
  "selenium",
  "iodine",
  "boron",
  "nmn",
  "nr",
  "tmg",
  "coq10",
  "nac",
  "alpha-lipoic-acid",
  "spermidine",
  "resveratrol",
  "curcumin",
  "quercetin",
  "astaxanthin",
  "lutein-zeaxanthin",
  "glycine",
  "taurine",
  "l-theanine",
  "l-citrulline",
  "citicoline",
  "phosphatidylserine",
  "lions-mane",
  "bacopa",
  "rhodiola",
  "ashwagandha",
  "berberine",
  "beetroot",
  "inositol",
  "apigenin",
  "probiotics",
]);

/** Cheap lookup — is this canonical key a supplement? */
export function isSupplementKey(canonicalKey: string): boolean {
  return SUPPLEMENT_CANONICAL_KEYS.has(canonicalKey);
}

/**
 * Title-keyword fallback. Used when canonical-key matching misses —
 * e.g. CMS-published bundles where an admin edited the title, or
 * legacy custom behaviors created before derivedFrom was tracked,
 * or imports from external sources. We deliberately list whole
 * words / phrases so common health terms like "vitamin" don't sweep
 * up unrelated behaviors.
 */
const SUPPLEMENT_TITLE_PATTERNS: readonly RegExp[] = [
  /\bmelatonin\b/i,
  /\bvitamin\s*[abcdek]\d?\b/i, // Vitamin A/B/C/D/E/K with optional digit
  /\bvitamin d3?\b/i,
  /\bcreatine\b/i,
  /\bmagnesium\b/i,
  /\bomega[- ]?3\b/i,
  /\bcoq10\b/i,
  /\bubiquin(ol|one)\b/i,
  /\bnmn\b/i,
  /\bnicotinamide\b/i,
  /\btmg\b/i,
  /\btrimethylglycine\b/i,
  /\bberberine\b/i,
  /\bashwagandha\b/i,
  /\brhodiola\b/i,
  /\bl-?theanine\b/i,
  /\btaurine\b/i,
  /\bglycine\b/i,
  /\bnac\b/i,
  /\balpha[- ]?lipoic\b/i,
  /\bspermidine\b/i,
  /\bresveratrol\b/i,
  /\bcurcumin\b/i,
  /\bquercetin\b/i,
  /\bastaxanthin\b/i,
  /\blutein\b/i,
  /\bzeaxanthin\b/i,
  /\bbacopa\b/i,
  /\blion'?s? mane\b/i,
  /\bciticoline\b/i,
  /\bphosphatidyl/i,
  /\bprobiotic/i,
  /\bcitrulline\b/i,
  /\bbeetroot\b/i,
  /\bb[- ]?complex\b/i,
  /\bboron\b/i,
  /\bapigenin\b/i,
  /\binositol\b/i,
  /\bselenium\b/i,
  /\biodine\b/i,
  /\bzinc\b/i,
];

/**
 * Robust supplement detector — works whether the behavior comes from
 * the local catalog, the CMS-published bundle (which may have edited
 * titles / shifted canonical keys), or a user's custom pack. Order
 * matters: cheapest most-reliable check first.
 *
 * Strategy:
 *  1. Canonical-key match (the SUPPLEMENT_CANONICAL_KEYS set).
 *  2. derivedFrom match (fork of a curated supplement).
 *  3. icon === "pill" (a strong format signal).
 *  4. Title regex match against known supplement words/phrases.
 */
export function isSupplementBehavior(b: {
  canonicalKey: string;
  derivedFrom?: string;
  icon?: string;
  title?: string;
}): boolean {
  if (SUPPLEMENT_CANONICAL_KEYS.has(b.canonicalKey)) return true;
  if (b.derivedFrom && SUPPLEMENT_CANONICAL_KEYS.has(b.derivedFrom))
    return true;
  if (b.icon === "pill") return true;
  // Title-pattern detection is a FALLBACK for CURATED supplements whose
  // canonical key was renamed or lost (e.g. a CMS-edited bundle). It must NOT
  // eat a behavior the USER authored: a custom/forked atom named like a
  // supplement ("Magnesium before bed") is their explicit behavior — without
  // this guard the title regex reclassified it as a supplement and
  // compileTimeline dropped it from the timeline entirely (it never appeared
  // anywhere). A user-DERIVED supplement is still caught above via the
  // derivedFrom / pill-icon layers; only the loose title heuristic is gated.
  const userAuthored = b.canonicalKey.startsWith("custom:") || !!b.derivedFrom;
  if (!userAuthored && b.title) {
    for (const pat of SUPPLEMENT_TITLE_PATTERNS) {
      if (pat.test(b.title)) return true;
    }
  }
  return false;
}

/**
 * Look up a curated supplement's BehaviorDef from the catalog (packs
 * + standalone atoms). Used by the migration to extract metadata
 * (dose, rationale, contraindications, evidence) when creating
 * Supplement entries from existing behavior data.
 */
function findBehaviorByKey(key: string): BehaviorDef | null {
  for (const p of PACKS) {
    const hit = p.behaviors.find((b) => b.canonicalKey === key);
    if (hit) return hit;
  }
  const standalone = STANDALONE_ATOMS.find((b) => b.canonicalKey === key);
  return standalone ?? null;
}

/**
 * Find the pack that contains a given canonical key (first match
 * wins — same key can appear in multiple packs as a shared atom).
 * Used by the migration to stamp `installedFromPack` so an uninstall
 * can clean up gracefully later.
 */
function findPackForKey(key: string): string | null {
  for (const p of PACKS) {
    if (p.behaviors.some((b) => b.canonicalKey === key)) return p.id;
  }
  return null;
}

/**
 * Build a Supplement entry from a curated behavior atom. Used by the
 * migration and by the "add from library" flow. Source is "curated"
 * since we pulled from the official catalog; user overrides happen
 * post-hoc via the supplement editor.
 */
export function supplementFromBehavior(
  b: BehaviorDef,
  packId?: string | null
): Supplement {
  return {
    id: b.canonicalKey,
    name: b.title,
    dose: b.dose,
    block: b.block,
    timing: b.timingReason,
    daysActive: b.daysActive,
    derivedFrom: b.canonicalKey,
    contraindications: b.contraindications,
    evidence: b.evidence,
    evidenceTier: b.evidenceTier,
    rationale: b.rationale,
    source: "curated",
    installedFromPack: packId ?? findPackForKey(b.canonicalKey) ?? undefined,
  };
}

/**
 * Look up a curated supplement's display data by canonical key,
 * returning null when the key isn't in the catalog (e.g. a custom
 * supplement). Used by the catalog browser surface.
 */
export function getCuratedSupplement(key: string): Supplement | null {
  const b = findBehaviorByKey(key);
  return b ? supplementFromBehavior(b) : null;
}

/**
 * Browse the catalog: every curated supplement, deduplicated by
 * canonical key (shared atoms only appear once even though they're
 * in multiple packs). Used by the supplement library surface.
 */
export function curatedSupplementCatalog(): Supplement[] {
  const seen = new Map<string, Supplement>();
  for (const p of PACKS) {
    for (const b of p.behaviors) {
      if (!isSupplementKey(b.canonicalKey)) continue;
      if (!seen.has(b.canonicalKey)) {
        seen.set(b.canonicalKey, supplementFromBehavior(b, p.id));
      }
    }
  }
  for (const b of STANDALONE_ATOMS) {
    if (!isSupplementKey(b.canonicalKey)) continue;
    if (!seen.has(b.canonicalKey)) {
      seen.set(b.canonicalKey, supplementFromBehavior(b, null));
    }
  }
  return Array.from(seen.values());
}

/**
 * Filter the user's supplements down to a single block, honoring
 * daysActive and an optional safety-flags suppressor. Returns the
 * list in stable order (curated alphabetical, customs at the end).
 */
/**
 * True when one of the user's safety flags contraindicates this supplement.
 * Single source of truth for the suppression rule — used by the block filter
 * below AND by the Browse view, so a contraindicated supplement reads as
 * "Not recommended with your health settings" instead of a misleading Add /
 * Remove button (it would otherwise install but be hidden everywhere).
 */
export function isSupplementContraindicated(
  s: Pick<Supplement, "contraindications">,
  flags?: Partial<Record<SafetyFlag, boolean>>
): boolean {
  if (!s.contraindications || s.contraindications.length === 0) return false;
  const userFlags = flags ?? {};
  return s.contraindications.some((f) => userFlags[f] === true);
}

export function supplementsForBlock(
  all: Supplement[],
  block: TimeBlock,
  dayIndex: number,
  flags?: Partial<Record<SafetyFlag, boolean>>
): Supplement[] {
  return all
    .filter((s) => s.block === block)
    .filter((s) => !s.daysActive || s.daysActive[dayIndex])
    .filter((s) => !isSupplementContraindicated(s, flags))
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "curated" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Aggregate: how many of the user's block-X supplements are marked
 * done in today's log? Returns null when there are none, otherwise
 * { done, total }. Powers the "Morning supplements · 3/5" pill copy.
 */
export function supplementBlockProgress(
  all: Supplement[],
  block: TimeBlock,
  dayIndex: number,
  completions: Record<string, boolean> | undefined,
  flags?: Partial<Record<SafetyFlag, boolean>>
): { done: number; total: number } | null {
  const list = supplementsForBlock(all, block, dayIndex, flags);
  if (list.length === 0) return null;
  const done = list.filter((s) => completions?.[s.id] === true).length;
  return { done, total: list.length };
}
