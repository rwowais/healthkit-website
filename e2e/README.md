# Live end-to-end tests

Full-stack E2E that runs the **real app** against a **real Supabase backend**
and verifies the account wall, the signup funnel, cross-user data isolation
(RLS), and account deletion.

Auth is handled entirely by the harness — no human types a password:
`global-setup` uses a **service-role key (server-side only)** to create
throwaway test users, logs one in through the real `/auth` form to capture a
session, and `global-teardown` deletes every test user afterward (matched by
the `e2e-pw-` email prefix, so it only ever touches test accounts — safe even
in prod).

## What it covers

| Spec | Proves |
|------|--------|
| `wall.spec.ts` | Signed-out visits to `/today`, `/insights` redirect to `/auth`; landing + legal pages stay public. |
| `funnel.spec.ts` | An onboarded account reaches Today; a brand-new account is routed into onboarding (where the trial activates). |
| `data-rls.spec.ts` | A signed-in user reads/writes only their own rows; a second user is denied access to the first's `protocolize_state` and `protocolize_logs`. |
| `deletion.spec.ts` | `delete_my_account` actually removes the user's data row. |

## One-time setup (you)

This is the only manual part — the "a human provisions the account / secrets"
step that the assistant can't do.

0. **Activate the workflow.** The CI file lives at `e2e/ci/e2e.yml` because
   pushing into `.github/workflows/` needs a token with the `workflow` scope
   (mine doesn't). Move it into place once:
   ```bash
   mkdir -p .github/workflows && git mv e2e/ci/e2e.yml .github/workflows/e2e.yml
   git commit -m "Activate e2e workflow" && git push
   ```
   (Or paste its contents into GitHub → Actions → New workflow.) If you'd
   rather I do it, run `gh auth refresh -h github.com -s workflow` and tell me
   — then I can push it to the right place directly.

1. Get each project's keys from the Supabase dashboard
   (Project → Settings → API): the **Project URL**, the **anon** public key,
   and the **service_role** secret key.
2. In GitHub → repo **Settings → Secrets and variables → Actions →
   New repository secret**, add the **prod** project's three values. (No GitHub
   "Environments" needed — plain repository secrets are simpler.)
   - `PROD_SUPABASE_URL`
   - `PROD_SUPABASE_ANON_KEY`
   - `PROD_SUPABASE_SERVICE_ROLE_KEY`
3. *(Optional, later)* To also test against staging on pull requests, add the
   staging project's three as `STAGING_SUPABASE_URL`,
   `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`. The staging
   job auto-skips until these exist.

That's it. From then on:
- **Pushes to `main`** (and manual runs via Actions → e2e → "Run workflow")
  run the suite against **prod** — creating and then deleting throwaway test
  users.
- **Pull requests** run against **staging**, once its secrets are added.

The service-role key is only ever read in Node (setup/teardown + the API-level
specs). It is never inlined into the browser bundle.

## Running locally

```bash
# point at a backend (staging recommended) — do NOT commit these
export NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"

npm run test:e2e            # builds + serves the app, then runs the suite
npx playwright test --ui    # interactive
npx playwright show-report  # last HTML report
```

By default the suite builds and serves the app on `localhost:3100`. If you
already have a server running there, it's reused.
