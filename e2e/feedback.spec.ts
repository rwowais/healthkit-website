import { test, expect } from "@playwright/test";
import {
  adminClient,
  userClient,
  createUser,
  signInViaUI,
  onboardedState,
} from "./lib/supa";
import { acceptanceStamp } from "../src/lib/legal";

/**
 * Profile → "Request a feature" (owner request 2026-08-17).
 *
 * Proves the full journey — open the sheet, type, send — and the two data
 * properties that make the suggestion box safe: the row lands attributed to
 * the sender, and RLS refuses an insert forged under someone else's user_id.
 */
test("feature request lands in the feedback table, attributed correctly", async ({
  browser,
}) => {
  const admin = adminClient();
  // Stamp legal acceptance so the LegalGate banner doesn't overlay the
  // Profile footer where the feedback card lives.
  const user = await createUser(admin, {
    state: {
      ...onboardedState(),
      settings: {
        ...(onboardedState() as { settings: object }).settings,
        ...acceptanceStamp(),
      },
    },
  });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  const page = await ctx.newPage();
  try {
    await signInViaUI(page, user.email, user.password, "**/today");
    await page.goto("/profile");

    const openBtn = page.getByRole("button", { name: "Request a feature" });
    await openBtn.scrollIntoViewIfNeeded();
    await openBtn.click();

    await page.getByLabel("Short title").fill("Zone 2 and HIIT tracking");
    await page
      .getByLabel("Details")
      .fill("Separate cardio zones so the engine can balance hard and easy days.");
    await page.getByRole("button", { name: "Send" }).click();

    // Row lands, attributed to the signed-in user.
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("protocolize_feedback")
            .select("kind, title, body")
            .eq("user_id", user.id)
            .maybeSingle();
          return data?.title ?? null;
        },
        { timeout: 30_000, intervals: [1000, 2000] }
      )
      .toBe("Zone 2 and HIIT tracking");

    // RLS: a signed-in user must NOT be able to file feedback as someone
    // else — a forged user_id is how a suggestion box becomes a spoofing
    // vector ("user X requested we email them at...").
    const other = await createUser(admin, {});
    const sb = userClient();
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    expect(signInErr).toBeNull();
    const { error: forgeErr } = await sb.from("protocolize_feedback").insert({
      user_id: other.id, // not mine
      kind: "feature",
      title: "forged",
    });
    expect(forgeErr).not.toBeNull();
  } finally {
    await admin.from("protocolize_feedback").delete().eq("user_id", user.id);
    await ctx.close();
  }
});
