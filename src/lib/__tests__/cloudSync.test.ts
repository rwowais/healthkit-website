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
    serverSkewMs: 90_000, // server clock 90s ahead of client
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
    // Pending write (update/insert). Kept separate from `op` so a `.select()`
    // chained AFTER a write reads as a RETURNING clause, not a read.
    writeOp: null | { kind: "update" | "insert"; payload: Row } = null;
    filters: [string, unknown][] = [];
    constructor(public table: string) {}
    select(_cols?: string) {
      if (!this.writeOp) this.op = "select";
      return this;
    }
    update(payload: Row) {
      this.writeOp = { kind: "update", payload };
      return this;
    }
    insert(payload: Row) {
      this.writeOp = { kind: "insert", payload };
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
    inFilters: [string, unknown[]][] = [];
    in(col: string, vals: unknown[]) {
      this.inFilters.push([col, vals]);
      return this;
    }
    private rows() {
      return [...tbl(this.table).values()].filter(
        (r) =>
          this.filters.every(([c, v]) => r[c] === v) &&
          this.inFilters.every(([c, vs]) => vs.includes(r[c]))
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
        const stored = { ...row };
        // Mimic the DB `before update` trigger: the server rewrites
        // updated_at with the SERVER clock, which is skewed ahead of the
        // client. This is what made client-vs-server timestamp compares
        // silently drop every save after the first.
        if (this.table === "protocolize_state") {
          stored.updated_at = new Date(
            Date.now() + state.serverSkewMs
          ).toISOString();
        }
        tbl(this.table).set(key, stored);
      }
      state.lastUpsertAt.set(this.table, Date.now());
      return { data: null, error: null };
    }
    // thenable: awaiting the builder runs the pending write, or select / delete
    then(
      resolve: (v: {
        data: Row[] | null;
        error: null | { code: string; message: string };
      }) => void,
      reject?: (e: unknown) => void
    ) {
      wait()
        .then(() => {
          // Conditional UPDATE — the compare-and-swap the real save() relies on.
          // Only rows matching every filter (including updated_at) are touched,
          // and the affected rows come back so a 0-row result is detectable.
          if (this.writeOp?.kind === "update") {
            const affected = this.rows();
            for (const r of affected) {
              Object.assign(r, this.writeOp.payload);
              // Mimic the `before update` trigger: the SERVER stamps
              // updated_at, skewed ahead of the client clock.
              if (this.table === "protocolize_state") {
                r.updated_at = new Date(
                  Date.now() + state.serverSkewMs
                ).toISOString();
              }
            }
            // Record write time like upsert/insert do, so durability-ordering
            // assertions still see the CAS path land.
            if (affected.length) state.lastUpsertAt.set(this.table, Date.now());
            return {
              data: affected.map((r) => ({ ...r })) as Row[],
              error: null,
            };
          }
          // INSERT — a duplicate primary key surfaces as 23505 so the caller
          // can defer instead of clobbering a concurrent first write.
          if (this.writeOp?.kind === "insert") {
            const row = { ...this.writeOp.payload };
            const key = String(row.user_id);
            if (tbl(this.table).has(key)) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key" },
              };
            }
            if (this.table === "protocolize_state" && !row.updated_at) {
              row.updated_at = new Date(
                Date.now() + state.serverSkewMs
              ).toISOString();
            }
            tbl(this.table).set(key, row);
            state.lastUpsertAt.set(this.table, Date.now());
            return { data: [row] as Row[], error: null };
          }
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
    seedLog(userId: string, logDate: string) {
      tbl("protocolize_logs").set(`${userId}::${logDate}`, {
        user_id: userId,
        log_date: logDate,
        log: { date: logDate },
        updated_at: "2026-05-19T00:00:00.000Z",
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
      state.serverSkewMs = 90_000;
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

  it("T7: server clock ahead of client — the SECOND save still persists (no silent drop)", async () => {
    fake.setSession({ user: { id: "u6" } });
    fake.state.serverSkewMs = 120_000; // server 2 min ahead
    const { ds } = await fresh();
    await ds.activeDataSource.load(); // baseline (uploads default)

    await ds.activeDataSource.save(
      makeState({ settings: { completedOnboarding: true, name: "first" } })
    );
    // The concurrency guard must NOT mistake our own (server-stamped)
    // write for a remote one and skip this second save.
    await ds.activeDataSource.save(
      makeState({
        settings: { completedOnboarding: true, name: "second" },
        currentStreak: 7,
      })
    );

    const row = fake.stateRow("u6")!;
    expect(row.state.settings?.name).toBe("second");
    const back = await ds.activeDataSource.load();
    expect(back.currentStreak).toBe(7);
  });
});

/**
 * Write-path hardening from the 2026-07-16 audit.
 *
 * REL-5: the guard used to READ updated_at and then upsert unconditionally.
 * Two devices saving inside that round-trip window both passed the read, and
 * the second replaced the first's whole document — the first having already
 * reported success and cleared its dirty flag, so its next clean load silently
 * reverted its own edits. The write is now a compare-and-swap.
 *
 * REL-4: nothing serialized successive saves, so on a slow link they could land
 * out of order and leave the cloud holding the OLDER document.
 */
describe("write path — serialize + compare-and-swap (REL-4 / REL-5)", () => {
  it("REL-5: a write from another device is deferred, never clobbered", async () => {
    fake.setSession({ user: { id: "u1" } });
    fake.seedState("u1", makeState(), "2026-05-19T00:00:00.000Z");
    const { ds } = await fresh();
    await ds.activeDataSource.load(); // baselines on the seeded version

    // Another device writes AFTER our load — the row moves under us.
    fake.seedState(
      "u1",
      makeState({ settings: { name: "from-device-B", tier: "free" } }),
      "2026-05-20T00:00:00.000Z"
    );

    await ds.activeDataSource.save(
      makeState({ settings: { name: "from-device-A", tier: "free" } })
    );

    // B's document survives intact — A's save detected the conflict and stood
    // down rather than overwriting it.
    expect(fake.stateRow("u1")!.state.settings?.name).toBe("from-device-B");
    // ...and A's edit is NOT lost: local stays dirty so the next load merges
    // and pushes it.
    expect(localStorage.getItem("pz:pending-sync")).toBe("1");
  });

  it("REL-4: rapid saves serialize — the cloud ends on the newest document", async () => {
    fake.setSession({ user: { id: "u1" } });
    fake.seedState("u1", makeState(), "2026-05-19T00:00:00.000Z");
    fake.state.latencyMs = 30; // slow link: the out-of-order window
    const { ds } = await fresh();
    await ds.activeDataSource.load();

    const day = (date: string) => ({
      date,
      behaviorCompletions: {},
      score: 10,
      sleepLog: {},
      exerciseEntries: [],
      supplementEntries: [],
      sleepCompletions: [],
      completions: [],
      nutritionScorecard: { customItems: [], note: "" },
    });

    // Fire both without awaiting the first — the pre-fix code could land these
    // in either order.
    await Promise.all([
      ds.activeDataSource.save(makeState({ dailyLogs: [day("2026-05-19")] })),
      ds.activeDataSource.save(
        makeState({ dailyLogs: [day("2026-05-19"), day("2026-05-20")] })
      ),
    ]);

    // The newer document wins, never the older one.
    expect(fake.stateRow("u1")!.state.dailyLogs).toHaveLength(2);
  });

  it("REL-7: 'keep this device's data' drops the account's cloud-only days", async () => {
    fake.setSession({ user: { id: "u1" } });
    const { ds } = await fresh();
    // The account has three days in the per-day table…
    fake.seedLog("u1", "2026-05-18");
    fake.seedLog("u1", "2026-05-19");
    fake.seedLog("u1", "2026-05-20");

    // …but the device the user chose to keep only knows about one of them.
    const chosen = makeState({
      dailyLogs: [
        {
          date: "2026-05-19",
          behaviorCompletions: {},
          score: 10,
          sleepLog: {},
          exerciseEntries: [],
          supplementEntries: [],
          sleepCompletions: [],
          completions: [],
          nutritionScorecard: { customItems: [], note: "" },
        },
      ],
    });
    await (
      ds.activeDataSource as unknown as {
        dropCloudDaysNotIn: (s: typeof chosen) => Promise<void>;
      }
    ).dropCloudDaysNotIn(chosen);

    // Only the kept day survives — the discarded ones can't be unioned back
    // by reconcileLogs on the next load.
    expect(fake.logRows("u1").map((r) => r.log_date)).toEqual(["2026-05-19"]);
  });

  it("writes through when the account has no cloud row yet (insert path)", async () => {
    fake.setSession({ user: { id: "u3" } });
    const { ds } = await fresh();

    await ds.activeDataSource.save(makeState({ currentStreak: 4 }));

    const row = fake.stateRow("u3");
    expect(row).toBeTruthy();
    expect(
      (row!.state as unknown as { currentStreak: number }).currentStreak
    ).toBe(4);
  });
});
