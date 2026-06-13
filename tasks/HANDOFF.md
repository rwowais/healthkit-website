# HANDOFF — Remaining fixes backlog (written 2026-06-11)

Cold-start context for a fresh session. The repo is at `/Users/rami/Claude/healthkit-website`
(Next.js 16 App Router PWA "Protocolize", all client components; state in localStorage key
`protocolize-v3` + optional Supabase; prod project `vywuajsblqhsxrjgwghr`).

**Read first:** `CLAUDE.md` (owner prefs: autonomous, no permission-asking, test-gated),
`tasks/lessons.md`. Verification gates for EVERY batch:
`source ~/.nvm/nvm.sh && npx tsc --noEmit && ./node_modules/.bin/vitest run && npx next build`
(currently 600 passed | 18 skipped, all clean at HEAD 86ee2fd). Dev server: preview tool
`dev` config in `.claude/launch.json` (autoPort; wraps `start-dev.sh`). In-browser
verification expected for UI changes.

**Full finding details with evidence + fix sketches live in:**
- `tasks/sweep/report.md` — round-1 sweep (76 findings; ~16 highs/mediums fixed, rest open)
- `tasks/sweep/triage.txt` — round-1 one-liners
- `tasks/sweep/round2-dimensions.md` — round-2 findings #1–22 (highs + several mediums fixed)
- `tasks/sweep/round2-dimensions-b.md` — round-2 findings #1–18 (highs + several fixed)

**Hard-won lessons (do not relearn):**
- NEVER mutate user data as a "safety clamp" at load — make READERS immune instead
  (a future-log clamp and a biomarker dedup both destroyed real data; reverted).
- `compileTimeline(state, d)` dayIndex is a WEEKDAY index (Mon=0), NOT "today".
- supabase-js never throws on network failure — always destructure and check `error`.
- Per-day localStorage mirrors keyed on a reactive day key must RE-READ on day flip,
  never write the old state under the new key.
- vitest suite has a rare flake under heavy CPU load (1-in-6 once; never reproduced;
  name uncaptured — if it recurs, capture with `--reporter=verbose` and pin).

---

## BATCH P — PWA / installed-app (5 items) — ✅ COMPLETE (2026-06-11)
Evidence: `tasks/sweep/round2-dimensions.md` #13–#17.
Shipped all 5. Gates green: tsc clean · vitest 600 passed/18 skipped · next build
clean (new `/api/push/rotate` route registered). Guest-reminder note (#15)
verified in-browser (local-only → signedIn=false → note shows, no console errors).
Items #13/#16/#14/#17 are iOS-standalone / production-SW / push-lifecycle and per
`lessons.md` CANNOT be reproduced in desktop-Chromium dev preview — they are
correct-by-construction and need on-device confirmation on the founder's iPhone.
What changed:
- #13 ServiceWorker.tsx: `wasControlled` captured before register; reload only on
  a genuine update, never on first install.
- #16 layout.tsx statusBarStyle → "default" (readable dark-on-light, content below
  the bar) + Shell.tsx header `pt-[env(safe-area-inset-top)]` defense-in-depth.
- #14 sw.js install: parses each precached route's HTML for `/_next/static` assets
  and caches them into STATIC_CACHE → routes hydrate offline, not a dead skeleton.
- #15 new `useSignedIn` hook; profile shows honest "closed-app reminders need an
  account" note when signed out; InstallPrompt copy gates the closed-app claim.
- #17 sw.js `pushsubscriptionchange` handler re-subscribes (VAPID key stamped into
  sw.js by stamp-sw.mjs) → new `/api/push/rotate` route (service-role, keyed by
  old endpoint) updates the row + clears disabled_at. NEEDS the founder's
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `SUPABASE_SERVICE_ROLE_KEY` env to be live.

