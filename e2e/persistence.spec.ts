import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * A completed behavior survives a reload — i.e. it round-trips through the
 * cloud, not just local state.
 */
test("a completed behavior persists across a reload", async ({ browser }) => {
  const admin = adminClient();
  const user = await createUser(admin, { state: onboardedState() });

  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await signInViaUI(page, user.email, user.password, "**/today");

    // The first not-yet-done behavior's complete toggle (aria-label "Mark X done").
    const mark = page.getByRole("button", { name: /^Mark .+ done$/ }).first();
    await mark.waitFor({ state: "visible", timeout: 30_000 });
    const label = (await mark.getAttribute("aria-label")) ?? "";
    const title = label.replace(/^Mark /, "").replace(/ done$/, "");
    await mark.click();

    // Let the debounced save flush, then reload — the cloud row should drive
    // the same behavior to "done" on a fresh render.
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForURL("**/today");
    await expect(
      page.getByRole("button", { name: `${title} — done` })
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await ctx.close();
  }
});
