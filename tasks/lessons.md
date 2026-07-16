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
