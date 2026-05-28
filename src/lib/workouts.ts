/**
 * workouts.ts — workout-category helpers + per-day swap utilities.
 *
 * Why this exists:
 *   Real life is messy. A user scheduled for strength on Tuesday may
 *   wake up with a sore shoulder and want to do yoga instead. The
 *   options without this module are bad: lie about completion (tap
 *   strength done), skip silently (score drops, no record of what
 *   they DID do), or add a custom one-off behavior every time.
 *
 *   Workout swap lets the user say "I planned strength, I actually
 *   did Zone 2" — once, for today, without rewiring their schedule.
 *   The swap is per-day (lives in DailyLog.swaps), it's reversible,
 *   and it doesn't pollute streak/mastery math (the user didn't do
 *   the original; the replacement is a one-off).
 *
 * Detection:
 *   `category: "workout"` is the explicit, opt-in marker in
 *   packs.ts. Title/icon heuristics are intentionally avoided —
 *   tagging at the source is unambiguous, future-proof for CMS
 *   edits, and easy to audit.
 *
 *   Curated workout atoms (current set): zone2, strength,
 *   vo2max-intervals, tabata-hiit, extended-walk. Adding more is
 *   one field in the pack/atom def.
 *
 * Resolution:
 *   `availableWorkoutAlternatives()` returns every workout-tagged
 *   behavior the user has access to via an installed pack — even
 *   when daysActive excludes today. This is the swap menu's source
 *   of truth.
 */
import { activePacks } from "./knowledge";
import { STANDALONE_ATOMS_REGISTRY } from "./packs";
import type { AppState, BehaviorDef, DailyLog } from "./types";

/** Cheap predicate: is this behavior tagged as a workout? */
export function isWorkoutBehavior(b: {
  category?: string;
  canonicalKey?: string;
}): boolean {
  return b.category === "workout";
}

/**
 * Every workout behavior the user can reach — across installed
 * packs PLUS the standalone library (so a user with one pack still
 * sees other workout options when they need to swap). Returned
 * deduped by canonicalKey.
 */
export function availableWorkoutAlternatives(
  state: AppState
): BehaviorDef[] {
  const installed = new Set(state.installedPacks ?? []);
  const paused = new Set(state.pausedPacks ?? []);
  const seen = new Map<string, BehaviorDef>();
  for (const p of activePacks()) {
    if (!installed.has(p.id) || paused.has(p.id)) continue;
    for (const b of p.behaviors) {
      if (!isWorkoutBehavior(b)) continue;
      if (!seen.has(b.canonicalKey)) seen.set(b.canonicalKey, b);
    }
  }
  // Library standalones — always available as swap destinations even
  // if the user hasn't installed them as a behavior. Lets a strength
  // user pick "60-min walk" for a recovery day without first having
  // to install another pack.
  for (const b of STANDALONE_ATOMS_REGISTRY) {
    if (!isWorkoutBehavior(b)) continue;
    if (!seen.has(b.canonicalKey)) seen.set(b.canonicalKey, b);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

/**
 * Resolve a behavior by its canonical key, looking across all packs
 * (installed or not) and the standalone library. Used by the engine
 * when applying a swap so the replacement renders even if it's
 * normally outside today's daysActive window.
 */
export function resolveBehaviorByKey(key: string): BehaviorDef | null {
  for (const p of activePacks()) {
    const hit = p.behaviors.find((b) => b.canonicalKey === key);
    if (hit) return hit;
  }
  const standalone = STANDALONE_ATOMS_REGISTRY.find(
    (b) => b.canonicalKey === key
  );
  return standalone ?? null;
}

/** Get today's swaps from a log, or empty record if none. */
export function getSwaps(log?: DailyLog): Record<string, string> {
  return log?.swaps ?? {};
}

/**
 * Detect "today is an easier day" from the swap shape. Returns true
 * when at least one swap goes from a higher-intensity workout to a
 * lower-intensity one (high→{moderate,low} or moderate→low). Engine
 * uses this to nudge adapt() toward "lighter" mode and to mute
 * downstream high-stress items (late caffeine, cold plunge after
 * lifts, etc.) — making the swap feel intelligent, not just logged.
 */
export function easierDayFromSwap(log: DailyLog | undefined): boolean {
  const swaps = log?.swaps;
  if (!swaps) return false;
  const rank: Record<string, number> = { high: 3, moderate: 2, low: 1 };
  for (const [fromKey, toKey] of Object.entries(swaps)) {
    const from = resolveBehaviorByKey(fromKey);
    const to = resolveBehaviorByKey(toKey);
    if (!from || !to) continue;
    const fi = from.intensity ? rank[from.intensity] : 0;
    const ti = to.intensity ? rank[to.intensity] : 0;
    if (fi > 0 && ti > 0 && fi > ti) return true;
  }
  return false;
}