1. **[MED] iOS installed app: status bar collides with content** (#16) — apple status bar
   is `black-translucent` over the light default theme with no `safe-area-inset-top`
   handling → header under the notch, white-on-white clock. Fix: `viewport-fit=cover` +
   `padding-top: env(safe-area-inset-top)` on the Shell header (both themes), and/or
   statusBarStyle `default`. Files: `src/app/layout.tsx` (meta), `src/components/Shell.tsx`.
2. **[MED] Offline shell is HTML-only** (#14) — after any deploy, routes not re-visited
   online serve cached HTML whose JS/CSS chunks were purged → dead unhydrated skeleton.
   Fix: dedicated precached `/offline` fallback page (self-contained assets) served on
   navigation fetch failure. Files: `public/sw.js` (or its source), SW registration.
3. **[MED] Guest push reminders silently require an account** (#15) — Profile + install
   prompts promise background reminders to everyone; a guest's push subscription is thrown
   away with only console.warn. Fix: honest copy/disabled state for guests ("sign in to get
   reminders when the app is closed"), or local-notification fallback. Files:
   `src/lib/push.ts`, `src/app/profile/page.tsx`, `src/components/InstallPrompt.tsx`.
4. **[MED] First-install forced reload** (#13) — the SW staleness fix's "never fires on
   the very first install" guard is ineffective → every brand-new visitor gets a full-page
   reload seconds into their first session. Files: SW registration component.
5. **[LOW] No `pushsubscriptionchange` handler in sw.js** (#17) — a rotated/expired push
   subscription is disabled server-side on the first 410 and reminders die silently until
   the user reopens the app. Fix: handler that re-subscribes + re-registers.

## BATCH C — Admin/CMS publish robustness — ✅ MOSTLY COMPLETE (2026-06-11)
Evidence: `tasks/sweep/round2-dimensions-b.md` #5–#10.
Gates green: tsc clean · vitest 600 passed/18 skipped · next build clean. All
admin/CMS/Supabase server logic → not preview-verifiable in local-only mode
(verified by types + suite + build; CI staging tests exercise the assembly).
- #5 ✅ assembleBundleFromCMS → `assembleBundleFromCMSResult()` discriminated
  union (ok / unseeded / failed); every query checks `error`; strict
  per-protocol behaviors fetch. publishBundle ABORTS on "failed" (no version
  minted) and only falls back to the catalog when genuinely unseeded. Legacy
  `assembleBundleFromCMS()` kept as a null-returning wrapper for preview callers.
- #6 ⚠️ code-side done (latest() created_at tie-break; publishBundle catches
  the 23505 unique-violation → "someone else just published, refresh"). The
  UNIQUE INDEX is written into `supabase/schema.sql`
  (`cms_publications_version_key`, idempotent) but NOT applied to prod/staging —
  **DEFERRED: owner must run the migration** (schema change). Safe on current
  data (history is already distinct-versioned).
- #7 ⚠️ honest-copy done (`help.ts` behavior.status no longer implies drafts are
  held back). The actual gating is **DEFERRED to owner**: prod has 3 LIVE draft
  supplements (CoQ10 `coq10-ubiquinone-tfgh`, Low-dose melatonin
  `low-dose-melatonin-paqa`, thin `melatonin-e699`) in PUBLISHED protocols
  (daily-essentials, better-sleep). Gating behaviors on status==="published"
  would UN-SHIP them. Belongs with OWNER-GATED CMS cleanup #2 — decide:
  flip those to published (keep shipping) and/or archive the thin melatonin dupe,
  THEN gate. The 3 test-1.x drafts are in an archived protocol (already excluded).
- #8 ✅ Simulate now threads per-source adaptation rules + interactions and runs
  the conflict-mute pass (adapt() gained an optional {rules} override;
  resolveInteractionsWith() added). drafts/builtin/live each previewed faithfully.
- #9 ✅ cms_evidence.summary → BehaviorDef.evidence and published
  cms_explanations(kind=timing) → timingReason, CMS-wins / built-in-fallback,
  wired into the assembly. Admin evidence edits now reach users on publish.
- #10 ✅ cms_protocols `.order("slug")` + adaptation rules secondary `.order("name")`
  → deterministic array order → stable checksum / working "no changes" dedupe.
NOTE: #9 + #10 + evidence wiring shift the assembled checksum, so the FIRST
publish after deploy will show a diff / mint one new version even with no
content edit — expected and self-correcting (admin reviews the diff).

1. **[MED] Transient query failure during Publish silently ships a wrong bundle** (#5) —
   assembleBundleFromCMS treats every failure as "unseeded" (returns null → publishes the
   built-in catalog as a new immutable version) and each enrichment query (config/templates/
   rules/interactions) has swallow-and-continue catches → a blip strips all CMS interactions
   from a published bundle, with a success toast. Fix: discriminated result —
   'failed' (any query errored → ABORT publish with the error) vs 'unseeded' (queries OK,
   zero rows → catalog fallback). Files: `src/lib/cms/authoring.ts:1564-1756`,
   `src/lib/cms/publish.ts:522-534`.
2. **[MED] Draft-status behaviors/protocols ship on Publish** (#7) — `isPublishableBehavior`
   gates only archived + ai_unverified; templates/rules/interactions DO hold drafts back.
   Decide semantics first (check what statuses existing prod rows carry before requiring
   `status === "published"` — could un-ship live content!). Files: authoring.ts.
3. **[MED] Simulate ≠ what publishing ships** (#8) — Simulate runs draft protocols against
   the LIVE intelligence layer and never applies conflict mutes. Fix: run the same
   heal + applyConflictMutes pipeline the runtime uses. Files: admin Simulate path.
4. **[MED] Admin "Evidence & explanations" editor writes rows that never reach users** (#9)
   — published evidence text always comes from the built-in atom. Wire evidence into
   assembleBundleFromCMS (+ heal precedence), or put a deferred banner on the editor.
5. **[MED] bundle_version has no uniqueness** (#6) — concurrent publishes mint duplicate
   versions; 'latest' becomes nondeterministic. Fix: unique constraint via migration
   (CHECK for existing duplicates first — v5/v9 share a checksum but have distinct
   versions). DB change → staging→verify→prod flow like prior migrations.
6. **[LOW] cms_protocols fetched with no ORDER BY** (#10) — protocol order nondeterministic,
   destabilizes the order-sensitive checksum and defeats "No changes" dedupe. Add ORDER BY.

## BATCH S — Sync/lifecycle remaining — ✅ DATA-RISK FIXES DONE (2026-06-11)
Gates green: tsc clean · vitest 602 passed/18 skipped (+2 new epoch tests) ·
next build clean. Cloud-sync paths aren't locally preview-reproducible (need
Supabase + two tabs / a genuine first-sign-in conflict) → verified by types +
unit tests + build. Done:
- #12 ✅ Reset/Delete-account no longer undone by another live tab. Added a
  reset-epoch tombstone in `storage.ts` (`protocolize-reset-epoch`, OUTSIDE the
  pz: namespace so clearAllData's sweep can't wipe it): clearAllData bumps it +
  re-baselines the resetting tab; `captureResetEpoch()` runs at every load();
  `saveState` + both datasource `save()`s refuse to persist/push when the epoch
  has advanced (monotonic `>` compare) and reload onto fresh state. Regression
  tests in storage.test.ts.
- Conflict-modal second-load ✅ `load()` now returns local early when
  `pendingConflict` is set, so a focus/visibility re-load can't silently
  markReconciled + cloud-win while the user's first-sign-in modal is still open.
DEFERRED (design-level, genuinely need owner/architecture decisions — NOT
correctness bugs):
- Guest two-tab last-write-wins: full closure needs an op-log / BroadcastChannel
  design. The storage-event resync already covers the common case.
- Unbounded state-doc growth (round2-b #2, perf): the real fix is Phase 3 of the
  logs split (window dailyLogs out of the state doc → per-day table authoritative
  + date-filtered reads). Touches the hot sync path + history authority → wants a
  deliberate design pass, not a quick patch. ~1.5KB/day; not urgent at current scale.

### Original BATCH S detail (for reference):
1. **[MED] Reset-all / Delete-account undone by another live tab** (round2-b #12) — the
   other tab's in-memory state + debounced save resurrects wiped data locally and pushes
   it to cloud. Needs a reset-epoch/tombstone (e.g. localStorage `pz:reset-epoch` checked
   in useAppState's save/flush + sync). Files: `src/lib/storage.ts` clearAllData,
   `src/hooks/useAppState.ts`.
2. **[KNOWN-OPEN] Guest two-tab last-write-wins narrowed, not closed** — the storage-event
   resync covers the common case; full closure needs an op-log/BroadcastChannel design.
3. **[KNOWN-OPEN] Conflict-modal second-load cloud-wins** (pre-existing) — a load() while
   the first-sign-in conflict modal is open silently markReconciled+cloud-wins
   (`src/lib/datasource.ts` ~758-777). Guard loads while pendingConflict is set.
4. **[DESIGN] Unbounded state-doc growth** (round2-b #2) — ~1.5KB/day forever; whole doc
   upserted per toggle burst, re-downloaded per load (551KB at 1yr). Needs log windowing/
   archival design (per-day logs table already exists — move history out of the doc).

## BATCH R1 — Round-1 leftover mediums — 🔧 IN PROGRESS (2026-06-11)
Gates green: tsc clean · vitest 605 passed/18 skipped (+3 new regression tests) ·
next build clean. DONE this session (5 bugs):
- #214 ✅ Mastery weekend-only override now graduates — masteredKeys overlays
  customPacks + behaviorOverrides daysActive (was catalog-only). Regression test
  in qa-fixes.test.ts (weekend-only override, perfect adherence → graduates).
- #137 ✅ "What's sticking" excludes conflict-muted keys (behaviorAdherence now
  skips conflictMutedKeys) — no more blaming Strength at 0% red while muting it.
- #144 ✅ Recovery banner only claims work was "set aside" when there's demotable
  training (new hasDemotableWork() helper); honest copy for the sleep-only
  persona. baselineAdapt + MODE_DEFAULT_COPY path. 2 regression tests.
- #291 ✅ Per-behavior Reminder toggle replaced with an honest note for "anytime"
  behaviors (no time → can't fire); timed behaviors keep the toggle.
- #263 ✅ "Link it" no longer stores an inconsistent block (block:morning +
  atom's bed anchor). Atom's curated smart timing flows through; only an explicit
  typed time overrides. (Chose this over the evidence's "honor the block toggle"
  fix, which — since the toggle defaults to "morning" — would mis-schedule
  melatonin/magnesium into the MORNING, breaking the smart-timing promise.)
- #109 ✅ PWA app-icon badge force-cleared during first-day soft entry (gated on
  firstDaySoft alongside badgeDisabled) — no red "6" undercutting the calm day-1.
- #116 ✅ /upgrade trial header + price selector gated on billingConfigured: with
  Stripe inert, no "Lock it in so nothing resets" urgency and no unbuyable price
  table next to "coming soon". Verified in-browser (trial + non-trial states).
- #123 ✅ /upgrade VALUE bullet rewritten ("Your intelligence, live") — stops
  selling keystone/weekly-review/suggestions (already free) as paywalled.
- #130 ✅ /upgrade biomarker bullet drops "weight trends" (weight is a range
  marker the engine never reads); names only HRV + resting-HR.
- #207 ✅ Rebuild/essentials no longer block "day complete" on the full supplement
  stack when behaviors drive completion (supplement-only days unchanged). Matches
  the "few essentials, the rest catches up" promise.
DONE (2nd R1 batch, 2026-06-11):
- #200 ✅ Today's Suggestion card suppressed while returning from a gap
  (activeSuggestions returns [] when sig.hasHistory && sig.gapDays>=2) — no more
  pause/install nags from 40-day-stale data under the welcome-back banner.
- #151 ✅ Adaptive banner holds a neutral "Today" read while the check-in is
  half-filled (one of sleep/energy tapped, not acked) — no "Recovery mode / work
  set aside" assertion while the card below still asks the other question.
- #172 ✅ Quiet-hours prefill defaults to the user's sleep window (bedtime/
  wakeTime) not hardcoded 22:00/07:00; copy no longer says "overnight" (works for
  night-shift). resolveReminderMinutes already handled wrap windows.
- #221 = #307 ⚠️ INTERIM done: Reminders Effect 1 only subscribes ALL-days
  behaviors to the day-blind server (push_subscriptions has no weekday), so a
  partial-week behavior no longer gets wrong-day background pings (in-tab path
  still covers it live). FULL fix DEFERRED: add a weekday mask to
  push_subscriptions + send-due weekday check + re-subscribe at day rollover
  (DB migration → owner; also background push is owner-setup-gated on VAPID+cron).
- #186 ✅ TimezoneSentry warns "today's board will step back a day" on a westward
  move (date compare); logged progress preserved. Did NOT fold/re-key logs
  (risky mutation; the reader-immune clamp from the prior HIGH already prevents
  the streak/gap collapse) — per lessons "make readers immune, don't mutate".
- #242 ✅ already resolved earlier — the vacationMode short-circuit (today/page
  ~1003) returns the break surface before StreakFreeze/flame/WeeklyGoal render.
DEFERRED — genuine design-level (schedule-model rework; need owner/design call):
- #158 wake-anchored "morning" routine files under "Evening" for WRAP schedules
  (bed<wake across midnight); #165 night-owl custom blockBoundaries structurally
  impossible for wrap schedules — both need the block/anchor model to understand
  wrap days, not a point fix. #179 night-shift waking period split at midnight
  (day-boundary design). Evidence: report.md #158/#165/#179.
LOWs — IN PROGRESS (report.md lines 428+, ~23 total). DONE (2026-06-11):
- #442 ✅ already fixed by #116 (price selector hidden when !billingConfigured).
- #463 ✅ "Nothing needs easing" normal-mode banner no longer cites a long-term
  biomarker concern as the day's reason (reasons:[] — matches the primed branch).
- #498 ✅ "Day complete" celebration says "Your full stack, taken." for a
  supplement-only day instead of the false "Every behavior, done."
- #505 ✅ Empty-state distinguishes "Nothing scheduled today" (has a real system,
  e.g. weekend-only) from "blank canvas — install a protocol".
- #449 ✅ Profile membership CTA reads "See what Premium adds" (not "Restore full
  intelligence") when billing is inert — no dead-end restore promise.
- #560 ✅ Duplicate notification fixed: sw.js push handler defers to a visible
  tab (the in-tab path already fires a named reminder); comment corrected.
- #574 ✅ Quiet-hours start==end now shows an inline "this window is off" warning
  (inQuietHours returns false for a zero-length window).
DEFERRED — #553 biomarker "low is dangerous" band: needs a CLINICAL threshold
  call, and for this fitness audience a low resting HR is a GOAL (correctly green),
  so a blanket low-caution would false-alarm. BP-specific lows could be flagged if
  the owner wants — leaving as a product/clinical decision.
DONE (2nd LOW batch, 2026-06-11) — gates green: tsc · 607 passed (+2 tests) · build:
- #428 ✅ "Tomorrow's first focus" now compiles TOMORROW's timeline (selDayIdx+1),
  not today's — no mislabel for a day-specific morning behavior.
- #477 ✅ Muted ("Resting today") rows show an honest "no reminder will fire" note
  instead of a lit toggle (Reminders skips muted items).
- #484 ✅ Recovery chip capped below "Good"/"High" on a poor-sleep day (poorSleep
  flag) so it can't read "Good" above a "last night was rough / lighter" banner.
- #491 ✅ TimezoneSentry clears the "Not now" dismiss on return home, so a future
  trip to a previously-dismissed city prompts again.
- #567 ✅ learnedReminderMinutes uses a CIRCULAR median — a midnight-straddling
  behavior learns ~midnight, not the linear ~noon. Regression test in
  time-window.test.ts.
- #595 ✅ Block-label inputs capped (maxLength 18) + truncate on BulkMoveSheet
  buttons and the Today block header — no overflow on a 320px phone.
DONE (3rd/final LOW batch, 2026-06-11) — gates green: tsc · 607 passed · build:
- #456 ✅ biomarkerConcern prefers a recovery marker (HRV/restingHR) in the pick
  so a co-logged non-recovery Watch marker can't suppress the day's ease.
- #470 ✅ "Your next habit" names the source pack ("Add the X pack") and routes
  there; a Library-only atom routes to the custom builder — not a dead pack catalog.
- #512 ✅ Custom builder now has an "Active days" selector (Mon–Sun, all-off
  floored) so weekend-only is expressible AT creation. Verified in-browser.
- #523 ✅ Toggling all active-days off in the BehaviorSheet applies the
  disabled-heal LIVE (daysActive→undefined, disabled:true) so the row shows as
  paused instead of vanishing until reload.
- #530 ✅ saveCustom rewrites `custom:draft:` / `fork:draft:` keys to the real
  pack id — per-pack isolation no longer rests solely on the random suffix.
- #546 ✅ BP lock toast explains "blood pressure counts as two metrics" so the
  free-cap wall has a model.
- #588 ✅ Edit-mode move-menu got aria-orientation + Arrow/Home/End/Escape key
  nav (Tab still works) so the role="menu" semantics aren't an empty promise.
RESOLVED-BY-DESIGN / DEFERRED:
- #435 — free-gets-intel on Today is INTENTIONAL ("peek-don't-hide", the
  business model); the overclaim was the COPY, fixed by #123. No code change.
- #581 — signed-in cross-tab live divergence: DESIGN, same family as the
  deferred guest two-tab LWW (needs BroadcastChannel/storage-event reconcile).
- #553 — biomarker "low is dangerous" band: clinical-threshold call; low resting
  HR is a GOAL for this audience (correctly green). Owner/clinical decision.

═══════════════════════════════════════════════════════════════════════════════
BACKLOG STATUS @ 2026-06-11: ALL actionable items across BATCH P / C / S / R1
(mediums + lows) are DONE and gate-verified (tsc clean · vitest 607 passed/18
skipped · next build clean · key UI verified in-browser). Everything still open
is DEFERRED-WITH-REASON and needs the OWNER:
  1. DB migrations: cms_publications unique index (#6); day-aware push_subscriptions
     schema (#221/#307 — interim shipped).
  2. CMS content decision: draft-behavior gating + flip/archive the 3 live draft
     supplements (#7) — fold into the owner-gated CMS cleanup.
  3. Design-level rework: guest + signed-in cross-tab live reconcile (op-log /
     BroadcastChannel); unbounded state-doc growth Phase-3 log windowing (#2).
  4. Clinical call: biomarker low-band thresholds (#553).
  5. Pre-existing OWNER-GATED (unchanged): Stripe fulfillment; CMS schema columns.
═══════════════════════════════════════════════════════════════════════════════
- PWA app-icon badge shows full pending count on day 1 (contradicts soft entry).
- /upgrade overclaim trio: trial-urgency + dead price selector; "full intelligence layer"
  already free-on-delay; "weight trends" don't drive adaptation. (Copy fixes.)
- "What's sticking" report card shows conflict-muted keystone at 0% in alert-red.
- Recovery-mode banner claims "demanding work set aside" when none installed.
- First check-in tap: banner flips to finished read while card still shows prompt.
- Wake-anchored "morning" routine files under "Evening" for wrap schedules; night-owl
  custom blockBoundaries structurally impossible for wrap schedules.
- Quiet hours default silently drops night-shift overnight reminders (copy inverted).
- Day boundary splits night-shift waking period at midnight (design).
- TimezoneSentry westward "Update" rewinds Today behind logged days (orphaned progress).
- Today's Suggestion card runs on stale pre-gap data, contradicting "ease in" banner.
- Rebuild mode trims behaviors but FULL supplement stack still renders + blocks complete.
- Mastery streak treats weekend-only (override/atom daysActive) behavior as daily —
  can never graduate.
- Background push fires reminders every day (server has no day-of-week dimension) and as
  a generic body — diverges from the day-aware in-tab path.
- "Link it" silently discards the user's picked block when the linked atom's anchor
  disagrees (carry anchor/offset like the free-text path).
- Per-behavior "Reminder" toggle is live+ON on "anytime" behaviors that can never fire.
- StreakFreeze "fires during vacation" class: re-check post-vacation fixes; the freeze
  token edge may remain on supplement-active vacation days.
Remaining round-1 LOWs: lines 295+ of report.md (~23 cosmetic/copy items).

## OWNER-GATED (do not do without the founder's word)
1. **Stripe fulfillment** — task chip "Build Stripe payment fulfillment (webhook → Premium)"
   already exists (task_1644a1bc); CLAUDE.md launch checklist step 3 says DO NOT wire
   Payment Links until this ships. Founder said: waiting, not launching soon.
2. **CMS schema columns + clean re-publish** — add category/time_window/contraindications/
   intensity/days_active/evidence_tier/targets/derived_from to cms_behaviors, backfill from
   code atoms, re-publish (also removes archived "Test Protocol 1" still live in bundle v9
   and the thin melatonin/coq10 keys). Founder must say "go ahead with the CMS migration".

## RESIDUAL / ACCEPTED
- Weekly-review continuity can fabricate memory when the conflict-mute set changes BETWEEN
  weeks (needs historical mute storage) — headline repro fixed via 7-day union.
- backfillBuiltinFields "author set tier explicitly" branch unsatisfiable until the CMS
  evidence_tier column exists (harmless).
- scrubBiomarkers re-keys a future-dated biomarker on a clock-behind device (LOW; value
  preserved, only the date moves; deliberate, unlike logs).
- Round-1 deferred structural: #184 supplement inventory take/undo symmetry; #284 strength
  dose-vs-cadence on 2-pack merge; #264 weekStartsOn inert.
- Audit dimensions never run: intelligence-coherence + cross-device-sync (their lead
  findings were fixed via other agents' findings). Workflow resumable:
  runId wf_dcf9d9ea-9cf, script under the prior session's workflows/scripts/ dir —
  but a fresh targeted review is probably cheaper than resuming.
- E2E Playwright suite requires staging secrets (CI-only; runs nightly).
