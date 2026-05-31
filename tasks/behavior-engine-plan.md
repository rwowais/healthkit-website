# Behavior Engine — Design Plan (workflow output, critic-revised)

## Protocolize — Behavior Intelligence Engine: Build Plan (Revised)

### The one-line summary
We are giving Protocolize the ability to understand how your behaviors affect *each other* — not just whether you did them. Today the app knows "do strength training" and "take a cold plunge." It does **not** know that a cold plunge right after lifting cancels out your muscle gains. This plan builds that knowledge in — as **editable data**, not buried code — and ships it safely on top of everything we already have.

There are four pieces, in priority order:

1. **The Interaction Model** (the centerpiece) — a way to say "behavior A and behavior B interact," with a calm one-line explanation grounded in real research.
2. **Evidence Rank** (your request) — ordering behaviors from strongest to weakest science, honestly, using the labels we already have.
3. **Library Expansion** — a small, deliberate set of high-value behaviors we're missing.
4. **Custom → Atom Matching** — when a user types their own behavior, gently offer to link it to one we already understand, so it gets smart automatically.

This is the revised plan. An independent technical review caught five real problems in the first draft — most importantly that a quarter of the proposed starter content could never actually run, and two cited behavior names didn't exist. Every one of those has been fixed below, and the fixes made the plan *smaller and safer*, not bigger.

---

### What the review changed (and why that's good)

The reviewer read the codebase carefully and was right on the substance. The honest corrections:

