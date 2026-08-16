import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Full-stack live E2E. Builds + serves the real app, pointed at a real
 * Supabase backend (staging or prod, chosen via env in CI), and drives the
 * actual auth wall, funnel, sync, RLS isolation, and account deletion.
 *
 * Auth is handled by the test harness, never by a human: global-setup uses a
 * service-role key (server-side only) to provision throwaway test users and
 * capture a real session; global-teardown deletes every test user afterward.
 *
 * Required env (supplied by CI secrets — see e2e/README.md):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

// Locally, read those from .env.local so a run "just works" after adding the
// key there — which is what e2e/README.md tells you to do. Playwright does NOT
// load .env files itself, and e2e/lib/supa.ts reads process.env directly, so
// without this the harness aborts with "requires …" even though the key is
// sitting in the file. Parsed by hand to avoid a dotenv dependency; real env
// vars (CI secrets) always win.
(() => {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue; // don't override the real environment
    process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const PORT = process.env.E2E_PORT || "3100";
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The data/deletion specs hit a shared live backend with isolated users, so
  // parallelism is safe; serialize a bit in CI to keep output legible.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Generous per-test budget: the heaviest specs do a cold first login (~90s
  // worst case) plus a multi-step UI drive and a DB poll.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    // Pin the BROWSER clock to UTC so the suite behaves the same on a
    // developer's laptop as on the UTC CI runner. The seeded fixtures declare
    // `timezone: "UTC"`; on a machine in any other zone the app correctly
    // raises its "looks like you've moved timezones?" prompt, which overlays
    // the auth form — guest-merge (the one spec that seeds local state BEFORE
    // /auth renders) then never gets a stable Sign-in button to click, and
    // fails with a confusing 3-minute timeout rather than an assertion.
    timezoneId: "UTC",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build + serve the real production app. NEXT_PUBLIC_* are inlined at
    // build time, so the job env (CI secrets) selects which backend the
    // built bundle talks to. Locally, run your own server and this reuses it.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
