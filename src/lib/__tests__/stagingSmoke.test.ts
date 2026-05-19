/**
 * Opt-in authenticated end-to-end smoke against a STAGING Supabase
 * project (never production). Dormant unless STAGING_* env vars exist.
 * Uses the REAL @supabase/supabase-js over the network — catches what
 * the deterministic fake can't: real RLS, real latency, real Supabase.
 *
 * Requires (one-time, in the staging project):
 *  - supabase/schema.sql run (both tables + policies)
 *  - a confirmed QA user (dashboard → Authentication → Add user)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const URL = process.env.STAGING_SUPABASE_URL;
const ANON = process.env.STAGING_SUPABASE_ANON_KEY;
const EMAIL = process.env.STAGING_QA_EMAIL;
const PASSWORD = process.env.STAGING_QA_PASSWORD;
const enabled = !!(URL && ANON && EMAIL && PASSWORD);

// Point the app's Supabase client at STAGING *before* it is imported.
if (enabled) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
}

type DS = typeof import("@/lib/datasource");
type SB = typeof import("@/lib/supabase");

describe.skipIf(!enabled)("staging e2e (real Supabase)", () => {
  let ds: DS;
  let sb: SB;

  beforeAll(async () => {
    ds = await import("@/lib/datasource");
    sb = await import("@/lib/supabase");
    const client = sb.getSupabase();
    if (!client) throw new Error("Supabase client not created (env?)");

    const { error } = await client.auth.signInWithPassword({
      email: EMAIL as string,
      password: PASSWORD as string,
    });
    if (error) {
      throw new Error(
        `Sign-in failed: ${error.message}. Create a CONFIRMED QA user in ` +
          `the staging project (Authentication → Add user).`
      );
    }

    // Precise schema check — clearer than an opaque assertion failure.
    const probe = await client
      .from(sb.STATE_TABLE)
      .select("user_id")
      .limit(1);
    if (probe.error) {
      throw new Error(
        `Table ${sb.STATE_TABLE} not reachable: ${probe.error.message}. ` +
          `Run supabase/schema.sql in the staging project.`
      );
    }
    await ds.activeDataSource.clearRemote(); // clean slate
  }, 30000);

  afterAll(async () => {
    if (!enabled || !ds) return;
    await ds.activeDataSource.clearRemote();
    await sb.getSupabase()?.auth.signOut();
  });

  it("persists across a real cloud round-trip and a resync does not revert", async () => {
    await ds.activeDataSource.load(); // baseline (post clear)

    const onboarded = {
      version: 3,
      settings: { completedOnboarding: true, name: "QA", tier: "free" },
      protocols: { sleep: [], exercise: [], nutrition: [], supplements: [] },
      supplementMeta: {},
      dailyLogs: [],
      biomarkers: [],
      insights: [],
      currentStreak: 0,
      installedPacks: ["longevity-foundation"],
      pausedPacks: [],
      customPacks: [],
      behaviorOverrides: {},
    } as unknown as Parameters<DS["activeDataSource"]["save"]>[0];

    await ds.activeDataSource.save(onboarded);

    // Simulate a toggle, then an immediate resync (the self-clobber case).
    const toggled = {
      ...onboarded,
      dailyLogs: [
        {
          date: "2026-05-19",
          behaviorCompletions: { "morning-sunlight": true },
          score: 50,
          sleepLog: {},
          exerciseEntries: [],
          supplementEntries: [],
          sleepCompletions: [],
          completions: [],
          nutritionScorecard: { customItems: [], note: "" },
        },
      ],
    } as unknown as typeof onboarded;
    await ds.activeDataSource.save(toggled);

    const back = await ds.activeDataSource.load();
    expect(back.settings.completedOnboarding).toBe(true);
    expect(back.dailyLogs.length).toBe(1);
    expect(
      back.dailyLogs[0]?.behaviorCompletions?.["morning-sunlight"]
    ).toBe(true);
  }, 30000);
});
