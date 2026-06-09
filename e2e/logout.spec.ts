import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * Signing out clears the session and re-engages the wall.
 */
test("signing out returns to landing and re-locks the app", async ({
  browser,
}) => {
  const admin = adminClient();
  const user = await createUser(admin, { state: onboardedState() });

  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await signInViaUI(page, user.email, user.password, "**/today");

    await page.goto("/profile");
    await page.getByRole("button", { name: "Sign out" }).click();
    // SupabaseAuth wipes local + navigates to "/" (landing) after sign-out.
    await page.waitForURL((u) => new URL(u).pathname === "/", {
      timeout: 30_000,
    });

    // Wall is back: a protected route now bounces to /auth.
    await page.goto("/today");
    await expect(page).toHaveURL(/\/auth/, { timeout: 30_000 });
  } finally {
    await ctx.close();
  }
});
