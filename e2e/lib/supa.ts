import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WebSocket as NodeWebSocket } from "ws";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// supabase-js's createClient eagerly instantiates a Realtime client, which
// needs a WebSocket constructor. Node 20 (the CI runtime) has no global
// WebSocket, so createClient throws "Node.js 20 detected without native
// WebSocket support" — even though this harness never uses realtime. Provide
// one. (Browsers have WebSocket natively, so the app itself is unaffected.)
const g = globalThis as { WebSocket?: unknown };
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = NodeWebSocket;
}

/**
 * Shared E2E helpers. The service-role key is read from the environment and
 * used ONLY here (server-side, in global-setup/teardown and API-level specs).
 * It is never passed to the browser, never inlined into the app bundle, and
 * never logged — consistent with the project rule "NEVER use service_role
 * client-side."
 */

export const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
export const USERS_FILE = path.join(AUTH_DIR, "users.json");
// Distinctive prefix so teardown can find + delete exactly the test users it
// (or a crashed run) created, and nothing else — critical when running in prod.
export const EMAIL_PREFIX = "e2e-pw-";
const DOMAIN = process.env.E2E_EMAIL_DOMAIN || "example.com";
// The app's localStorage key for the whole AppState (src/lib/constants.ts).
export const STORAGE_KEY = "protocolize-v3";

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error(
      "E2E requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "and SUPABASE_SERVICE_ROLE_KEY in the environment. See e2e/README.md."
    );
  }
  return { url, anon, service };
}

/** Service-role client — bypasses RLS. Setup/teardown + admin checks only. */
export function adminClient(): SupabaseClient {
  const { url, service } = env();
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anon client — what a real signed-in user gets. RLS applies. */
export function userClient(): SupabaseClient {
  const { url, anon } = env();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function makeEmail(): string {
  return `${EMAIL_PREFIX}${randomUUID()}@${DOMAIN}`;
}

export type Users = {
  password: string;
  a: { id: string; email: string };
  b: { id: string; email: string };
};

export function readUsers(): Users {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

/**
 * A minimal but valid onboarded AppState. The app's normalize() backfills
 * everything else on load; all the /today guard needs is
 * settings.completedOnboarding === true plus an installed pack.
 */
export function onboardedState() {
  const now = Date.now();
  return {
    version: 3,
    settings: {
      name: "E2E",
      bedtime: "22:30",
      wakeTime: "06:30",
      // Match the CI runner's clock (UTC) so the app's "you've moved
      // timezones?" travel prompt never fires and overlays the UI.
      timezone: "UTC",
      subscriptionStatus: "trial",
      trialStartDate: new Date(now).toISOString(),
      premiumTrialEndsAt: new Date(now + 14 * 86_400_000).toISOString(),
      notificationsEnabled: false,
      weekStartsOn: 1,
      completedOnboarding: true,
      tier: "free",
    },
    installedPacks: ["longevity-foundation"],
    pausedPacks: [],
    customPacks: [],
    behaviorOverrides: {},
    dailyLogs: [],
    biomarkers: [],
    insights: [],
    currentStreak: 0,
  };
}

/**
 * A minimal UN-onboarded state — an account that exists but hasn't finished
 * setup. Seeding user B with this makes its sign-in a fast cloud read instead
 * of racing the cold first-sign-in merge (which once took >45s on prod and
 * flaked the "routed to onboarding" assertion). The behavior under test —
 * completedOnboarding:false ⇒ routed to /onboarding — is identical.
 */
export function freshState() {
  const s = onboardedState();
  return {
    ...s,
    settings: { ...s.settings, completedOnboarding: false },
    installedPacks: [],
  };
}

/**
 * Create a throwaway, email-confirmed test user (service-role) and optionally
 * seed its cloud state row. The `e2e-pw-` email prefix lets global-teardown
 * clean it up afterward.
 */
export async function createUser(
  admin: SupabaseClient,
  opts: { state?: object } = {}
): Promise<{ id: string; email: string; password: string }> {
  const email = makeEmail();
  const password = `E2e!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  const id = data.user!.id;
  if (opts.state) {
    const { error: e2 } = await admin
      .from("protocolize_state")
      .upsert({ user_id: id, state: opts.state });
    if (e2) throw new Error(`seed state failed: ${e2.message}`);
  }
  return { id, email, password };
}

/**
 * Sign in through the REAL /auth form and wait for the expected landing URL.
 * Retries a few times with a generous budget because the first login of a run
 * can eat a prod cold-start (see global-setup notes). Shared by global-setup
 * and the authed specs.
 */
export async function signInViaUI(
  page: Page,
  email: string,
  password: string,
  expectUrl: string | RegExp | ((url: URL) => boolean),
  opts: { attempts?: number; timeout?: number } = {}
): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const timeout = opts.timeout ?? 90_000;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto("/auth");
      await page.getByTestId("auth-email").fill(email);
      await page.getByTestId("auth-password").fill(password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL(expectUrl, { timeout });
      return;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(2000); // brief settle, then retry
    }
  }
  throw new Error(`signInViaUI failed after ${attempts} attempts: ${String(lastErr)}`);
}
