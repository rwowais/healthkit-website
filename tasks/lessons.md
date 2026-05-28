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
