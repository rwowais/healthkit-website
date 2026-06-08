import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { adminClient, userClient, makeEmail } from "./lib/supa";

/**
 * Live proof that account deletion actually erases the user's data. Uses a
 * throwaway user created just for this test (so it doesn't disturb A/B), then
 * calls the same delete_my_account RPC the app's Delete Account button uses.
 * If the RPC ever fails to delete the auth user, the EMAIL_PREFIX teardown
 * still cleans it up.
 */
test.describe("account deletion — live backend", () => {
  test("delete_my_account removes the user's data row", async () => {
    const admin = adminClient();
    const email = makeEmail();
    const password = `E2e!${randomUUID()}`;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(cErr).toBeNull();
    const id = created.user!.id;

    // Give them a data row to delete.
    await admin
      .from("protocolize_state")
      .upsert({ user_id: id, state: { version: 3 } });

    // Sign in AS the user and invoke the deletion RPC (client-side path).
    const u = userClient();
    const { error: sErr } = await u.auth.signInWithPassword({ email, password });
    expect(sErr).toBeNull();
    const { error: rErr } = await u.rpc("delete_my_account");
    expect(rErr).toBeNull();

    // The row must be gone (checked with service-role so RLS can't mask it).
    const check = await admin
      .from("protocolize_state")
      .select("user_id")
      .eq("user_id", id);
    expect(check.error).toBeNull();
    expect(check.data?.length).toBe(0);
  });
});
