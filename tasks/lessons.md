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