- **Supplements don't run through this engine — by design.** The app deliberately routes supplements to their own screen (the "Morning supplements (5)" pill) and explicitly skips them before the intelligence layer ever sees them. Four of the fifteen proposed starter interactions paired *supplements* (omega-3, magnesium, melatonin, vitamin D). They would have been invisible — dead content. **We cut all four from v1** and moved the genuinely useful ones (e.g. "take omega-3 with a fatty meal," "magnesium helps activate vitamin D") to where they belong: the calm timing line on each supplement's own detail card. No engine change, no dead data. A supplement-to-supplement interaction surface is a possible *future* project, named and deferred — not pretended-shipped now.
- **Two behavior names were wrong.** The draft referenced `omega3-am` and `vitamin-d` — neither exists (the real keys are `omega-3` and `vitamin-d3`, and both are supplements anyway, so they're cut). The claim that "every key was verified" was not actually true. We now **add a build-time test that fails the build if any interaction points at a behavior that doesn't exist**, so this class of error can never ship again.
- **One good idea was bolted to the wrong behavior.** "Take omega-3 with a fatty meal" was attached to a breakfast behavior that only exists inside the Jetlag pack — and is itself switched off by intermittent fasting. It would have applied to almost nobody. Cut from the timeline; it lives as static copy on the omega-3 card.
- **No version-number bump.** The draft proposed bumping the content format from version 1 to 2. The app checks that number with *exact* equality, so a bump would make older app installs (and there's a known issue where some installs run stale code) **reject every new update**, and make new installs reject everything published so far. The previous time we added optional content (insight templates, adaptation rules) we did it *without* a bump — that's the proven, safe pattern, and we follow it exactly. We add the new `interactions` list as an optional field, nothing else.
- **A publishing-preview bug, surfaced and folded in.** When an admin authors a behavior in the content system, the publish pipeline silently drops several fields on the way out — including `daysActive` (so a Mon/Wed/Fri behavior would wrongly publish as every-day) — while the "what changed?" preview still *reports* those fields, so it can show a change that won't actually take effect. The draft only fixed two of the dropped fields. **We now map every field the preview tracks**, closing the whole class and making the admin preview honest.
- **A latent safety bug gets its own early, separately-tested phase.** There's a real pre-existing bug: a safeguard meant to stop a user's custom behavior from silently switching off their real training is *not actually wired up* (the code comment claims it is; the code doesn't do it). The draft buried this fix inside the optional matching feature. **We promote it to its own early phase with a dedicated regression test**, so it ships and is verified on its own — even if the matching feature slips.

The architecture the reviewer praised is unchanged: it reuses real seams already in the app, adds a soft/firm distinction that fixes a genuine "all-or-nothing" limitation, and never tears anything down. The spine was sound; we removed the parts that wouldn't run and tightened the honesty.

---

### Why this is achievable without risk

We have already built most of the plumbing. The app merges behaviors, knows their timing, knows which are "trusted," already ships a small hardcoded list of cross-behavior conflicts (9 pairs), and has a versioned content-publishing system (the "bundle"). The code's own comment says a typed interaction engine is the right answer once that list grows — we're at that point. Every database change here is **additive and reversible**: we never delete or rewrite existing data, and the app keeps working byte-for-byte if a change isn't published yet.

---

### 1. The Interaction Model (centerpiece)

**What an interaction is.** A single record that says: *behavior A relates to behavior B in this way, with this strength of evidence, and here's the calm sentence we show the user.* Four relationship types:

- **conflict** — doing both undermines a goal (cold plunge right after lifting blunts muscle growth).
- **timing** — one should land a certain distance from the other or from sleep (hard training finishing a few hours before bed).
- **ordering** — sequence matters within a shared block (lift *first*, then Zone 2).
- **synergy** — they reinforce each other (a morning cold plunge and an evening sauna).

**Scope discipline for v1: behavior-to-behavior only.** Because supplements are intentionally excluded from this engine, **v1 interactions only connect two real timeline behaviors.** Anything involving a supplement is explicitly out of scope until (and unless) we build a supplement-interaction surface. This is stated up front, not discovered later.

**Where it lives (data, not code).** We add one new content table, `cms_interactions`, alongside the existing content tables, and one new optional list on the published bundle (`interactions`) — added the same proven way insight templates and adaptation rules were added, with **no format-version bump**. Each record carries: the two behavior keys, the type, an optional `severity` (soft/firm), an optional time window, an optional `condition` (e.g. only when the user's goal is muscle/strength), the calm `nudge` text, plus `evidenceTier`, `source`, and a `sourceVerifiedBy`/`sourceVerifiedAt` stamp so we can prove a human checked the citation before it shipped. Because it rides the existing bundle, an admin can publish a new interaction with **no code change or redeploy** — the thing we can't do today.

**Where it fires in the engine — three precise, additive seams (no rewrites):**

1. **The existing conflict step** already mutes a behavior when a restraint is active. We generalize it to read interactions from the bundle instead of only the hardcoded pairs, **keeping all 9 hardcoded pairs as a built-in fallback** (zero behavior change when nothing is published). **conflict** with `severity: firm` mutes the behavior (as today); `severity: soft` shows a calm note but does *not* mute — this fixes the "all-or-nothing" limitation.
2. **The existing one-line block note** (it already shows things like "lift first, then Zone 2") becomes data-driven, so **ordering**, **synergy**, and same-block **timing** notes generalize to any admin-authored pair and apply to derived custom behaviors automatically. This note shows **exactly one line per block** today; we keep that as a hard invariant and add a per-day note cap so authored interactions can never stack into noise.
3. **The existing drag-to-move confirm sheet** already quotes a behavior's timing reason when you move it. A **timing** interaction violation (e.g. moving intervals to just before bed) reuses that exact sheet. No new screen.

**Honest scope for v1.** True hour-precise gating ("only mute cold if a lift happened in the last 6 hours, *today*") needs per-day session-time data we don't fully track yet. For v1 we store the *window* in the data (so the explanation is accurate and the model is future-proof), apply **conflict** as the same-day mute we do today, and surface **timing**/**ordering** as calm guidance rather than hard enforcement — the same honest approximation the engine already makes, now with sourced copy and an authorable model underneath.

**The starter set** (in `starterInteractions`) is now **behavior-to-behavior only**. It has two parts: (a) **all 9 existing hardcoded pairs** re-expressed as firm-conflict records, so Phase 1 can prove the timeline is byte-identical across many pack combinations; and (b) a focused set of **new, genuinely-applicable** relationships. Every key in it resolves to a real behavior, checked by the new build-time test.

---

### 2. Evidence Rank (founder request)

**Built entirely on what exists.** Behaviors already carry an `evidenceTier`: `established | emerging | exploratory`, with absent meaning "no specific claim." We do **not** invent a new scale. We:

- **Define a clear order:** Established → Emerging → *Foundational (untiered)* → Exploratory, lowest. The honest choice: an *exploratory* item (NMN, resveratrol, grounding) makes a thin claim and visibly sits last; a *foundational* lifestyle item (walk, hydrate) makes no extraordinary claim and isn't punished below experimental compounds — it sorts neutrally in the middle and shows a calm dash, never a weakness badge.
- **Add one tiny helper** `evidenceRank(tier)` next to the existing `evidenceFraming()` — a single source of truth.
- **Surface it where behaviors actually live.** The catalog you browse is at **/protocols#discover**, and that screen lists *packs*, not individual behaviors — and a pack is a mixed bag of tiers, so "sort the catalog by evidence" isn't well-defined. So we put the tier chip and the evidence sort on the **per-pack behavior list** (the sheet that opens when you tap a pack) and the **atom library picker**, which are genuinely behavior-level. Both show no evidence at all today.
- **Do NOT reorder Today by evidence.** Today stays ordered by time of day. Evidence stays a *passive label* there, plus an optional low-priority tiebreak in Up Next.
- **Up Next tiebreak, inserted carefully.** The Up Next ranker decides on the first differing signal within each priority group. Evidence rank goes in **strictly last in all three groups**, so it can only break a tie between otherwise-identical candidates and can never push an experimental item above an important or time-sensitive one. A unit test locks this in.
- **Handle low evidence honestly:** always labeled ("Experimental"/"Emerging"), always sorted last, **never hidden, never hyped.** Existing calm wording kept verbatim ("treat it as experimental").
- **Coverage pass, done in human-reviewed batches.** Only ~9 of ~121 behaviors are tiered today. We tier the rest **incrementally, with human sign-off per batch**, defaulting anything ambiguous to *foundational* (no claim) rather than a guessed "established." The two behaviors that already carry evidence prose but no tier (morning-sunlight, magnesium-pm) are the obvious first upgrades.

Criteria are grounded in two recognized public standards (Examine.com's A–D bands and the GRADE framework), written into the admin rubric. **A single primary source is not "established"** — that bar requires multiple consistent human trials or genuine consensus, and we apply it honestly (see the tiering note below).

---

### 3. Library Expansion (supporting)

We add only behaviors that clearly *don't* duplicate something already in the catalog, authored in code so they keep their evidence tier and any safety flags:

1. **Consistent sleep–wake time** (sleep regularity) — a distinct, well-supported behavior; we cover sleep *duration* but not *regularity*. *Established* (pending citation check).
2. **Weighted-vest walk / rucking** — combines easy cardio with bone loading; tagged as a workout so it joins the swap/stacking logic. *Emerging* (the longevity/mortality evidence for rucking specifically is thinner than often implied, so it is honestly *emerging*, not *established*).

**Reconsidered, not auto-added:**
- **Protein target** overlaps existing breakfast-protein behaviors *and* the nutrition scorecard's "hit protein target." We add it **only if** it clearly supersedes those (and we reconcile it with the scorecard) — otherwise it's noise. Decision made during the phase, not assumed now.
- **Daily olive oil** is a single food item that fits the "build a practice" model poorly and invites a flood of "eat X" atoms. We ship it as *guidance copy*, not a standalone tracked behavior.

Still deliberately **excluded** as fringe: rapamycin/metformin for healthy adults, NAD+ IVs, exotic compounds.

---

### 4. Custom → Atom Matching

**The insight:** "make a custom behavior smart" is exactly what the app already does when a user picks from the library — it links the custom to a known behavior, which grants it all the intelligence. The only gap is the **free-text** path, which sets no link, so a typed "lifting" behavior is invisible to everything.

**The design (no new engine code):** a deterministic matcher (title/synonym/block/icon scoring — "lift"→strength, "sun"→morning-sunlight) over the existing catalog. On a confident match, show a **calm, optional** confirm: *"This looks like Morning sunlight from our library — link it so the app can time it and learn from it?"* Accepting links it; declining keeps it a pure custom, never penalized. The **confidence threshold is the whole ballgame** — it is set high and tuned against real titles so the prompt never becomes a nag on a core creation flow; below threshold it stays silent.

**Critical safety rule:** linking inherits the target's contraindications and conflicts, so a wrong link could pull a safety gate onto the wrong behavior. **Explicit confirmation is always required, never an auto-link, with extra caution on "avoid"/restraint targets.** This depends on the restraint-whitelist safeguard actually working — which is why we fix that *first*, in its own phase (below), rather than here.

---

### What touches the database (all additive, reversible, RLS-safe)

See `dbChanges` for the full list with risk notes. In short: one new `cms_interactions` table (mirroring the published-readable + admin-write pattern the existing publications table already uses), one new optional `interactions` list on the bundle (**no format-version bump**), and we **map every editable behavior field** in the publish assembler — closing the silent-drop bug (including `daysActive`) and making the publish preview honest, rather than only patching two fields. No destructive migrations; all new fields are optional, so older bundles keep validating.

---

### Build order (smallest first, safety and equivalence first)

The full ordered list is in `phasing`. The spine: **fix the latent restraint-whitelist safety bug first** (its own tested phase); then prove the interaction *data model + engine seam* is byte-identical using **all 9 existing pairs** across many pack combinations; **then** add soft/firm conflict behavior; **then** timing/ordering/synergy notes; **then** evidence rank; **then** the small library additions and matching. Each phase ships independently and is verified with `tsc`, build, and in-browser before the next. **Nothing in the starter set ships until a human has opened every cited URL and confirmed it supports the exact stated effect and direction.**

## Starter interactions
- [established] no-cold-post-lift × cold-plunge-am (conflict) dbChange=False
  - EQUIVALENCE RECORD (1 of 9). Existing hardcoded pair, migrated unchanged: no-cold-post-lift mutes cold-plunge-am. Severity firm. Phase 1 asserts the compiled timeline is byte-identical to today's hardcoded behavior.
  - nudge: You've flagged no cold right after lifting — so we've set the morning plunge aside today.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record, not a new scientific claim
- [established] no-intense × strength (conflict) dbChange=False
  - EQUIVALENCE RECORD (2 of 9). Burnout Recovery's no-intense restraint mutes strength. Severity firm. Migration of existing hardcoded pair.
  - nudge: Your recovery protocol is asking for no intense training today — strength is resting.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] no-intense × zone2 (conflict) dbChange=False
  - EQUIVALENCE RECORD (3 of 9). no-intense mutes zone2. Severity firm. Migration of existing hardcoded pair.
  - nudge: Your recovery protocol is asking for no intense training today — Zone 2 is resting.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] no-intense × vo2max-intervals (conflict) dbChange=False
  - EQUIVALENCE RECORD (4 of 9). no-intense mutes vo2max-intervals. Severity firm. Migration of existing hardcoded pair.
  - nudge: Your recovery protocol is asking for no intense training today — intervals are resting.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] delay-first-meal × protein-breakfast (conflict) dbChange=False
  - EQUIVALENCE RECORD (5 of 9). Fasted Mornings' delay-first-meal mutes protein-breakfast (both leverage 3; restraint wins). Severity firm. Migration of existing hardcoded pair.
  - nudge: You're fasting this morning — the protein breakfast is set aside until your eating window opens.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] delay-first-meal × anchor-meal (conflict) dbChange=False
  - EQUIVALENCE RECORD (6 of 9). delay-first-meal mutes Jetlag's anchor-meal (same 'eat breakfast' semantics). Severity firm. Migration of existing hardcoded pair. NOTE: anchor-meal only exists in the Jetlag pack — kept here purely for equivalence, not promoted as general content.
  - nudge: You're fasting this morning — the destination breakfast is set aside until your eating window opens.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] deload-day × strength (conflict) dbChange=False
  - EQUIVALENCE RECORD (7 of 9). Weekly Recovery Day's deload-day mutes strength on the scheduled day. Severity firm. Migration of existing hardcoded pair.
  - nudge: It's a full deload day — strength is resting so the recovery actually lands.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] deload-day × zone2 (conflict) dbChange=False
  - EQUIVALENCE RECORD (8 of 9). deload-day mutes zone2. Severity firm. Migration of existing hardcoded pair.
  - nudge: It's a full deload day — Zone 2 is resting so the recovery actually lands.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] deload-day × vo2max-intervals (conflict) dbChange=False
  - EQUIVALENCE RECORD (9 of 9). deload-day mutes vo2max-intervals. Severity firm. Migration of existing hardcoded pair. Together these 9 records let Phase 1 assert timeline-identity across pack combos (Burnout; Fasted+Jetlag; Weekly Recovery+Heart Health).
  - nudge: It's a full deload day — intervals are resting so the recovery actually lands.
  - src: existing CONFLICT_PAIRS (engine.ts) — migration record
- [established] cold-plunge-am × strength (conflict) dbChange=True
  - NEW VALUE. Cold-water immersion in the short window right after resistance training can blunt hypertrophy/strength adaptation; delayed cold appears fine. Refines the existing blanket no-cold-post-lift mute into a time-windowed, goal-conditioned relationship (condition: goal muscle/strength). Window stored in data; applied as same-day guidance in v1. SOURCE MUST BE HUMAN-VERIFIED BEFORE SHIP; if the cited meta-analysis cannot be confirmed to support the magnitude, keep the directional claim but soften wording and re-tier.
  - nudge: On lift days, take your cold plunge before training or a few hours after — not right after, where it can dampen the gains you just earned.
  - src: https://pmc.ncbi.nlm.nih.gov/articles/PMC11235606/ (UNVERIFIED — open and confirm before publish)
- [emerging] strength × zone2 (ordering) dbChange=True
  - NEW VALUE. In a shared session, resistance before endurance tends to better protect lower-body strength; separating by hours/days is best. Currently surfaced as a hardcoded English note; this makes it authorable data. Down-tiered to emerging: rests on concurrent-training meta-analysis evidence that is meaningful but not the multiple-RCT-consensus bar for 'established'.
  - nudge: Doing both in one block? Lift first, then add the Zone 2 — or space them out — to protect your strength gains.
  - src: https://pmc.ncbi.nlm.nih.gov/articles/PMC5752732/ (VERIFY before publish)
- [emerging] caffeine-cutoff × wind-down (timing) dbChange=False
  - NEW VALUE. Caffeine close to bed can reduce sleep quantity/quality, sometimes unnoticed. DOWN-TIERED to emerging and NUDGE SOFTENED: the most-cited controlled study tested 0/3/6h, so we no longer assert a specific '8 hours' as established fact — we describe the direction and let the user set their own buffer.
  - nudge: Caffeine can linger longer than people expect — keeping your last cup well before bed helps protect your sleep, even if you don't feel wired.
  - src: https://jcsm.aasm.org/doi/10.5664/jcsm.3170 (VERIFY; supports a 6h effect, not a specific 8–10h cutoff)
- [emerging] alcohol-cutoff × wind-down (timing) dbChange=False
  - NEW VALUE. Evening alcohol tends to fragment sleep and blunt overnight recovery, scaling with dose and proximity to bed. DOWN-TIERED to emerging and SPECIFIC EFFECT-SIZE NUMBERS REMOVED from the nudge (the +3bpm/-7ms figures were study-specific precision presented as general truth).
  - nudge: Alcohol close to bed quietly costs you deep recovery — leaving a few hours before sleep usually shows up as a calmer overnight heart rate.
  - src: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12073130/ (UNVERIFIED 2025-era cite — open and confirm or replace before publish)
- [emerging] vo2max-intervals × wind-down (timing) dbChange=True
  - NEW VALUE. Vigorous intervals very close to bed can delay sleep onset for some people; a few hours' buffer usually resolves it. DOWN-TIERED to emerging: the evening-exercise/sleep literature is mixed (many studies show little harm beyond ~1h), so 'emerging' is the honest tier.
  - nudge: Intervals are stimulating — try to wrap them up a few hours before bedtime so sleep onset stays easy.
  - src: https://www.nature.com/articles/s41467-025-58271-x (UNVERIFIED 2025 cite — open and confirm or replace before publish)
- [emerging] strength × wind-down (timing) dbChange=True
  - NEW VALUE. A hard session ending very close to bed can lengthen sleep onset for some; finishing a few hours earlier avoids it (light evening movement is neutral/helpful). DOWN-TIERED to emerging for the same mixed-literature reason as the intervals pair.
  - nudge: If a hard session lands late, aim to finish a couple of hours before bed so your body has time to wind down.
  - src: https://www.tandfonline.com/doi/full/10.2147/NSS.S388863 (VERIFY before publish)
- [established] morning-sunlight × wind-down (synergy) dbChange=False
  - NEW VALUE. Morning bright light phase-advances the circadian clock, making an earlier, consolidated bedtime feel natural — the morning anchor is what makes the evening wind-down physiologically easy. Circadian phase-advance from morning light is well established; keep established PENDING citation check.
  - nudge: Bright light soon after waking nudges your whole clock earlier — it's what makes your target bedtime feel natural.
  - src: https://pmc.ncbi.nlm.nih.gov/articles/PMC10594521/ (VERIFY before publish)
- [emerging] sauna-pm × strength (synergy) dbChange=False
  - NEW VALUE. Unlike cold, post-exercise heat does not appear to impair hypertrophy and may support adaptation — correcting the misleading 'cold and sauna are equivalent hormesis' framing (their interaction with strength is directionally opposite). Kept emerging and wording softened: the supporting human studies are small/short, so we say 'may' and avoid overclaiming.
  - nudge: Sauna after training is a safe recovery choice and may even help adaptation — no need to keep it away from lifting the way you would with cold.
  - src: https://pmc.ncbi.nlm.nih.gov/articles/PMC12488549/ (UNVERIFIED 2025-era cite — open and confirm or replace before publish)
- [emerging] cold-plunge-am × sauna-pm (synergy) dbChange=False
  - NEW VALUE. A morning cold exposure and an evening sauna are a recognized contrast/hormesis pairing; the app already surfaces this as a hardcoded note, now expressed as authorable data with the caveat to keep cold away from the post-lift window. Combined-protocol RCT evidence is still maturing, so emerging.
  - nudge: A morning cold exposure and an evening sauna can complement each other — just keep the cold away from the window right after lifting.
  - src: https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.660291/full (VERIFY before publish)

## Evidence rank model
EXTEND the existing BehaviorDef.evidenceTier union ('established'|'emerging'|'exploratory'; absent = 'no specific claim') — do NOT invent a new scale. Add ONE pure helper evidenceRank(tier) next to evidenceFraming() in governance.ts as the single source of truth.

ORDER (most -> least evidence): established(0) > emerging(1) > foundational/absent(2, neutral) > exploratory(3, last). Honesty rationale: an 'exploratory' atom (NMN, resveratrol, grounding) makes a thin claim and is de-emphasized below untiered lifestyle atoms; a 'foundational' atom (walk, hydrate) makes no extraordinary claim and is NOT punished below experimental compounds — it sorts neutrally in the middle and shows a calm dash, never a weakness badge.

CRITERIA (types.ts doc comment + one-screen admin rubric, grounded in GRADE + Examine A-D), APPLIED HONESTLY — a single primary source is NOT 'established': established ~= GRADE high / Examine A (MULTIPLE consistent human RCTs or unequivocal consensus — e.g. sleep duration, protein, hydration; UPGRADE morning-sunlight + magnesium-pm here to clear the existing auditOntology 'missing-evidence-tier' warning, pending the same human citation check applied to interactions). emerging ~= GRADE moderate / Examine B-C (meaningful but still-maturing human evidence, OR a real finding resting on a single/small study — cold, sauna, TRE, NSDR, and the down-tiered exercise-timing + caffeine/alcohol-timing interactions). exploratory ~= GRADE low / Examine D (mechanistic/observational/animal-heavy — NMN, resveratrol, spermidine, grounding).

WHERE IT SURFACES (CORRECTED to real surfaces): (1) PER-PACK BEHAVIOR LIST + ATOM-LIBRARY PICKER are the primary surfaces. The browsable catalog at /protocols#discover lists PACKS (activePacks()), and a pack is a mixed-tier bag, so a pack-level 'sort by evidence' is ill-defined and is DROPPED. Instead: render a small calm tier chip per behavior row in the discoverOpen per-pack sheet and in listBehaviorAtoms (both show NO evidence today), reusing the supplements/page.tsx badge style; add an evidence sort only on those behavior-level lists. (2) UP NEXT: add evidenceRank as the STRICTLY LAST comparison in ALL THREE branches of compareUpNext (intel.ts:852-866) — after 'b.lev-a.lev' in tier 0 (NOT before a.diff-b.diff), after 'b.lev-a.lev' in tier 1, and after the final 'b.lev-a.lev' in tier 2 — so it only breaks ties between otherwise-identical candidates and can never reorder overdue/soonest/leverage. Unit test asserts equal-tier/lev/diff orders established before exploratory while differing lev/diff is unaffected. (3) TODAY ordering: UNCHANGED — do NOT add evidence as a sort key in compileTimeline. Evidence stays passive on Today (existing BehaviorSheet evidenceFraming hedge). (4) Adaptive muting / scoring: UNCHANGED — evidenceTier stays presentational, never mutes or down-weights.

HONEST LOW-EVIDENCE HANDLING: always-visible muted chip ('Experimental'/'Emerging'), existing evidenceFraming copy verbatim ('treat it as experimental'), SORTED LAST but NEVER filtered out. Keep leverage ('how much it matters for YOU') and evidenceTier ('how strong the science is') visually + conceptually distinct.

COVERAGE: tier the remaining ~112 untiered atoms in HUMAN-REVIEWED BATCHES with sign-off per batch, driven by the existing auditOntology warning. Default any ambiguous atom to 'foundational' (no claim) — never a guessed 'established'. A wrong tier publishes a wrong scientific claim at scale, so batches are small and reviewed, not one automated sweep.

WHY BUILD ON EXISTING: reuses the live persisted evidenceTier field (no AppState migration; it already persists and propagates through the trust-tier-upgrade merge so derived customs show curated framing), reuses evidenceFraming copy + the admin byEvidenceTier editor, and a matched custom inherits the curated tier via derivedFrom. Net new code = one evidenceRank() helper + a behavior-level Library sort/chip + one strictly-last Up-Next tiebreak line.

## DB changes
- NEW TABLE public.cms_interactions (id uuid pk, a_key text, b_key text, type text check in ('conflict','timing','ordering','synergy'), severity text check in ('soft','firm') default 'soft', gap_hours numeric null, bound jsonb null, condition jsonb null (e.g. {goal:'muscle'}), direction text default 'a_to_b', nudge text, evidence_tier text check in ('established','emerging','exploratory') null, source text null, source_verified_by uuid null, source_verified_at timestamptz null, status text check in ('draft','published','archived') default 'draft', version int default 1, updated_at timestamptz default now(), updated_by uuid). Enable RLS. Mirror the PROVEN cms_publications pattern: 'published readable' = for select using(true) for published rows, plus admin-write (cms_is_admin()). Add to the publishable-table allowlist + cms_publications snapshot allowlist.
  - why: The centerpiece data model: a typed interaction record with severity, time-window, condition, tier, source, AND a human-verification stamp (source_verified_by/at) so no citation ships unchecked. Storing it in a cms_* table lets admins author + publish new relationships with NO code change — impossible today (the 9-pair list is hardcoded in engine.ts). v1 authoring is constrained to behavior-to-behavior keys (supplements are excluded from the engine).
  - risk: Low. Purely additive new table; no existing row touched. Inert until referenced by a published bundle. RLS copies the live cms_publications policy (published-readable, admin-write). Worst case if mis-authored: a bad interaction notes/mutes the wrong behavior — mitigated by severity defaulting to 'soft' (note, not mute), the build-time key-resolution test, the admin Simulate/diff step, and the verification stamp gate before publish.
- BUNDLE: add optional `interactions?: Interaction[]` to KnowledgeBundle (knowledge.ts), include it in bundleChecksum ONLY when non-empty (the existing pattern used for insightTemplates/adaptationRules). DO NOT bump BUNDLE_SCHEMA — it stays 1. assembleBundleFromCMS() reads cms_interactions (published, non-draft) into the array. If a version signal is ever wanted later, change isValidBundle from `x.schema === BUNDLE_SCHEMA` to `x.schema <= BUNDLE_SCHEMA` — but not now.
  - why: Threads interactions through the runtime bundle the engine already reads, keeping the engine pure, offline-capable, and checksum-verified — identical to how adaptationRules work. Critically, NO schema bump: insightTemplates/adaptationRules were added as optional fields without a bump (BUNDLE_SCHEMA is still 1), and isValidBundle uses EXACT equality, so a bump would make stale-service-worker clients (a known live issue) reject every new bundle and make new clients reject all existing v1 publications.
  - risk: Low. Field optional; bundles without it behave exactly as today (engine falls back to the built-in 9 hardcoded pairs). Checksum change guarded by the existing 'only when non-empty' rule, so no prior integrity check breaks. No schema bump = no forward/backward validation breakage.
- ENGINE: generalize the existing conflict reconciliation in shapeTimeline to read interactions from the active bundle, KEEPING all 9 hardcoded CONFLICT_PAIRS as built-in fallback (union, dedup by a_key+b_key+type). conflict severity:'firm' mutes the target (today's behavior); severity:'soft' + timing/ordering/synergy emit calm notes via the existing blockIntelligence()/move-confirm paths, capped at ONE note per block (existing invariant) plus a new per-day note cap. Match by effectiveKey so derived customs participate. SEPARATELY (own phase, see phasing) FIX the unenforced 'official-only restraint' whitelist by gating activeRestraints to bundle/curated-source keys at the call site.
  - why: Reuses the exact seam that already mutes targets, so equivalence with today is provable once the bundle ships the same 9 pairs. Adds severity + positive/ordering/timing relationships. NOTE the engine structurally skips supplements before this seam (isSupplementBehavior, engine.ts:184), so v1 interaction content is behavior-to-behavior only.
  - risk: Low-medium (code, not DB). Mitigated by: built-in 9-pair fallback = byte-identical with no published interactions; deterministic; covered by new tests asserting timeline-identity across pack combos; severity defaults to non-muting; per-block + per-day note caps prevent authored-note noise. The whitelist fix is a tightening verified by its own regression test.
- PUBLISH MAPPING FIX: in assembleBundleFromCMS (authoring.ts:1376-1389), map ALL editable BehaviorDef fields the publish diff already tracks — add evidence_tier, contraindications, daysActive, targets, derivedFrom, timingReason, recommendedBy, evidence, category, intensity — not just the 11 currently mapped. Add the two backing columns: cms_behaviors ADD COLUMN IF NOT EXISTS evidence_tier text check (...) null, and ADD COLUMN IF NOT EXISTS contraindications jsonb null. Document the cms_evidence.tier -> evidenceTier crosswalk (strong->established, moderate->emerging, anecdotal->exploratory).
  - why: Closes the WHOLE silent-drop class the review found, not just two fields. Today the assembler drops daysActive (a real correctness bug — a Mon/Wed/Fri CMS behavior publishes as every-day), targets (breaks avoid-card links), derivedFrom, timingReason, recommendedBy, evidence — while diffBundles BEHAVIOR_FIELDS (publish.ts:124-142) diffs all of them, so the publish PREVIEW can report a phantom 'changed' field the bundle can't carry. Also makes evidence-rank + safety contraindications round-trip for admin-authored behaviors.
  - risk: Very low. Additive nullable columns via idempotent add-if-not-exists (the proven ai_unverified pattern); null = today's behavior. Mapping more fields can only INCREASE fidelity and fix the daysActive correctness bug; it cannot remove an existing behavior. Strictly increases safety coverage (contraindications) and makes the admin diff honest.
- CATALOG (packs.ts, NOT a DB migration): author sleep-regularity (established, pending citation check) and weighted-vest-walk (category:'workout', intensity:'moderate', emerging — rucking mortality evidence is thinner than implied, so honestly emerging). DEFER protein-target unless it clearly supersedes protein-breakfast/break-fast-protein AND is reconciled with nutritionScorecard.hitProteinTarget. Ship olive oil as guidance copy, NOT a tracked atom. Bare canonicalKeys so trustTier resolves 'curated'.
  - why: Fills genuine gaps without duplicating existing atoms or flooding the catalog with single-food items. Authoring in packs.ts (not the CMS) preserves evidenceTier + contraindications regardless of the publish-mapping fix.
  - risk: Very low. packs.ts is version-controlled code, the v0 built-in bundle; new atoms only appear for users who install them. No migration, no existing-data impact. The duplication/noise risk is handled by deferring protein-target and demoting olive oil to copy.

## Phasing
- Phase 0 — Foundations (no user-visible change). Add the Interaction TypeScript type to types.ts; add the optional `interactions` array to KnowledgeBundle WITHOUT bumping BUNDLE_SCHEMA (it stays 1), reusing the non-empty-only checksum guard; add the evidenceRank() helper next to evidenceFraming(); add the build-time test that fails the build if any interaction a_key/b_key does not resolve in buildAtomRegistry(). Ship: tsc + build clean, app byte-identical.
- Phase 1 — Safety fix FIRST (own phase, separately tested). Fix the unenforced official-only restraint whitelist: gate activeRestraints in shapeTimeline to bundle/curated-source keys at the call site. Dedicated regression test asserts a custom with derivedFrom='no-intense' (or 'deload-day') does NOT mute curated strength/zone2/vo2max. Decoupled from matching so it ships even if later phases slip. Ship: tsc + build + targeted test.
- Phase 2 — Interaction seam, prove equivalence across ALL 9 pairs. Generalize shapeTimeline's conflict step to read interactions from the bundle, KEEPING all 9 hardcoded CONFLICT_PAIRS as built-in fallback. Express ALL 9 existing pairs as firm-conflict interaction records and assert compiled-timeline identity across a MATRIX of installed-pack combos (Burnout Recovery; Fasted Mornings + Jetlag Recovery; Weekly Recovery Day + Heart Health). No new conflicts yet. This proves the seam is behavior-preserving for the full set, not just a sample.
- Phase 3 — Interaction model goes live (data-authorable). Create the cms_interactions table (RLS mirroring cms_publications: published-readable + admin-write; allowlists; source_verified_by/at columns). Wire assembleBundleFromCMS to read it. Add severity handling (firm=mute, soft=note) with the one-note-per-block invariant kept and a per-day note cap added. HUMAN-VERIFY every URL in the behavior-to-behavior 'established'/'emerging' starter set (open each link, confirm it supports the exact stated effect and direction; demote or replace any that don't) and stamp source_verified_by/at, THEN ship the highest-confidence conflict/timing ones as a published bundle. Verify in-browser that a published interaction changes the day with no code deploy.
- Phase 4 — Positive + ordering + timing notes. Migrate the hardcoded blockIntelligence notes (lift-first, cold+sauna) to read from interaction data; add the human-verified synergy + ordering starter set (strength->zone2 ordering, morning-sunlight+wind-down, sauna+strength correction, cold+sauna pairing). Wire timing-interaction violations into the existing drag-to-move confirm sheet (reusing its per-behavior reason). NOTE: all four originally-proposed supplement interactions (omega-3, magnesium, melatonin x2) are OUT OF SCOPE here — they target supplements the engine excludes; the useful ones live as static copy on the supplement detail cards instead.
- Phase 5 — Publish-mapping fix + Evidence rank surfaces. Map ALL editable BehaviorDef fields in assembleBundleFromCMS (fixes the daysActive correctness bug + phantom-diff lie); add cms_behaviors.evidence_tier + contraindications columns (additive, idempotent). Add the evidence tier chip + 'Sort: Evidence strength' to the PER-PACK behavior list (discoverOpen sheet) and the atom-library picker (listBehaviorAtoms) — NOT a pack-level catalog sort. Add the strictly-last evidence tiebreak to compareUpNext in all three branches with its unit test. Run the coverage pass tiering the ~112 untiered atoms in HUMAN-REVIEWED BATCHES (upgrade morning-sunlight + magnesium-pm to established; default ambiguous ones to foundational). Do NOT touch compileTimeline/shapeTimeline ordering.
- Phase 6 — Library expansion (curated, de-duplicated). Author sleep-regularity (established, pending citation check) and weighted-vest-walk (emerging, workout) in packs.ts with full metadata. Decide protein-target only if it supersedes the breakfast atoms AND reconciles with nutritionScorecard; ship olive oil as guidance copy, not an atom. Add any behavior-to-behavior interactions they unlock (e.g. weighted-vest-walk into training-stacking). Verify install + timeline + swap flow.
- Phase 7 — Custom->atom matching. Add the deterministic matchAtom() over listBehaviorAtoms/buildAtomRegistry; add the calm, optional 'link this to our library?' confirm in the free-text builder (sets derivedFrom, reusing the library-pick path). Require explicit confirmation, never auto-link, extra caution on restraint targets (now safe because Phase 1 enforces the whitelist). Set the confidence threshold HIGH and tune it against real titles so the prompt never nags; below threshold it stays silent. Each phase: tsc + next build + in-browser verification before the next.

## Critic verdict
DO NOT SHIP AS WRITTEN, but the spine is sound and salvageable. The audit's read of the codebase is unusually accurate: CONFLICT_PAIRS (8 pairs, exact 'past ~15' comment), the checksum non-empty guard, effectiveKey, the cms_* RLS pattern, the ~9/121 tiering gap, and notably the UNENFORCED restraint whitelist are all real and correctly diagnosed. The interaction-model architecture (data-authorable, additive bundle field, soft/firm severity, reuse of blockIntelligence + the timingReason move sheet) is the right design and genuinely deepens the moat. HOWEVER, five high-severity problems block approval: (1) ~27% of the flagship starter set targets supplements the engine structurally excludes, so those interactions can never fire; (2) two cited canonicalKeys do not exist and anchor-meal is mapped to a Jetlag-only, fasting-conflicted behavior, so the 'verified against real keys' claim is false; (3) the BUNDLE_SCHEMA bump breaks bundle validation forward and backward against a known service-worker-staleness issue; (4) assembleBundleFromCMS drops ~8 fields (incl. daysActive) while the diff reports them, so the publish diff can lie; (5) the evidence-honesty bar the plan sets for itself is not met (extrapolated cutoffs, false-precision effect sizes, over-tiered mixed-evidence claims, unverifiable 2025 sources). Required before build: scope v1 to behavior-to-behavior interactions only (defer supplement synergies until a supplement-interaction surface exists); fix the keys and add a build-time registry-resolution test; drop the schema bump (add interactions as an optional field); demote/soften every overstated tier and human-verify every URL; promote the whitelist fix to its own early, separately-tested phase; map ALL behavior fields in assembleBundleFromCMS (or scope the diff). The phasing discipline (prove equivalence first, ship each phase behind tsc+build+browser) is excellent and should be kept, but the Phase 1 equivalence test must cover all 8 existing pairs, not the 2 shown. With these fixes the plan becomes a strong, low-risk, incremental win.
