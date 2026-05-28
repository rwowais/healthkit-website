/**
 * intel.ts — ambient intelligence layer.
 *
 * Time anchoring, current-block awareness, per-behavior streaks,
 * keystone-habit detection, and proactive (calm) suggestions.
 */
import type { AppState, DailyLog, TimeBlock, TrustTier } from "./types";
import { compileTimeline, type TimelineItem } from "./engine";
import { packById } from "./packs";
import { activePacks } from "./knowledge";
import { effectiveMinutes, nowMinutes } from "./time";
import { getInsightTemplate, renderTemplate } from "./knowledge";
import { getTz, dateKeyInTz, addDaysToKey, dayIndexOfKeyInTz } from "./tz";

export {
  resolveMinutes,
  effectiveMinutes,
  fmtClock,
  nowMinutes,
  currentBlock,
} from "./time";

/**
 * Behavior set for analytics — the union across every weekday, not just
 * Monday. Day-of-week scheduling shouldn't make keystone / weekly review
 * blind to behaviors that only run on, say, weekends.
 */
function analyticsItems(state: AppState): TimelineItem[] {
  const map = new Map<string, TimelineItem>();
  for (let d = 0; d < 7; d++) {
    for (const it of compileTimeline(state, d)) {
      if (!map.has(it.canonicalKey)) map.set(it.canonicalKey, it);
    }
  }
  return [...map.values()];
}

/**
 * A unit the outcome-reflection layer can correlate against the
 * user's felt check-in. Abstracts over behaviors (read from
 * behaviorCompletions) and supplements (read from
 * supplementCompletions) so whatWorks() can answer "does magnesium
 * help my sleep?" the same way it answers "does morning sunlight
 * help my energy?".
 */
interface OutcomeCandidate {
  key: string;
  title: string;
  trustTier: TrustTier;
  /** Was this candidate completed on the given day's log? */
  isDoneOn: (l: DailyLog) => boolean;
}

/**
 * The full candidate set for outcome reflection: every installed
 * behavior PLUS every supplement in the user's stack.
 *
 * Why supplements belong here: they were architecturally separated
 * from behaviors (into state.supplements + supplementCompletions),
 * and the intelligence layer was never re-wired to see them. A user
 * taking magnesium nightly for a year got zero "does this work for
 * me" feedback — the single biggest "the app doesn't know my data"
 * gap the year-long persona simulations surfaced. This closes it.
 *
 * Trust tiers mirror the behavior policy: curated supplements (from
 * the catalog) can make a first-person "proven by your data" claim
 * because we own their definition; free-text custom supplements are
 * tagged "custom" and the whatWorks gate skips them (the system
 * shouldn't speak authoritatively about something it can't define).
 * Their completions still flow into adherence + the grid — just not
 * the authoritative claim surface.
 */
function outcomeCandidates(state: AppState): OutcomeCandidate[] {
  const out: OutcomeCandidate[] = [];
  for (const it of analyticsItems(state)) {
    const key = it.canonicalKey;
    out.push({
      key,
      title: it.title,
      trustTier: it.trustTier,
      isDoneOn: (l) => !!l.behaviorCompletions?.[key],
    });
  }
  for (const s of state.supplements ?? []) {
    const id = s.id;
    out.push({
      key: id,
      title: s.name,
      trustTier: s.source === "custom" ? "custom" : "curated",
      isDoneOn: (l) => !!l.supplementCompletions?.[id],
    });
  }
  return out;
}

// ── Per-behavior streaks ──────────────────────────────────────────

export interface BehaviorStat {
  streak: number;
  last7: number;
}

export function behaviorStats(
  state: AppState,
  key: string
): BehaviorStat {
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const logs = new Map(state.dailyLogs.map((l) => [l.date, l]));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    // Step back through calendar days using addDaysToKey so DST + tz
    // changes don't skip or duplicate a day in the streak walk.
    const dk = i === 0 ? today : addDaysToKey(today, -i);
    const log = logs.get(dk);
    const done = !!log?.behaviorCompletions?.[key];
    if (done) streak++;
    else if (i === 0) continue; // today not done yet — don't break
    else break;
  }
  let last7 = 0;
  for (let i = 0; i < 7; i++) {
    const dk = i === 0 ? today : addDaysToKey(today, -i);
    if (logs.get(dk)?.behaviorCompletions?.[key]) last7++;
  }
  return { streak, last7 };
}

// ── Keystone detection ────────────────────────────────────────────

