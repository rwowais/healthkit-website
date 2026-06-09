import { defineConfig, devices } from "@playwright/test";

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
