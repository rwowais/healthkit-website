import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * The legal acceptance banner (LegalGate) — the mechanism both legal pages
 * promise, and the only sound path to changing the Terms/Privacy later.
 *
 * Simulates the exact population that exists in production today: an
 * onboarded account whose settings carry NO legalAcceptedVersion (the fields
 * predate the mechanism). They must see the banner once, and accepting must
 * write the stamp to their CLOUD row — an in-memory acceptance that vanished
 * on the next device would defeat the purpose of recording it.
 */
test("pre-mechanism account is asked once; acceptance persists to the cloud row", async ({
  browser,
}) => {
  const admin = adminClient();
  // onboardedState() has completedOnboarding: true and no legal fields —
  // exactly a pre-2026-08-17 account.
  const user = await createUser(admin, { state: onboardedState() });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  const page = await ctx.newPage();
  try {
    await signInViaUI(page, user.email, user.password, "**/today");

    const banner = page.getByText(/updated our Terms/);
    await expect(banner).toBeVisible({ timeout: 30_000 });

    // The banner links to the actual documents — acceptance without access
    // to what's being accepted is worthless.
    await expect(
      page.getByRole("link", { name: "Terms of Service" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();

    await page.getByRole("button", { name: "I agree" }).click();
    await expect(banner).toBeHidden();

    // The stamp must land in the synced row (version + timestamp).
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("protocolize_state")
            .select("state")
            .eq("user_id", user.id)
            .maybeSingle();
          const s = (data?.state ?? {}) as {
            settings?: {
              legalAcceptedVersion?: number;
              legalAcceptedAt?: string;
            };
          };
          return s.settings?.legalAcceptedVersion ?? null;
        },
        { timeout: 30_000, intervals: [1000, 2000] }
      )
      .not.toBeNull();

    // And it must STAY gone after a reload — the whole point of persisting.
    await page.reload();
    await page.waitForURL("**/today");
    await page.getByText("Good", { exact: false }).first().waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await expect(page.getByText(/updated our Terms/)).toBeHidden();
  } finally {
    await ctx.close();
  }
});
