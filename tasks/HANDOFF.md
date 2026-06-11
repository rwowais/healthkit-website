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

## BATCH P — PWA / installed-app (5 items, needs live PWA verification)
Evidence: `tasks/sweep/round2-dimensions.md` #13–#17.

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

## BATCH C — Admin/CMS publish robustness (6 items, admin-only exposure)
Evidence: `tasks/sweep/round2-dimensions-b.md` #5–#10.

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

## BATCH S — Sync/lifecycle remaining (design-level, be careful)
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

## BATCH R1 — Round-1 leftover mediums (UX/coherence; evidence in tasks/sweep/report.md)
Worth doing (line numbers refer to report.md sections):
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
