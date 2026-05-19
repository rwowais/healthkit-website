/**
 * Deterministic cloud-sync harness.
 *
 * The real Supabase-only bugs (self-clobber, login loop, conflict spam,
 * concurrency, per-day logs) never executed in preview because there was
 * no authenticated session. This fakes Supabase with an in-memory store +
 * injected latency + controllable auth, so the entire class is reproduced
 * deterministically with zero credentials and zero flakiness.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppState } from "@/lib/types";

// ── Fake Supabase ──────────────────────────────────────────────────
const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    latencyMs: 8,
    session: null as null | { user: { id: string } },
    authCbs: [] as ((e: string, s: unknown) => void)[],
    tables: new Map<string, Map<string, Row>>(),
    lastUpsertAt: new Map<string, number>(), // table -> ts
  };
  const tbl = (t: string) => {
    if (!state.tables.has(t)) state.tables.set(t, new Map());
    return state.tables.get(t)!;
  };
  const wait = () =>
    new Promise<void>((r) => setTimeout(r, state.latencyMs));

  class Builder {
    op: "select" | "delete" = "select";
    filters: [string, unknown][] = [];
    constructor(public table: string) {}
    select() {
      this.op = "select";
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push([col, val]);
      return this;
    }
    private rows() {
      return [...tbl(this.table).values()].filter((r) =>
        this.filters.every(([c, v]) => r[c] === v)
      );
    }
    async maybeSingle() {
      await wait();
      return { data: this.rows()[0] ?? null, error: null };
    }
    async upsert(
      payload: Row | Row[],
      opts?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) {
      await wait();
      const arr = Array.isArray(payload) ? payload : [payload];
      const keyCols = (opts?.onConflict ?? "user_id").split(",");
      for (const row of arr) {
        const key = keyCols.map((k) => row[k]).join("::");
        const exists = tbl(this.table).has(key);
        if (exists && opts?.ignoreDuplicates) continue;
        tbl(this.table).set(key, { ...row });
      }
      state.lastUpsertAt.set(this.table, Date.now());
      return { data: null, error: null };
    }
    // thenable: awaiting the builder runs select-list / delete
    then(
      resolve: (v: { data: Row[] | null; error: null }) => void,
      reject?: (e: unknown) => void
    ) {
      wait()
        .then(() => {
          if (this.op === "delete") {
            for (const r of this.rows()) {
              for (const [k, m] of tbl(this.table))
                if (m === r) tbl(this.table).delete(k);
            }
            return { data: null, error: null };
          }
          return { data: this.rows(), error: null };
        })
        .then(resolve, reject);
    }
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      getUser: async () => ({
        data: { user: state.session?.user ?? null },
      }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        state.authCbs.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: (t: string) => new Builder(t),
  };

  return {
    client,
    state,
    setSession(s: null | { user: { id: string } }) {
      state.session = s;
      state.authCbs.forEach((cb) =>
        cb(s ? "SIGNED_IN" : "SIGNED_OUT", s)
      );
    },
    seedState(userId: string, st: unknown, updated_at: string) {
      tbl("protocolize_state").set(userId, {
        user_id: userId,
        state: st,
        updated_at,
      });
    },
    stateRow(userId: string) {
      return tbl("protocolize_state").get(userId) as
        | {
            state: {
              dailyLogs?: unknown[];
              settings?: { name?: string };
            };
            updated_at: string;
          }
        | undefined;
    },
    logRows(userId: string) {
      return [...tbl("protocolize_logs").values()].filter(
        (r) => r.user_id === userId
      );
    },
    reset() {
      state.tables.clear();
      state.lastUpsertAt.clear();
      state.session = null;
      state.authCbs = [];
      state.latencyMs = 8;
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fake.client,
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon";

const STATE_EVENT = "pz:state";

function makeState(over: Record<string, unknown> = {}): AppState {
  return {
    version: 3,
    settings: { completedOnboarding: true, name: "Q", tier: "free" },
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
    ...over,
  } as unknown as AppState;
}

// Fresh module graph per test so module-level singletons reset.
async function fresh() {
  vi.resetModules();
  const ds = await import("@/lib/datasource");
  const sb = await import("@/lib/supabase");
  return { ds, sb };
}

beforeEach(() => {
  fake.reset();
  (globalThis as unknown as { __resetBrowser: () => void }).__resetBrowser();
});

describe("cloud sync — regression class", () => {
  it("T1: notify fires only AFTER the cloud write is durable (self-clobber root cause)", async () => {
    fake.setSession({ user: { id: "u1" } });
    fake.seedState("u1", makeState(), "2026-05-19T00:00:00.000Z");
    fake.state.latencyMs = 25;
    const { ds } = await fresh();

    await ds.activeDataSource.load();

    let notifyAt = 0;
    (globalThis as { window?: EventTarget }).window!.addEventListener(
      STATE_EVENT,
      () => {
        notifyAt = Date.now();
      }
    );

    const toggled = makeState({
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
    });
    await ds.activeDataSource.save(toggled);
    const upsertAt = fake.state.lastUpsertAt.get("protocolize_state")!;

    // The written cloud row must contain the toggle, and the cross-tab
    // notify must not precede the durable write.
    expect(fake.stateRow("u1")!.state.dailyLogs).toHaveLength(1);
    expect(notifyAt).toBeGreaterThan(0);
    expect(notifyAt).toBeGreaterThanOrEqual(upsertAt);
  });

  it("T2: getUserId never caches null — picks up a late sign-in (login-loop fix)", async () => {
    const { sb } = await fresh();
    expect(await sb.getUserId()).toBeNull(); // logged out on /auth
    fake.setSession({ user: { id: "u-late" } }); // sign in afterwards
    expect(await sb.getUserId()).toBe("u-late"); // not stuck at null
  });

  it("T3: existing user load returns completedOnboarding (no re-onboard)", async () => {
    fake.setSession({ user: { id: "u2" } });
    fake.seedState(
      "u2",
      makeState({ settings: { completedOnboarding: true } }),
      "2026-05-19T00:00:00.000Z"
    );
    const { ds } = await fresh();
    const s = await ds.activeDataSource.load();
    expect(s.settings.completedOnboarding).toBe(true);
  });

  it("T4: conflict prompt fires once, not on every load", async () => {
    fake.setSession({ user: { id: "u3" } });
    // Cloud has independent data; local (guest) has different data.
    fake.seedState(
      "u3",
      makeState({
        dailyLogs: [{ date: "2026-05-01", behaviorCompletions: {} }],
      }),
      "2026-05-19T00:00:00.000Z"
    );
    const { ds } = await fresh();
    const storage = await import("@/lib/storage");
    // Seed meaningful, differing local guest data.
    storage.saveState(
      makeState({
        dailyLogs: [{ date: "2026-05-18", behaviorCompletions: {} }],
        biomarkers: [{ id: "b1", metric: "hrv", value: 40, date: "2026-05-18" }],
      }) as unknown as Parameters<typeof storage.saveState>[0]
    );

    await ds.activeDataSource.load();
    const first = ds.getPendingConflict();
    ds.getPendingConflict() && (await ds.resolveConflict("merge"));

    // Subsequent loads must NOT re-raise the prompt.
    await ds.activeDataSource.load();
    await ds.activeDataSource.load();
    expect(first).not.toBeNull();
    expect(ds.getPendingConflict()).toBeNull();
  });

  it("T5: concurrency guard — a remote write since load isn't clobbered", async () => {
    fake.setSession({ user: { id: "u4" } });
    fake.seedState("u4", makeState(), "2026-05-19T00:00:00.000Z");
    const { ds } = await fresh();
    await ds.activeDataSource.load();

    // Another device advances the row.
    fake.seedState(
      "u4",
      makeState({ settings: { completedOnboarding: true, name: "other" } }),
      "2026-05-19T09:00:00.000Z"
    );

    await ds.activeDataSource.save(makeState({ currentStreak: 1 }));
    // Our blind whole-doc write must NOT have overwritten the newer row.
    expect(fake.stateRow("u4")?.state.settings?.name).toBe("other");
  });

  it("T6: per-day logs — dual-write the changed day + backfill, never fewer days", async () => {
    fake.setSession({ user: { id: "u5" } });
    fake.seedState(
      "u5",
      makeState({
        dailyLogs: [
          { date: "2026-05-17", behaviorCompletions: { a: true }, score: 10 },
        ],
      }),
      "2026-05-19T00:00:00.000Z"
    );
    const { ds } = await fresh();

    const loaded = await ds.activeDataSource.load();
    // Backfilled the existing document day into the per-day table.
    expect(fake.logRows("u5").length).toBeGreaterThanOrEqual(1);

    const next = {
      ...loaded,
      dailyLogs: [
        ...loaded.dailyLogs,
        { date: "2026-05-19", behaviorCompletions: { b: true }, score: 20 },
      ],
    };
    await ds.activeDataSource.save(next as unknown as typeof loaded);
    const dates = fake
      .logRows("u5")
      .map((r) => r.log_date)
      .sort();
    expect(dates).toEqual(["2026-05-17", "2026-05-19"]);
  });
});
