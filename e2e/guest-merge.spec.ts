import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  adminClient,
  createUser,
  signInViaUI,
  onboardedState,
  STORAGE_KEY,
} from "./lib/supa";

/**
 * The promise to existing browser/guest users: signing in for the first time
 * MIGRATES their local data up into the new account (no data loss). We seed a
 * guest AppState in localStorage with a unique marker, create a brand-new
 * account (no cloud row), sign in, and assert the marker lands in the cloud row
 * — i.e. the first-sign-in merge uploaded the guest's data.
 */
test("guest data migrates into a new account on first sign-in", async ({
  browser,
}) => {
  const admin = adminClient();
  const user = await createUser(admin); // NO cloud row → first sign-in merges up
  const marker = `GUEST-${randomUUID()}`;
  const guest = {
    ...onboardedState(),
    settings: { ...onboardedState().settings, name: marker },
  };

  const ctx = await browser.newContext();
  try {
    // Seed the guest cache BEFORE any app script runs, and mark it dirty so the
    // datasource uploads it on first sign-in.
    await ctx.addInitScript(
      ([key, val]) => {
        try {
          localStorage.setItem(key, val);
          localStorage.setItem("pz:pending-sync", "1");
        } catch {}
      },
      [STORAGE_KEY, JSON.stringify(guest)] as [string, string]
    );

    const page = await ctx.newPage();
    await signInViaUI(page, user.email, user.password, /\/(today|onboarding)/);

    // The merge should upload the guest state — the marker name lands in cloud.
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("protocolize_state")
            .select("state")
            .eq("user_id", user.id)
            .maybeSingle();
          return ((data?.state ?? {}) as { settings?: { name?: string } })
            .settings?.name ?? null;
        },
        { timeout: 60_000, intervals: [1000, 2000, 3000] }
      )
      .toBe(marker);
  } finally {
    await ctx.close();
  }
});