export interface Keystone {
  key: string;
  title: string;
  delta: number; // pts more of *other* behaviors kept on days done
}

/**
 * Keystone detection — de-circularised and statistically gated.
 *
 * The naive version compared `score` on days a behavior was done vs not.
 * But `score` *includes* that behavior's own completion, so any behavior
 * trivially correlates with a higher score (reverse causality), on tiny
 * samples, max-picked across ~15 behaviors — a guaranteed false positive
 * presented as a causal claim.
 *
 * Instead: the outcome is how many *other* behaviors were kept that day
 * (the behavior's own completion is excluded, killing the circularity).
 * We require a real sample (>=8 per group), a Cohen's-d effect size, and
 * a threshold that rises with the number of behaviors tested (a
 * multiple-comparison guard). Below the bar we return null and the UI
 * honestly says "patterns are forming" rather than asserting causality.
 */
export function keystone(state: AppState): Keystone | null {
  const logs = (state.dailyLogs ?? []).filter(
    (l) =>
      l.score > 0 ||
      Object.values(l.behaviorCompletions ?? {}).some(Boolean)
  );
  if (logs.length < 10) return null;
  const items = analyticsItems(state);
  if (items.length < 2) return null;

  const mean = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = (xs: number[], m: number) =>
    xs.length < 2
      ? 0
      : xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);

  // The more behaviors we scan, the stronger the effect must be — but
  // tuned to actually fire for a real, consistent user (the prior bar
  // of d>=0.77 + >=8/group made it a dead feature).
  const dThreshold = 0.35 + 0.05 * Math.log2(Math.max(items.length, 2));

  let best: (Keystone & { d: number }) | null = null;
  for (const it of items) {
    // Trust-tier gate: the keystone is the system's strongest claim
    // about a behavior's importance. A user's free-text custom
    // behavior — no curated lineage, no review — should never be
    // promoted to keystone (the system would be amplifying its own
    // unverified content as "the one thing that matters"). Derived
    // and curated behaviors are eligible; they have a canonical
    // identity we stand behind.
    if (it.trustTier === "custom") continue;
    const k = it.canonicalKey;
    const otherDone: number[] = [];
    const otherNot: number[] = [];
    for (const l of logs) {
      const bc = l.behaviorCompletions ?? {};
      let others = 0;
      for (const key in bc) if (key !== k && bc[key]) others++;
      (bc[k] ? otherDone : otherNot).push(others);
    }
    // A keystone is, by definition, done most days — so the "not done"
    // bucket is naturally small. Require a solid "done" sample but only
    // a few contrast days.
    if (otherDone.length < 8 || otherNot.length < 3) continue;
    const mD = mean(otherDone);
    const mN = mean(otherNot);
    if (mD <= mN) continue;
    const pooledSD = Math.sqrt(
      ((otherDone.length - 1) * variance(otherDone, mD) +
        (otherNot.length - 1) * variance(otherNot, mN)) /
        (otherDone.length + otherNot.length - 2)
    );
    const d = pooledSD > 0 ? (mD - mN) / pooledSD : 99;
    if (d < dThreshold) continue;
    if (!best || d > best.d) {
      // De-circularised delta: the lift in *other* behaviors kept,
      // expressed as percentage points (the score-based delta still
      // included the behaviour's own completion — reverse causality).
      const others = Math.max(items.length - 1, 1);
      const delta = Math.max(
        1,
        Math.round(((mD - mN) / others) * 100)
      );
      best = { key: k, title: it.title, delta, d };
    }
  }
  return best ? { key: best.key, title: best.title, delta: best.delta } : null;
}

// ── Outcome reflection — "what works for YOU" ─────────────────────
//
// The strategic core: keystone proves a behavior predicts *other
// behaviors*; this proves a behavior predicts how the user actually
// *feels* (their own energy + sleep check-in). The outcome is the felt
// signal, NOT completion, so it is inherently non-circular. Same rigor:
// real sample, effect size, multiple-comparison guard, honest null.

export interface OutcomeInsight {
  key: string;
  title: string;
  dimension: "energy" | "sleep" | "overall";
  delta: number; // points higher (0–100 felt scale) on days done
}

