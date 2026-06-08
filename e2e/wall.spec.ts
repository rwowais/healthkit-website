import { test, expect } from "@playwright/test";

/**
 * The account wall, against the live stack, signed OUT (default clean
 * context — no stored session). Protected routes must bounce to /auth;
 * public routes must render.
 */
test.describe("account wall — signed out", () => {
  test("protected /today redirects to /auth", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("protected /insights redirects to /auth", async ({ page }) => {
    await page.goto("/insights");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("landing is public and shows the create-account CTA", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("Create your free account", { exact: false })
    ).toBeVisible();
  });

  test("legal pages stay public", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy/);
  });
});
