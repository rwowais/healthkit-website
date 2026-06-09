import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * Cross-device sync — the whole point of accounts. A change made on one
 * "device" shows up on a second device signed into the same account. The
 * second context keeps the SESSION but starts with NO local app state, so it
 * must load the change from the cloud (a real sync, not a local cache hit).
 */
test("a change on one device syncs to a second device", async ({ browser }) => {
  const admin = adminClient();
  const user = await createUser(admin, { state: onboardedState() });

  const ctx1 = await browser.newContext();
  let ctx2;
  try {
    const p1 = await ctx1.newPage();
    await signInViaUI(p1, user.email, user.password, "**/today");
    const mark = p1.getByRole("button", { name: /^Mark .+ done$/ }).first();
    await mark.waitFor({ state: "visible", timeout: 30_000 });
    const title = ((await mark.getAttribute("aria-label")) ?? "")
      .replace(/^Mark /, "")
      .replace(/ done$/, "");
    await mark.click();
    await p1.waitForTimeout(1500); // flush debounced save to cloud

    // Second "device": reuse the SESSION (storageState) but wipe the app-state
    // cache so it must read the change from the cloud, not local.
    const storage = await ctx1.storageState();
    ctx2 = await browser.newContext({ storageState: storage });
    await ctx2.addInitScript(() => {
      try {
        localStorage.removeItem("protocolize-v3");
      } catch {}
    });
    const p2 = await ctx2.newPage();
    await p2.goto("/today");
    await p2.waitForURL("**/today");
    await expect(
      p2.getByRole("button", { name: `${title} — done` })
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await ctx1.close();
    if (ctx2) await ctx2.close();
  }
});
