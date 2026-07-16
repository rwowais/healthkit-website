# Behavior/Protocol Ontology — Analysis & Strengthening Plan
_Written 2026-07-12 from a very-thorough code audit (file:line evidence for every
claim lives in the audit transcript; key cites repeated here)._

**STATUS UPDATE 2026-07-12 — ADVISORY-FIRST v1 BUILT + SHIPPED.** The founder
chose flexibility + gentle intelligence over enforcement. What shipped:
- `evaluatePlacements()` (engine.ts) — pure, read-only evaluator surfacing calm
  placement notes: soft-window drift, violated `gapHours` timing
  (direction-aware), violated ordering. One note per block via
  blockIntelligence step 0; BehaviorSheet's timingOff caption now live.
- `ADVISORY_INTERACTIONS` — 6 built-in soft rules: cold ≤6h post-strength,
  strength-before-zone2 ordering, zinc×caffeine 2h, theanine×caffeine synergy,
  NMN×TMG + NR×TMG synergies. `gapHours`/`direction` finally evaluated.
- 9 soft recommended windows: melatonin, magnesium, glycine, apigenin,
  inositol, ashwagandha, sauna-pm, cold-plunge ×2.
- Stock catalog order fixed (strength wake+5h before zone2 wake+6h); the old
  always-on "lift first" nag became a violation-aware note that disappears
  when the order is right.
- Rules carrying `condition` are SKIPPED everywhere (no runtime gate context —
  a wrong warning is worse than none). Nothing new mutes/moves/blocks; the
  hard layer is unchanged (safety flags, 4 strict windows, 9 restraint pairs).

NOTE: live CMS bundle v10 still carries the OLD zone2/strength offsets — the
next admin Publish (v11) picks up the fixed defaults; until then
longevity-foundation users may see the (accurate) ordering note.

STILL OPEN (next passes): Phase C completion-honesty confirm ·
interaction-aware move-picker warnings at decision time · publish-gate
validation of gap/direction/condition on CMS rows.

_The original analysis + enforcement-lever inventory below is kept for
reference; the "Strengthening plan" phases were superseded by the
advisory-first design above._

## TL;DR for the founder
The app *talks* about behavior relationships far more than it *enforces* them.
Today there are exactly **two** hard mechanisms:
1. **4 strict time-windows** (morning-sunlight, wind-down, screens-off,
   dim-lights) — clamped + move-blocked. The other ~140 atoms can be dragged
   to any time with zero pushback.
2. **9 firm conflict pairs** (e.g. no-intense → strength/zone2/vo2max;
   no-cold-post-lift → cold-plunge) — these MUTE the target for the day.

Everything else — "6h between cold and lifting", "zinc away from coffee",
"lift before Zone 2", "theanine with caffeine" — is either a one-line advisory
note or **pure decoration**: the data model has `timing/ordering/synergy`
interaction types with `gapHours`/`direction`/`condition` fields, but the
engine **never reads them** (verified: gapHours/bound/condition/direction are
consumed nowhere at runtime). You can check off "Wind-down ritual" at 9am;
nothing validates completion time or order.

## Confirmed weaknesses (with the receipts)
- **Dead metadata:** `gapHours`, `bound`, `condition`, `direction` on
  interactions are authored/stored/published but never evaluated
  (engine.ts ~1469-1498 uses them only as dedup identity strings).
- **timing/ordering/synergy types = notes only** (engine.ts ~2214-2227): both
  behaviors present → render nudge text. Never move/mute/reorder.
- **No ordering model at all:** nothing expresses "A before B". sortTimeline is
  clock-order only; anchors are sleep-relative, not behavior-relative.
- **Completion order unvalidated:** toggleBehavior (storage.ts ~777) is a pure
  boolean flip; sauna can be checked before the workout, wind-down at 9am.
- **Missing pairs the copy itself promises:** zinc×coffee ("away from
  coffee/tea" in its own timingReason), zinc×copper, l-theanine×caffeine
  (synergy), NMN/NR×TMG, melatonin×alcohol-cutoff — no interaction rows exist.
- **Evening pharma unprotected:** melatonin, magnesium, glycine, apigenin,
  ashwagandha have no timeWindow → freely movable to morning.
- **cold×strength is a blunt full-day mute,** not the 6h gap its name implies —
  and only if the restraint atom is installed.
- **Bypass holes:** one-offs are injected AFTER the conflict pass;
  ~~applyStacks could rebase a strict-window follower outside its window~~
  ✅ FIXED 2026-07-12 (guard + 3 regression tests in daily-loop.test.ts).
- **Free-text customs evade everything** (namespaced keys never match the
  rule sets); atom-library-derived customs are covered via derivedFrom — good.
- What already works well: strict-window clamp in compileTimeline
  (engine.ts ~386), move-menu/bulk-move forbidden-target guards, snooze
  window guard, swap conflict pre-filter, contraindication suppression via
  safety flags.

## Strengthening plan (proposed — needs founder go)
Design stance: **hard-block only physiology+safety; auto-arrange scheduling
silently; gently push back on user actions** (confirm, don't forbid) — matches
the app's calm ethos.

### Phase A — Make the existing vocabulary REAL (engine work)
1. Enforce `timing` + `gapHours`: when both behaviors are scheduled same day
   and closer than the gap, auto-space the movable one (respect windows);
   if unmovable, firm → mute with honest reason, soft → note. Seams:
   compileTimeline pass + applyConflictMutes generalization
   (engine.ts ~377/~1511).
2. Enforce `ordering`: scheduling comparator ensures aKey's time < bKey's
   (sortTimeline + a compile pass); severity firm = enforced re-order,
   soft = note when violated.
3. Evaluate `direction` + `condition` properly (today they're inert).
4. Route one-offs through the conflict/interaction pass (engine.ts ~533).
5. Interaction-aware move guard: the move menu/BehaviorSheet time picker warns
   ("This puts zinc within an hour of your coffee") — reuse the existing
   `forbidden` predicate pattern (today/page.tsx ~2401, BehaviorSheet ~112).

### Phase B — Enrich the catalog (content, ships as code = tested + versioned)
1. Add **soft evening windows** to the sleep-pharma atoms (melatonin,
   magnesium-pm, glycine, apigenin, ashwagandha, inositol) and sane windows to
   sauna-pm / cold-plunge-am / caffeine-family. Soft = warn-not-block (the
   soft-window path already exists but is dead code — engine.ts ~394).
2. Author the missing built-in interactions (BUILTIN_INTERACTIONS, not CMS,
   so they're unit-tested): zinc×coffee (timing 2h), zinc×copper (note),
   theanine×caffeine (synergy), NMN/NR×TMG (synergy), melatonin×alcohol
   (conflict soft), strength→zone2 same-day (ordering), cold-plunge×strength
   (replace blunt mute with timing gap 6h, keep mute as firm fallback),
   sauna-pm×bedtime handled via window.
3. Publish-gate: extend validateBundleGovernance to reject rows whose
   gap/direction/condition can't be honored (publish.ts ~617).

### Phase C — Completion honesty (gentle)
Out-of-window / out-of-order check-off gets a one-tap confirm ("It's 9:04 —
log 'Wind-down ritual' anyway?"), never a block. Seam: the toggle handler
(today/page.tsx) — data honesty without nagging.

Estimate: A = one solid session · B = one session · C = small.
Rough order of user-visible value: B (windows) → A1/A2 → C → rest.
