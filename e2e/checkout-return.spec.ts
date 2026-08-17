import { test, expect } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * The post-payment wait — the riskiest ~5 seconds in the product.
 *
 * Stripe redirects the customer back the instant their card clears, but the
 * entitlement is written by the fulfillment WEBHOOK, a separate server-to-server
 * call that can land after the redirect. If the app assumed the redirect meant
 * "paid", a customer who has just been charged would land on a page still
 * showing "Upgrade" — so instead we poll the entitlement row until it appears.
 *
 * This spec simulates that exact race: land on the return URL with NO
 * entitlement row (webhook hasn't fired), assert the honest waiting state, then
 * write the row the way the webhook would and assert the UI flips itself.
 */
test("waits for the webhook, then confirms Premium on its own", async ({
  browser,
}) => {
  const admin = adminClient();
  const user = await createUser(admin, { state: onboardedState() });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  const page = await ctx.newPage();
  try {
    await signInViaUI(page, user.email, user.password, "**/today");

    // Arrive exactly as Stripe's "After payment" redirect would, while the
    // user still has no paid entitlement row.
    await page.goto("/upgrade?checkout=success");

    // Honest waiting state — and critically NOT an upgrade pitch.
    await expect(page.getByText("Confirming your payment…")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Start Premium" })).toHaveCount(
      0
    );

    // Now the webhook lands: service-role write to the entitlements table,
    // the same shape supabase/functions/stripe-webhook upserts.
    const { error } = await admin.from("protocolize_entitlements").upsert({
      user_id: user.id,
      paid_tier: "premium",
      status: "active",
      plan: "annual",
      source: "stripe",
      updated_at: new Date().toISOString(),
    });
    expect(error).toBeNull();

    // The page must notice by itself — no reload, no user action.
    // Regex, not a literal: the UI renders a typographic apostrophe (&rsquo;),
    // so an ASCII "You're" never matches.
    await expect(page.getByText(/You.re Premium/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Go to Today" })).toBeVisible();
  } finally {
    // Leave no paid row behind for the shared project.
    await admin.from("protocolize_entitlements").delete().eq("user_id", user.id);
    await ctx.close();
  }
});