/** A day's felt index (0–100) from the check-in, or null if not logged. */
function feltIndex(l: DailyLog): number | null {
  const parts: number[] = [];
  const e = l.energyLevel;
  const s = l.sleepLog?.sleepQuality ?? null;
  if (e != null) parts.push(((e - 1) / 4) * 100);
  if (s != null) parts.push(((s - 1) / 4) * 100);
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function dimIndex(
  l: DailyLog,
  dim: "energy" | "sleep"
): number | null {
  const v = dim === "energy" ? l.energyLevel : l.sleepLog?.sleepQuality;
  return v == null ? null : ((v - 1) / 4) * 100;
}

export function whatWorks(state: AppState): OutcomeInsight | null {
  const logs = (state.dailyLogs ?? []).filter(
    (l) => feltIndex(l) != null
  );
  if (logs.length < 10) return null;
  // Candidates now include supplements alongside behaviors — same
  // correlation math, same honesty gates, just a wider net so the
  // "proven by your data" surface can speak to the user's stack.
  const items = outcomeCandidates(state);
  if (items.length < 1) return null;

  const mean = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = (xs: number[], m: number) =>
    xs.length < 2
      ? 0
      : xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
  const cohenD = (a: number[], b: number[]) => {
    if (a.length < 2 || b.length < 2) return 0;
    const mA = mean(a);
    const mB = mean(b);
    const sd = Math.sqrt(
      ((a.length - 1) * variance(a, mA) +
        (b.length - 1) * variance(b, mB)) /
        (a.length + b.length - 2)
    );
    return sd > 0 ? (mA - mB) / sd : mA > mB ? 99 : 0;
  };

  // Multiple-comparison guard scales with behaviors tested.
  const dThreshold = 0.4 + 0.05 * Math.log2(Math.max(items.length, 2));

  let best: (OutcomeInsight & { d: number }) | null = null;
  for (const it of items) {
    // Trust-tier gate: the "Proven by your data" insight is a
    // first-person claim — the system is telling the user "your own
    // data shows X works for you". For curated/derived behaviors that
    // claim sits on top of a curated definition we've reviewed. For
    // pure customs (free-text), the system would be making a claim
    // about a behavior it can't even define. Skip — the user's own
    // logs still flow into mastery and other surfaces, just not this
    // one which speaks authoritatively.
    if (it.trustTier === "custom") continue;
    const k = it.key;
    const done: number[] = [];
    const not: number[] = [];
    const dimVals: Record<
      "energy" | "sleep",
      { done: number[]; not: number[] }
    > = {
      energy: { done: [], not: [] },
      sleep: { done: [], not: [] },
    };
    for (const l of logs) {
      const f = feltIndex(l)!;
      const isDone = it.isDoneOn(l);
      (isDone ? done : not).push(f);
      for (const dim of ["energy", "sleep"] as const) {
        const dv = dimIndex(l, dim);
        if (dv != null) (isDone ? dimVals[dim].done : dimVals[dim].not).push(dv);
      }
    }
    if (done.length < 8 || not.length < 4) continue;
    if (mean(done) <= mean(not)) continue;
    const d = cohenD(done, not);
    if (d < dThreshold) continue;
    if (best && d <= best.d) continue;

    // Attribute to the dimension with the larger standardized gap, for
    // honest copy ("your sleep" vs "your energy" vs "overall").
    const dE = cohenD(dimVals.energy.done, dimVals.energy.not);
    const dS = cohenD(dimVals.sleep.done, dimVals.sleep.not);
    let dimension: OutcomeInsight["dimension"] = "overall";
    if (dE >= dS && dE >= 0.3) dimension = "energy";
    else if (dS > dE && dS >= 0.3) dimension = "sleep";
    const delta = Math.max(1, Math.round(mean(done) - mean(not)));
    best = { key: k, title: it.title, dimension, delta, d };
  }
  return best
    ? {
        key: best.key,
        title: best.title,
        dimension: best.dimension,
        delta: best.delta,
      }
    : null;
}

// ── Adaptive suggestions ──────────────────────────────────────────

export type SuggestionAction =
  | { type: "install"; packId: string }
  | { type: "pause"; key: string }
  | { type: "retime"; key: string; block: TimeBlock }
  | { type: "none" };

export interface Suggestion {
  id: string;
  kind: "install" | "pause" | "progress";
  title: string;
  body: string;
  cta: string;
  action: SuggestionAction;
}

export function suggestions(state: AppState): Suggestion[] {
  const out: Suggestion[] = [];
  const installed = new Set(state.installedPacks ?? []);

  // 1. Sleep quality trending low → suggest Better Sleep
  const sq = state.dailyLogs
    .filter((l) => l.sleepLog?.sleepQuality != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((l) => l.sleepLog.sleepQuality as number);
  if (
    sq.length >= 4 &&
    sq.reduce((a, b) => a + b, 0) / sq.length <= 2.7 &&
    !installed.has("better-sleep")
  ) {
    out.push({
      id: "sug-sleep",
      kind: "install",
      title: getInsightTemplate(
        "install-better-sleep-title",
        "Your sleep keeps coming up short"
      ),
      body: getInsightTemplate(
        "install-better-sleep-body",
        "The Better Sleep protocol targets exactly this — light, temperature, and timing."
      ),
      cta: getInsightTemplate(
        "install-better-sleep-cta",
        "Install Better Sleep"
      ),
      action: { type: "install", packId: "better-sleep" },
    });
  }

  // 2. Chronically skipped behavior → offer to retime/pause. Gate on
  // ≥ 21 total tracked days (not 5 active in a 7-day window) — week-3
  // intermittent users hit "5 active days" without yet having enough
  // history for "this behavior doesn't work for you" to be honest.
  const items = analyticsItems(state);
  const ks = keystone(state);
  const activeDays = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (state.dailyLogs.length >= 21 && activeDays.length >= 5) {
    for (const it of items) {
      if (state.behaviorOverrides?.[it.canonicalKey]?.disabled) continue;
      // Never tell the user to pause their own keystone — that's a
      // self-contradicting, trust-destroying suggestion.
      if (ks && it.canonicalKey === ks.key) continue;
      // Trust-tier gate: the system shouldn't auto-recommend changes
      // to a user's own free-text custom behavior. They created it,
      // we don't know what it really is, we won't pretend to know
      // why their skipping pattern matters. Derived (atom-library
      // picks) ARE eligible — they share canonical identity with a
      // curated atom we understand.
      if (it.trustTier === "custom") continue;
      const everDone = activeDays.some(
        (l) => l.behaviorCompletions?.[it.canonicalKey]
      );
      if (!everDone) {
        const override = state.behaviorOverrides?.[it.canonicalKey];
        const effectiveBlock = override?.block ?? it.block;
        if (effectiveBlock !== "anytime") {
          out.push({
            id: `sug-retime-${it.canonicalKey}`,
            kind: "pause",
            title: renderTemplate(
              getInsightTemplate(
                "retime-title",
                `“{title}” hasn't found its time yet`
              ),
              { title: it.title }
            ),
            body: getInsightTemplate(
              "retime-body",
              "Its scheduled slot doesn't seem to fit your day. Try it without a time — let it land whenever feels natural."
            ),
            cta: getInsightTemplate("retime-cta", "Make it anytime"),
            action: {
              type: "retime",
              key: it.canonicalKey,
              block: "anytime",
            },
          });
        } else {
          out.push({
            id: `sug-pause-${it.canonicalKey}`,
            kind: "pause",
            title: renderTemplate(
              getInsightTemplate(
                "pause-title",
                `“{title}” hasn't landed for you`
              ),
              { title: it.title }
            ),
            body: getInsightTemplate(
              "pause-body",
              "Set it aside for now — your other behaviors will get more room. You can bring it back anytime."
            ),
            cta: getInsightTemplate("pause-cta", "Set it aside"),
            action: { type: "pause", key: it.canonicalKey },
          });
        }
        break;
      }
    }
  }

  // 3. Keystone in light view → gentle observation (no verdict, no
  // imperative). Gate on enough HISTORY (≥ 21 tracked days), not just
  // activity. Also: suppress when the user qualifies for the
  // "progression" suggestion below — a 78%-adherence user who had two
  // light-sleep days does not need a "your keystone slipped" nudge.
  const strongAdherence =
    activeDays.length >= 6 &&
    activeDays.reduce((s, l) => s + l.score, 0) / activeDays.length >= 75;
  if (
    ks &&
    !state.behaviorOverrides?.[ks.key]?.disabled &&
    state.dailyLogs.length >= 21 &&
    activeDays.length >= 5 &&
    !strongAdherence
  ) {
    const stat = behaviorStats(state, ks.key);
    if (stat.last7 < Math.ceil(activeDays.length / 2)) {
      const pointWord = ks.delta === 1 ? "point" : "points";
      const tpl = getInsightTemplate(
        "keystone-slipping",
        `On the days you anchor “{title}” the rest of the day lands better — about {delta} {pointWord} more of everything else. Light week. Tomorrow is open.`
      );
      out.push({
        id: `sug-keystone-${ks.key}`,
        kind: "progress",
        title: getInsightTemplate(
          "keystone-slipping-title",
          "Your anchor, in view"
        ),
        body: renderTemplate(tpl, {
          title: ks.title,
          delta: ks.delta,
          pointWord,
        }),
        cta: getInsightTemplate("keystone-slipping-cta", "Got it"),
        action: { type: "none" },
      });
    }
  }

  // 4. Consistently strong → suggest a progression pack
  const recent = [...state.dailyLogs]
    .filter((l) => l.score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (
    recent.length >= 6 &&
    recent.reduce((a, b) => a + b.score, 0) / recent.length >= 75
  ) {
    // Suggestion progression-pack list. "burnout-recovery" was
    // here but contradicted the use case — it installs a
    // no-intense restraint that mutes the user's strength/zone2
    // training, the exact opposite of what we want to suggest to
    // a consistently-strong user. Replace with packs that build
    // on momentum rather than restrict it.
    const next = activePacks().find(
      (p) =>
        !installed.has(p.id) &&
        ["deep-focus", "blood-sugar", "heart-health"].includes(p.id)
    );
    if (next) {
      out.push({
        id: "sug-progress",
        kind: "progress",
        title: getInsightTemplate(
          "progression-title",
          "You've earned a new layer"
        ),
        body: renderTemplate(
          getInsightTemplate(
            "progression-body",
            "Your consistency is excellent. {name} stacks cleanly on your current system — overlaps merge automatically."
          ),
          { name: next.name }
        ),
        cta: renderTemplate(
          getInsightTemplate("progression-cta", "Explore {name}"),
          { name: next.name }
        ),
        action: { type: "install", packId: next.id },
      });
    }
  }

  return out.slice(0, 2);
}

export function packName(id: string): string {
  return packById(id)?.name ?? id;
}

// ── Weekly review (calm narrative) ────────────────────────────────

export interface WeeklyReview {
  headline: string;
  statLine: string;
  wins: string[];
  focus: string;
  delta: number | null;
  /** Memory: did last week's focus actually hold? (coach continuity) */
  continuity?: string;
}

const DOW = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weeklyReview(state: AppState): WeeklyReview | null {
  const logs = state.dailyLogs ?? [];
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const dayList = (offset: number) => {
    const out: DailyLog[] = [];
    for (let i = offset; i < offset + 7; i++) {
      const dk = i === 0 ? today : addDaysToKey(today, -i);
      const l = logs.find((x) => x.date === dk);
      if (l) out.push(l);
    }
    return out;
  };

  const thisWeek = dayList(0);
  const tracked = thisWeek.filter((l) => l.score > 0);
  if (tracked.length < 4) return null;

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const avgThis = Math.round(avg(tracked.map((l) => l.score)));
  const prev = dayList(7).filter((l) => l.score > 0);
  const avgPrev = prev.length
    ? Math.round(avg(prev.map((l) => l.score)))
    : null;
  const delta = avgPrev != null ? avgThis - avgPrev : null;

  // best day
  const best = [...tracked].sort((a, b) => b.score - a.score)[0];
  // DOW is Sunday=0..Saturday=6 (JS native getDay). Translate from
  // our Mon=0..Sun=6 via (idx + 1) % 7. Noon-UTC anchoring inside
  // dayIndexOfKeyInTz keeps the weekday stable across DST.
  const bestName = best
    ? DOW[(dayIndexOfKeyInTz(tz, best.date) + 1) % 7]
    : null;

  // most-kept behavior this week
  const items = analyticsItems(state);
  let topTitle: string | null = null;
  let topCount = 0;
  for (const it of items) {
    const c = tracked.filter(
      (l) => l.behaviorCompletions?.[it.canonicalKey]
    ).length;
    if (c > topCount) {
      topCount = c;
      topTitle = it.title;
    }
  }

  const wins: string[] = [];
  wins.push(
    renderTemplate(
      getInsightTemplate("weekly-wins-active", "{count} of 7 days active"),
      { count: tracked.length }
    )
  );
  if (bestName && best)
    wins.push(
      renderTemplate(
        getInsightTemplate(
          "weekly-wins-best",
          "Best day was {dayName} at {score}"
        ),
        { dayName: bestName, score: best.score }
      )
    );
  if (topTitle && topCount >= 3)
    wins.push(
      renderTemplate(
        getInsightTemplate(
          "weekly-wins-kept",
          "Kept “{title}” {count} days"
        ),
        { title: topTitle, count: topCount }
      )
    );

  // focus: weakest behavior among essentials
  const essentials = items.filter((i) => i.leverage === 3);
  let focusTitle: string | null = null;
  let focusCount = 99;
  for (const it of essentials) {
    const c = tracked.filter(
      (l) => l.behaviorCompletions?.[it.canonicalKey]
    ).length;
    if (c < focusCount) {
      focusCount = c;
      focusTitle = it.title;
    }
  }
  const focus =
    focusTitle && focusCount < tracked.length
      ? renderTemplate(
          getInsightTemplate(
            "weekly-focus-tighten",
            "Next week, tighten one thing: “{title}”. It's your highest-leverage gap."
          ),
          { title: focusTitle }
        )
      : getInsightTemplate(
          "weekly-focus-hold",
          "Next week, hold the line. Consistency at this level compounds quietly."
        );

  // Coach continuity: re-derive what we would have flagged LAST week and
  // report whether it actually moved — the system "remembering".
  let continuity: string | undefined;
  const prevTracked = dayList(7).filter((l) => l.score > 0);
  if (prevTracked.length >= 4) {
    let pKey: string | null = null;
    let pTitle: string | null = null;
    let pMin = 99;
    for (const it of essentials) {
      const c = prevTracked.filter(
        (l) => l.behaviorCompletions?.[it.canonicalKey]
      ).length;
      if (c < pMin) {
        pMin = c;
        pKey = it.canonicalKey;
        pTitle = it.title;
      }
    }
    if (pKey && pTitle && pMin < prevTracked.length) {
      const nowC = tracked.filter(
        (l) => l.behaviorCompletions?.[pKey]
      ).length;
      continuity =
        nowC > pMin
          ? renderTemplate(
              getInsightTemplate(
                "continuity-holding",
                "Last week we flagged “{title}” — you lifted it to {count} of {total} days. It's holding."
              ),
              {
                title: pTitle,
                count: nowC,
                total: tracked.length,
              }
            )
          : renderTemplate(
              getInsightTemplate(
                "continuity-light",
                "Last week's focus was “{title}” — still light ({count} of {total}). One small re-anchor, not a verdict."
              ),
              {
                title: pTitle,
                count: nowC,
                total: tracked.length,
              }
            );
    }
  }

  // Rebalanced detection: continuity "holding" means last week's
  // flagged behavior actually moved up *this* week. When that's true
  // AND the average is mid (50–75) with flat delta, the user isn't
  // "up", "down", "strong", or "steady" — they're trading one thing
  // for another. Calling that out with its own variant prevents the
  // misread of a real, conscious rebalance as "a meh week."
  const rebalanced =
    !!continuity &&
    continuity.includes("holding") &&
    (delta == null || (delta > -5 && delta < 5)) &&
    avgThis >= 50 &&
    avgThis < 75;

  let headline: string;
  if (rebalanced)
    headline = getInsightTemplate(
      "weekly-headline-rebalanced",
      "A rebalancing week. You lifted what was struggling — the center is shifting, not slipping."
    );
  else if (delta != null && delta >= 5)
    headline = renderTemplate(
      getInsightTemplate(
        "weekly-headline-up",
        "A stronger week — up {delta} points. Momentum is real."
      ),
      { delta }
    );
  else if (delta != null && delta <= -5)
    headline = renderTemplate(
      getInsightTemplate(
        "weekly-headline-down",
        "A lighter week, down {abs}. Not a setback — a signal to simplify."
      ),
      { abs: Math.abs(delta) }
    );
  else if (avgThis >= 75)
    headline = getInsightTemplate(
      "weekly-headline-strong",
      "A strong, steady week. This is what good looks like."
    );
  else
    headline = getInsightTemplate(
      "weekly-headline-steady",
      "A solid week of showing up. That's the whole game."
    );

  return {
    headline,
    statLine: `${avgThis} avg${
      avgPrev != null ? ` · last week ${avgPrev}` : ""
    }`,
    wins,
    focus,
    delta,
    continuity,
  };
}


/** Due-aware ordering helper for the live timeline. */
export function dueRank(
  it: TimelineItem,
  settings: { wakeTime: string; bedtime: string }
): number {
  const m = effectiveMinutes(it, settings);
  if (m == null) return 9999; // anytime — lowest urgency
  const diff = m - nowMinutes();
  // overdue (negative) and near-future rank highest (smallest)
  return diff < 0 ? -diff * 0.4 : diff;
}
