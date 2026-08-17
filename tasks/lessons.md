# Lessons

Patterns captured after corrections or recurring friction. Read this at the
start of a session before non-trivial work. Each entry: the trap, then the
rule that prevents it.

## Environment / tooling

- **Bash working directory resets between calls.** `npx tsc` / `npx next build`
  fail with "not the tsc command" / "Couldn't find pages or app" when not in
  the project root. **Rule:** always prefix with
  `cd /Users/rami/Claude/healthkit-website && …` (do not rely on a previous
  `cd` persisting).
- **`rm -rf .next` breaks the running dev/preview server** until it's
  restarted, even though the production build is fine. **Rule:** don't wipe
  `.next` while a preview server is running; if a clean type-check is needed,
  expect to restart the preview afterward.
- **Stale `.next/**/*.ts` validator errors after deleting routes** are build
  artifacts, not source errors. **Rule:** trust `npx next build`; ignore
  `tsc` noise under `.next/` (grep it out).

## Code hygiene

- **`vitest` strips types — it does NOT type-check.** A clean `vitest run`
  says nothing about `tsc`. **Rule:** after the *final* code edit of any
  change, re-run `npx tsc --noEmit` (and `next build` for shippable work)
  BEFORE committing — even if you already ran tsc earlier in the change.
  (Burned once: added `b.customTime` in engine.ts after the last tsc run,
  verified only with vitest, and committed a type error that would fail the
  Vercel build — `customTime` lived on BehaviorOverride/TimelineItem but not
  BehaviorDef.)
- **A renamed table can leave dead references that only break at runtime
  under a specific mode.** `app_states` → `protocolize_state` left both the
  client (`auth.ts`) and the `delete_my_account` RPC pointing at a dropped
  table; invisible in local-only mode, broke account deletion the moment
  cloud sync was on. **Rule:** on a rename, grep ALL surfaces (client +
  SQL functions + RLS) and prefer FK cascade over hand-written deletes.
- **`next build` runs ESLint and fails on unused imports/vars.** **Rule:**
  after removing usage, remove the import in the same edit; tsc-clean is not
  build-clean.
- **`getLogForDate`/empty-log arrays are pre-seeded**, so "length === 0"
  never gates cold-start. **Rule:** gate derived metrics on real engagement
  (`pillarTracked`), never on array length.
- **Never fabricate a metric from defaults.** Absent inputs → `null` →
  empty/cold-start state, never an alarming low score.

## Product / decisions

- Owner wants autonomous execution. Surface plans for approval ONLY for
  expensive/irreversible decisions (schema, data loss, infra, credentials).
- Never create accounts/projects on the owner's behalf (e.g. Supabase) —
  build the abstraction, leave it inert until they provide keys.
- Never run multiple preview/browser-driven agents against the SAME dev
  server at once — they share one localStorage/origin and stomp each
  other's seeds every ~1s, producing false "state desync" findings.
  Run such agents sequentially, or give each its own server/port.
- Bash cwd resets between calls — always `cd /Users/rami/Claude/healthkit-website &&`
  before npx tsc/next/vitest, or they run from the wrong dir.

## Verification (what the preview can and can't prove)

- **Synthetic clicks + the desktop preview CANNOT reproduce iOS touch bugs.**
  `preview_eval`'s `.click()` dispatches a click directly, bypassing the real
  pointerdown→pointerup→browser-synthesized-click path where touch /
  pointer-capture / compositing bugs live; the preview is desktop Chromium,
  not iOS WebKit. Burned: declared an iOS "dead first tap" sheet bug "verified
  fixed" via synthetic clicks when the fix hadn't held on the founder's phone,
  twice. **Rule:** never claim "verified in-browser" for TOUCH/iOS behavior —
  say it needs on-device confirmation, and fix the bug CLASS by construction
  (e.g. keep a sheet's scroll container a SEPARATE element from anything
  transformed/animated/backdrop-blurred) rather than guarding one symptom.
  State + logic bugs (stale React state, wrong sort, NaN) ARE preview-
  verifiable — be precise about which kind you're claiming.
