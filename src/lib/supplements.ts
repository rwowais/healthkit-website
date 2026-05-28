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
export function supplementsForBlock(
  all: Supplement[],
  block: TimeBlock,
  dayIndex: number,
  flags?: Partial<Record<SafetyFlag, boolean>>
): Supplement[] {
  const userFlags = flags ?? {};
  return all
    .filter((s) => s.block === block)
    .filter((s) => !s.daysActive || s.daysActive[dayIndex])
    .filter((s) => {
      if (!s.contraindications || s.contraindications.length === 0) return true;
      return !s.contraindications.some((f) => userFlags[f] === true);
    })
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
