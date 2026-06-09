import { test, expect } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR, readUsers, signInViaUI } from "./lib/supa";

/**
 * The account-first funnel, against the live stack.
 */

test.describe("funnel — returning (onboarded) user", () => {
  // Reuse user A's captured session (set up in global-setup).
  test.use({ storageState: path.join(AUTH_DIR, "a.json") });

  test("an onboarded account lands on Today and sees the app shell", async ({
    page,
  }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/today/);
    // Shell nav only renders inside the authed app, never on /auth or landing.
    await expect(page.getByRole("navigation").first()).toBeVisible();
  });
});

test.describe("funnel — un-onboarded user", () => {
  test("an account that hasn't finished setup is routed into onboarding (where the trial activates)", async ({
    page,
  }) => {
    const users = readUsers();
    // completedOnboarding:false on this account → the app routes them into the
    // onboarding flow rather than Today. Proves: real login works, the wall
    // lets an authed user through, and routing sends un-set-up users to setup.
    await signInViaUI(page, users.b.email, users.password, "**/onboarding");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
