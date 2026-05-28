/**
 * grouping.ts — render-time grouping logic for the Today timeline.
 *
 * Why this lives in lib (not in the page):
 *   The decision of "what counts as a supplement" + "when to collapse
 *   a run of them" is product policy, not view logic. Keeping it here
 *   means we can unit-test it cleanly and reuse it from Insights /
 *   Protocols if we ever group there too.
 *
 * Architecture note:
 *   For V1 we detect supplements by icon === "pill" (it's reliable
 *   for the curated catalog — 16 of 16 supplement atoms use it).
 *   A proper `category` field on BehaviorDef is the right long-term
 *   answer, but adding it now means migrating every curated atom +
 *   every test fixture; the icon proxy ships in 10 lines and covers
 *   the actual UX problem (clutter when 6+ supplements stack at the
 *   same wake-anchored minute).
 */
import type { TimelineItem } from "./engine";

/**
 * One render row. Either a single behavior, or a group of supplements
 * collapsed under a single card the user can expand.
 */
export type RowGroup =
  | { kind: "item"; item: TimelineItem }
  | { kind: "supplements"; items: TimelineItem[] };

/** Heuristic: a behavior is a supplement when its icon is "pill". */
export function isSupplement(it: TimelineItem): boolean {
  return it.icon === "pill";
}

/**
 * Walk a block's items in render order; collapse any run of 2+
 * consecutive supplements into one RowGroup. Why 2+ and not 3+: at
 * 6 supplements the user explicitly asked for grouping; at 4 it's
 * still cluttered; at 2 it's still cleaner-than-spread. Below 2,
 * collapsing is just hiding a single row, which makes the
 * affordance feel pointless.
 *
 * Important: this preserves the order of items. We don't pull
 * supplements out of their position — if the user sorted their
 * timeline such that Vitamin D sits between two non-supplements,
 * we honor that and don't artificially regroup.
 */
export function groupBlockItems(items: TimelineItem[]): RowGroup[] {
  const out: RowGroup[] = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (isSupplement(it)) {
      // Walk forward as long as the next item is also a supplement.
      let j = i + 1;
      while (j < items.length && isSupplement(items[j])) j++;
      const run = items.slice(i, j);
      if (run.length >= 2) {
        out.push({ kind: "supplements", items: run });
      } else {
        out.push({ kind: "item", item: run[0] });
      }
      i = j;
    } else {
      out.push({ kind: "item", item: it });
      i++;
    }
  }
  return out;
}
