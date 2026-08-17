import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, freshState } from "./lib/supa";
import { TRIAL_DAYS } from "../src/lib/entitlements";

/**
 * Completing onboarding activates the reverse trial — the core funnel the wall
 * exists to gate. Drives the REAL onboarding UI, then verifies the trial fields
 * landed in the user's cloud row.
 *
 * Everything derives from TRIAL_DAYS: this spec previously hardcoded "14",
 * which meant changing the trial length made it hang on a button that no
 * longer existed rather than fail with a useful message. It now also asserts
 * the stamped DURATION, not merely that some date was written — the old
 * "premiumTrialEndsAt is truthy" check passed for any length at all.
 */
test(`completing onboarding activates the ${TRIAL_DAYS}-day trial`, async ({
  browser,
}) => {
  const admin = adminClient();
  // Un-onboarded existing row → fast deterministic login → /onboarding.
  const user = await createUser(admin, { state: freshState() });

  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await signInViaUI(page, user.email, user.password, "**/onboarding");

    // Defensive: dismiss the "you've moved timezones?" prompt if it appears.
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();

    // Only step 0 (name) gates "Continue"; the rest have sensible defaults.
    const nameField = page.getByPlaceholder("Your first name");
    await nameField.click();
    await nameField.fill("E2E Tester");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled({
      timeout: 15_000,
    });
    for (let i = 0; i < 10; i++) {
      const finish = page.getByRole("button", {
        name: new RegExp(`Start my ${TRIAL_DAYS} days`),
      });
      if (await finish.isVisible().catch(() => false)) {
        await finish.click();
        break;
      }
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(450); // step transition (AnimatePresence)
    }
    await page.waitForURL("**/today", { timeout: 60_000 });

    // Trial + completed-onboarding must now be persisted to the cloud row.
    const readTrial = async () => {
      const { data } = await admin
        .from("protocolize_state")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();
      const st = (data?.state ?? {}) as {
        settings?: { completedOnboarding?: boolean; premiumTrialEndsAt?: string };
      };
      return st.settings;
    };
    await expect
      .poll(
        async () => {
          const s = await readTrial();
          return Boolean(s?.completedOnboarding && s?.premiumTrialEndsAt);
        },
        { timeout: 60_000, intervals: [1000, 2000, 3000] }
      )
      .toBe(true);

    // ...and it must be TRIAL_DAYS out, not just "some date".
    const settings = await readTrial();
    const days =
      (new Date(settings!.premiumTrialEndsAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 1);
    expect(days).toBeLessThanOrEqual(TRIAL_DAYS);
  } finally {
    await ctx.close();
  }
});