- **When seeding localStorage state for an in-browser check, use a COMPLETE
  AppState shape — a partial hand-rolled object crashes deep helpers.**
  Writing `{..., protocols: {}}` directly to `protocolize-v3` made
  `createEmptyDailyLog` throw `Cannot read properties of undefined (reading
  'filter')` (it does `protocols.sleep.filter(...)` etc.), surfacing as a
  scary `<TodayPage>` ErrorBoundary trace that LOOKED like a regression but
  was pure fixture rot. **Rule:** seed via the app's own
  `getDefaultState()` shape (sleep/exercise/nutrition/supplements pillar
  arrays present), or drive onboarding, rather than hand-authoring a thin
  state object — and when an in-browser error's stack is entirely in code
  you didn't touch + the full vitest suite & build are green, suspect the
  fixture before the change.
- **Verify an agent's finding before editing on it — they over-flag.** A QA
  agent reported "weekday insight uses device tz"; FALSE —
  `new Date("YYYY-MM-DDT00:00:00").getDay()` is tz-invariant for a date
  string (local-midnight parse). Fixing it would have been pure churn. **Rule:**
  read the actual code + reason it through before acting on a subagent's claim.
- **Removing catalog content can silently break a DERIVED list.**
  `curatedSupplementCatalog()` builds the Supplements→Browse list from
  PACKS ∪ STANDALONE_ATOMS; removing the supplement-only packs dropped
  vitamin-d3 + creatine from Browse (I'd told the founder they stayed — wrong).
  **Rule:** when deleting content, grep what reads it downstream (derived/
  dedup-by-key catalogs) and confirm nothing else sourced exclusively from it.
- **Piping vitest through `tail`/`grep` in a gates chain destroys failure
  evidence AND masks the exit code.** The known rare under-load flake recurred
  (2026-07-12: 2 tests failed in a background run, clean on immediate re-run,
  zero code change) and the names were unrecoverable because the command was
  `vitest run | tail -5` — the failure block was discarded and the pipe made
  the chain exit 0. **Rule:** in chained gates commands, run vitest unpiped or
  write its full output to a file; check the summary from the file. If the
  flake recurs with names visible, pin them.
  **ROOT-CAUSED 2026-07-12:** the flake was the 365-day persona sims running
  just under vitest's 5s default timeout — a thermally-throttled machine made
  them 5-10× slower so they timed out en masse (stash A/B proved the
  pre-change tree was equally slow, i.e. code-independent). Fixed structurally:
  vitest.config.ts `testTimeout: 120_000`. If persona tests fail now it's an
  ASSERTION, not wall-clock — treat as real.
- **REPEATED 2026-07-24 — a file added AFTER the last gate run ships unchecked.**
  The `tsc --noEmit` / vitest / build gates for the SEC-1 batch all ran BEFORE
  `supabase/functions/stripe-webhook/index.ts` was written, so a Deno edge
  function (URL imports, `Deno.*` globals) landed in a repo whose tsconfig
  `include` is `**/*.ts`. `next build` stayed green because Next only compiles
  `src/`, so nothing caught it until the next batch's type-check went red with
  8 errors in a file I hadn't touched. The rule to re-run tsc after the FINAL
  edit was already in this file — I broke it by treating "docs + a non-app
  file" as gate-exempt. **Rule:** the gate runs after the LAST write of any
  kind, including SQL, docs-adjacent code, and files the app never imports.
  Non-app code that must not be type-checked by the app config belongs in
  tsconfig `exclude` (done: `supabase/functions`).
- **Long commit messages belong in a file, not in `git commit -m "..."`.** A
  message containing `"<kind>:<id>"` broke zsh quoting (`unmatched "`) and the
  whole commit+push chain failed. **Rule:** for any multi-paragraph message —
  especially one quoting code, generics, or redirection characters — write it
  to a scratchpad file and use `git commit -F <file>`.
- **`git checkout <sha>` for a bisect leaves you DETACHED — commits land on
  nothing.** After A/B-ing a suspected regression across three commits I
  returned with `git checkout -q 79387d9` (a SHA, not `main`), popped the
  stash, and committed Batch 2b onto a detached HEAD; the push reported
  "Everything up-to-date" while `main` sat a commit behind. Recovered with
  `git checkout main && git merge --ff-only <sha>`. **Rule:** end every
  bisect with `git checkout main` (branch name, never a SHA), and treat
  "Everything up-to-date" after a real commit as a red flag — check
  `git status | head -1` for "HEAD detached" before trusting a push.
- **An INLINE `{ timeout }` on a test silently overrides the global config.**
  `shift-and-travel`'s "final reports" case carried `{ timeout: 30_000 }` while
  vitest.config sets 300s — so on a throttled machine it failed as a timeout
  that looked exactly like a regression from the batch in flight. Cost: three
  bisect runs (2b → 2a → T1 → pre-batch) to prove innocence; the same file
  swung 141s–322s run-to-run with IDENTICAL code. **Rules:** (1) when a
  long-running test times out, check for an inline override before suspecting
  your diff; (2) don't put wall-clock overrides on simulation tests —
  correctness is asserted, not timed; (3) the stash A/B against the
  pre-batch commit remains the fastest innocence proof — do it before
  reading any code.
- **I shipped a data-loss regression to prod with all gates green (2026-07-24).**
  647 unit tests, tsc and build were all clean, and I declared the sync track
  "closed". The e2e suite's FIRST run found it: completing a behavior didn't
  persist. Cause — consolidating every `useAppState` instance onto one shared
  object removed an *accidental* protection. A load() that started before the
  user's tap resolved after it, still carrying the pre-edit snapshot; publishing
  that to the shared store wiped the edit for every instance at once. Under the
  old per-instance design the same late load only clobbered its own private
  copy, so the instance the user was touching kept the edit.
  **Three rules:**
  1. **Consolidating duplicated state also consolidates the blast radius of
     every stale write.** Before merging N copies into one, enumerate everything
     that writes asynchronously (initial load, resync, retry) and ask what each
     does when it lands late. Guards that were per-instance (`pendingSave`,
     `saving`) become blind the moment siblings share state.
  2. **Any async producer of shared state must compare-and-swap** — snapshot
     before the await, publish only if unchanged. Exactly the same rule as the
     REL-5 cloud write. "Don't check-then-act" applies to in-memory state too.
  3. **Unit tests cannot catch this class**; only a real browser with real
     timing can. For any change to state/sync/persistence, the e2e suite is
     part of the gate, not an optional extra. `npm test` being green is not
     evidence that a save reaches storage.
  Debugging note that worked: rather than guessing, a throwaway spec that
  clicked once then dumped (UI state, localStorage, pz:pending-sync, the DB row)
  localized it in one run — the flag said "saved" while both stores lacked the
  data, which pointed straight at a stale overwrite rather than a failed write.
- **A "shared state" fix is only real if functional updates resolve against the
  SHARED value.** Two React instances each holding their own copy lose writes
  not because of the copies, but because `setState(prev => …)` receives the
  *instance's* `prev`. Publishing to a shared object without also rebasing the
  updater changes nothing. The fix is one line of intent —
  `applyUpdate(u) → u(currentShared)` — and it's the whole fix (REL-3).
  **Rule:** when consolidating duplicated state, follow the *read* path of the
  updater, not just the write path.
- **When a test proves a fix, also write the test that proves the BUG.** For
  both REL-3 and REL-9 I added a case reproducing the old behaviour (stale
  snapshot wins / union resurrects the deleted item). Without it, a filter that
  silently never matches, or a store that quietly isn't shared, passes just as
  green as a working one. Cheap, and it makes the guard falsifiable.
- **To serialize async work, chain the CALL, not the running promise.**
  `const run = doWork(); chain = chain.then(() => run)` serializes NOTHING —
  `doWork()` is invoked immediately and the chain just waits on something
  already in flight. It must be `const run = chain.then(() => doWork())` so the
  invocation itself is deferred. Burned on the REL-4 cloud-save queue: the
  first version left both saves racing, and because they then raced the
  compare-and-swap, the OLDER document won — the exact bug being fixed. The new
  regression test caught it. **Rule:** when adding a queue, write the test that
  fires two operations without awaiting the first; a queue that isn't really a
  queue passes every single-operation test.
- **Don't chain doc-editing python heredocs with `git commit` in one Bash
  call.** A script that asserts on a text anchor exits non-zero, but
  newline-separated commands after it STILL run — twice a commit/push shipped
  WITHOUT the doc edit the script was supposed to make. **Rule:** make doc
  edits with the Edit tool (fails loudly on a bad anchor) and commit in a
  separate call after confirming the edit landed.
- **`vitest run …; echo "exit: $?"` (esp. as a BACKGROUND command) reports the
  ECHO's exit code, not vitest's** — so a run with 3 failing tests notified
  "exit code 0". Repeated 2026-07-16 after already writing the pipe-masking
  rule above. **Rule:** to get vitest's real status, run it as the LAST command
  with nothing chained after it (`… && ./node_modules/.bin/vitest run <files>`),
  or capture `rc=$?` on its own line and print `$rc` — never `; echo "$?"`
  tacked on. And always write full output to a file so failure NAMES survive;
  a persona failure showing a 120s+ duration + "Test timed out" is wall-clock
  (re-run the file in isolation to confirm), not a real assertion.
- **Inline `{ timeout }` on a test — SECOND occurrence (2026-08-16).** After
  fixing `shift-and-travel.test.ts`, `property-invariants.test.ts` failed the
  same way: 182s against a trailing `120_000` arg while the global budget is
  300s. The tell is a reported timeout number that does NOT match
  `vitest.config.ts`. Run the file alone to confirm (it passed in 12s — the
  182s was contention from the full parallel suite, not slow code). **Rule:**
  the moment a long-running test "times out", grep the file for a trailing
  numeric arg / `{ timeout }` BEFORE suspecting the diff, and delete it rather
  than raising it — the global config already sets the real budget.
- **`toBeHidden()` / "element not found" passes VACUOUSLY on a page that
  hasn't finished loading.** The `hideEncouragement` e2e asserted the card was
  absent and went green — while the seeded state was still being pulled from
  the cloud, so the timeline (and every card) was absent regardless. The
  feature was never exercised. **Rule:** every absence assertion must be
  preceded by a POSITIVE anchor proving the app actually rendered
  (`waitForTimeline()` here). An absence test with no readiness gate is not a
  test.
- **Never shim `Date`/`Date.now()` in a browser context that has a Supabase
  session.** To force "evening" I pinned the clock forward; the next
  `page.reload()` put the access token past `expires_at`, so the app landed on
  `/auth` — and the "dismissal survives reload" assertion passed because the
  card is absent on the SIGN-IN page. A green test proving nothing. Fix: shift
  the WALL CLOCK, not epoch time — pick a timezone where it is currently ~19:xx
  (`Etc/GMT±N`, signs inverted) and leave absolute time alone.
- **This app's clock comes from `settings.timezone`, not the browser.**
  `getTz(settings)` → `dateKeyInTz` / `nowMinutesInTz` drive both the day key
  and the current block, and `onboardedState()` seeds `timezone: "UTC"`. Setting
  only Playwright's `timezoneId` moved the browser to 19:44 while the app still
  read UTC 02:44 ("Good night", next day's date), so the seeded log landed on
  the wrong day and the card never fired. **Rule:** when seeding a
  time-dependent e2e state, write the zone into `settings.timezone` AND match
  the browser's `timezoneId` (the latter only to keep TimezoneSentry quiet).
