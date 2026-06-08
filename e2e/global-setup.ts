import { chromium, type FullConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  adminClient,
  env,
  makeEmail,
  onboardedState,
  AUTH_DIR,
  USERS_FILE,
} from "./lib/supa";

/**
 * Provision the two persistent test identities for this run:
 *   A — already onboarded (seeded cloud row) → exercises "returning user → Today"
 *   B — fresh, no state      → exercises "new user → onboarding (trial entry)"
 *
 * Then log A in through the REAL /auth form once and capture the session as
 * storageState, so the authed specs start signed in without re-driving login.
 * No password is typed by a human — the harness generates a throwaway one and
 * uses it here; global-teardown deletes both users (and any orphans) after.
 */
export default async function globalSetup(config: FullConfig) {
  env(); // fail fast + loud if secrets are missing
  const baseURL =
    (config.projects[0]?.use?.baseURL as string) || "http://localhost:3100";

  const admin = adminClient();
  const password = `E2e!${randomUUID()}`;
  const aEmail = makeEmail();
  const bEmail = makeEmail();

  const { data: a, error: aErr } = await admin.auth.admin.createUser({
    email: aEmail,
    password,
    email_confirm: true,
  });
  if (aErr) throw new Error(`createUser A failed: ${aErr.message}`);
  const { data: b, error: bErr } = await admin.auth.admin.createUser({
    email: bEmail,
    password,
    email_confirm: true,
  });
  if (bErr) throw new Error(`createUser B failed: ${bErr.message}`);

  const aId = a.user!.id;
  const bId = b.user!.id;

  // Seed A as an onboarded user (service-role bypasses RLS).
  const { error: seedErr } = await admin
    .from("protocolize_state")
    .upsert({ user_id: aId, state: onboardedState() });
  if (seedErr) throw new Error(`seed A state failed: ${seedErr.message}`);

  // Capture A's authenticated session by logging in through the real UI.
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/auth");
    await page.getByTestId("auth-email").fill(aEmail);
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();
    // Onboarded → the wall lets A straight through to Today.
    await page.waitForURL("**/today", { timeout: 45_000 });
    await page.context().storageState({ path: path.join(AUTH_DIR, "a.json") });
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(
      { password, a: { id: aId, email: aEmail }, b: { id: bId, email: bEmail } },
      null,
      2
    )
  );
}
