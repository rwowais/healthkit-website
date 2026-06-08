import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WebSocket as NodeWebSocket } from "ws";
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
      timezone: "America/New_York",
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
