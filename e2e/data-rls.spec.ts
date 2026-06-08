import { test, expect } from "@playwright/test";
import { readUsers, userClient } from "./lib/supa";

/**
 * Live proof of the core data-safety guarantee: with a real signed-in session
 * (anon key + the user's JWT — exactly what the browser uses), Row-Level
 * Security lets a user touch only their own rows, and never anyone else's.
 * These talk to the real backend directly (no browser) so they're fast and
 * deterministic.
 */
test.describe("RLS data isolation — live backend", () => {
  test("a user sees only their own state rows, never another user's", async () => {
    const users = readUsers();

    const a = userClient();
    const { error: aErr } = await a.auth.signInWithPassword({
      email: users.a.email,
      password: users.password,
    });
    expect(aErr).toBeNull();

    // A reads protocolize_state → gets its own seeded row, and only its own.
    const own = await a.from("protocolize_state").select("user_id");
    expect(own.error).toBeNull();
    expect(own.data?.length).toBeGreaterThan(0);
    expect(own.data?.every((r) => r.user_id === users.a.id)).toBe(true);

    // B, explicitly querying A's row, gets nothing — RLS blocks it.
    const b = userClient();
    await b.auth.signInWithPassword({
      email: users.b.email,
      password: users.password,
    });
    const cross = await b
      .from("protocolize_state")
      .select("user_id")
      .eq("user_id", users.a.id);
    expect(cross.error).toBeNull();
    expect(cross.data?.length).toBe(0);
  });

  test("a user can write and read back their own daily log", async () => {
    const users = readUsers();
    const a = userClient();
    await a.auth.signInWithPassword({
      email: users.a.email,
      password: users.password,
    });

    const logDate = "2026-01-01";
    const write = await a
      .from("protocolize_logs")
      .upsert({ user_id: users.a.id, log_date: logDate, log: { e2e: true } });
    expect(write.error).toBeNull();

    const read = await a
      .from("protocolize_logs")
      .select("log")
      .eq("user_id", users.a.id)
      .eq("log_date", logDate)
      .single();
    expect(read.error).toBeNull();
    expect((read.data?.log as { e2e?: boolean })?.e2e).toBe(true);

    // And B cannot read A's log either.
    const b = userClient();
    await b.auth.signInWithPassword({
      email: users.b.email,
      password: users.password,
    });
    const cross = await b
      .from("protocolize_logs")
      .select("log_date")
      .eq("user_id", users.a.id);
    expect(cross.error).toBeNull();
    expect(cross.data?.length).toBe(0);
  });
});
