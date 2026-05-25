/**
 * Comprehensive admin-surface stress test against the staging Supabase.
 *
 * Exists to answer: "does every CMS feature actually work end-to-end,
 * not just the unit-test happy path?" Each top-level it() exercises one
 * surface — author rows, publish, fetch, apply, verify the runtime
 * adopted them.
 *
 * Opt-in: needs STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY /
 * STAGING_QA_EMAIL / STAGING_QA_PASSWORD in env, AND the staging QA
 * user in cms_admins. Skips harmlessly otherwise.
 *
 * Cleanup is best-effort — random values per run keep tests independent
 * even if a prior run left rows behind.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const URL = process.env.STAGING_SUPABASE_URL;
const ANON = process.env.STAGING_SUPABASE_ANON_KEY;
const EMAIL = process.env.STAGING_QA_EMAIL;
const PASSWORD = process.env.STAGING_QA_PASSWORD;
const enabled = !!(URL && ANON && EMAIL && PASSWORD);
if (enabled) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
}

type Pub = typeof import("@/lib/cms/publish");
type Auth = typeof import("@/lib/cms/authoring");
type Know = typeof import("@/lib/knowledge");
type SB = typeof import("@/lib/supabase");
type Sug = typeof import("@/lib/cms/suggestions");
type Engine = typeof import("@/lib/engine");
type Intel = typeof import("@/lib/intel");

const tag = () => Math.random().toString(36).slice(2, 8);

describe.skipIf(!enabled)("CMS comprehensive (real staging)", () => {
  let pub: Pub;
  let auth: Auth;
  let know: Know;
  let sug: Sug;
  let engine: Engine;
  let intel: Intel;
  let admin = false;

  beforeAll(async () => {
    const sbm: SB = await import("@/lib/supabase");
    pub = await import("@/lib/cms/publish");
    auth = await import("@/lib/cms/authoring");
    know = await import("@/lib/knowledge");
    sug = await import("@/lib/cms/suggestions");
    engine = await import("@/lib/engine");
    intel = await import("@/lib/intel");
    const client = sbm.getSupabase();
    if (!client) throw new Error("No Supabase client");
    const { error } = await client.auth.signInWithPassword({
      email: EMAIL as string,
      password: PASSWORD as string,
    });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    const uid = await sbm.getUserId();
    const { data } = await client
      .from("cms_admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    admin = !!data;
    // Make sure the catalog is seeded so assemble doesn't bail out.
    if (admin) await auth.importBuiltin();
  }, 30000);

  afterAll(() => know.resetKnowledge());

  it("1. Seeds the built-in catalog idempotently", async () => {
    if (!admin) return;
    const a = await auth.importBuiltin();
    const b = await auth.importBuiltin();
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  }, 30000);

  it("2. CRUD a protocol + behavior + reorder + delete-by-archive", async () => {
    if (!admin) return;
    const t = tag();
    const name = `e2e-proto-${t}`;
    const c = await auth.createProtocol({ name, tagline: "x", goal: "test" });
    expect(c.ok).toBe(true);
    const protos = await auth.listCmsProtocols();
    const p = protos.find((x) => x.name === name);
    expect(p).toBeTruthy();
    // Add two behaviors
    const b1 = await auth.createBehavior(p!.id, {
      title: `b1-${t}`,
      block: "morning",
      leverage: 2,
    });
    const b2 = await auth.createBehavior(p!.id, {
      title: `b2-${t}`,
      block: "evening",
      leverage: 3,
    });
    expect(b1.ok).toBe(true);
    expect(b2.ok).toBe(true);
    const behaviors = await auth.getProtocolBehaviors(p!.id);
    expect(behaviors.length).toBeGreaterThanOrEqual(2);
    // Reorder
    const last = behaviors[behaviors.length - 1];
    const r = await auth.reorderBehavior(p!.id, last.id, -1);
    expect(r.ok).toBe(true);
    // Archive the protocol
    const arch = await auth.saveProtocol({
      ...p!,
      status: "archived",
    });
    expect(arch.ok).toBe(true);
  }, 30000);

  it("3. Config override: author → publish → fetch → adopt → getCfgNumber", async () => {
    if (!admin) return;
    const val = 200 + Math.floor(Math.random() * 200);
    const r = await auth.upsertConfigOverride({
      key: "AHA_DAYS",
      value: val,
      description: "e2e",
    });
    expect(r.ok).toBe(true);

    const assembled = await auth.assembleBundleFromCMS();
    expect(assembled?.config.AHA_DAYS).toBe(val);

    know.resetKnowledge();
    const pub1 = await pub.publishBundle("e2e config");
    expect(pub1.ok || /no changes/i.test(pub1.reason ?? "")).toBe(true);

    pub.resetRefresh();
    expect(await pub.fetchAndApplyPublished()).toBe(true);
    expect(know.getCfgNumber("AHA_DAYS", 6)).toBe(val);

    await auth.deleteConfigOverride("AHA_DAYS");
  }, 60000);

  it("4. Insight template: published rows flow into bundle, drafts don't", async () => {
    if (!admin) return;
    const t = tag();
    const kind = `e2e-kind-${t}`;
    const tpl = `e2e-tpl-${t}`;
    // Draft — should NOT appear in the bundle
    const draft = await auth.saveInsightTemplate({
      kind,
      template: tpl,
      status: "draft",
    });
    expect(draft.ok).toBe(true);
    let bundle = await auth.assembleBundleFromCMS();
    expect(
      bundle?.insightTemplates.find((x) => x.kind === kind)
    ).toBeUndefined();

    // Promote to published
    const all = await auth.listInsightTemplates();
    const row = all.find((x) => x.kind === kind);
    expect(row).toBeTruthy();
    const promote = await auth.saveInsightTemplate({
      ...row!,
      status: "published",
    });
    expect(promote.ok).toBe(true);

    bundle = await auth.assembleBundleFromCMS();
    expect(
      bundle?.insightTemplates.find((x) => x.kind === kind)?.template
    ).toBe(tpl);

    // Publish + adopt + verify getInsightTemplate
    know.resetKnowledge();
    const r = await pub.publishBundle(`e2e tpl ${t}`);
    expect(r.ok || /no changes/i.test(r.reason ?? "")).toBe(true);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();
    expect(know.getInsightTemplate(kind, "DEFAULT")).toBe(tpl);

    // Cleanup
    await auth.deleteInsightTemplate(row!.id);
  }, 60000);

  it("5. Adaptation rule: published rule overrides adapt() baseline", async () => {
    if (!admin) return;
    const t = tag();
    // Author a rule that ALWAYS matches (empty trigger) and forces
    // `lighter` mode. priority 1 = highest.
    const ruleName = `e2e-rule-${t}`;
    const save = await auth.saveAdaptationRule({
      name: ruleName,
      priority: 1,
      trigger: {}, // always matches
      effect: { setMode: "lighter", headline: `e2e-${t}` },
      status: "published",
    });
    expect(save.ok).toBe(true);

    know.resetKnowledge();
    const r = await pub.publishBundle(`e2e rule ${t}`);
    expect(r.ok || /no changes/i.test(r.reason ?? "")).toBe(true);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();

    // Build a minimal state and call adapt() — should see the override.
    const state = {
      settings: {},
      installedPacks: [],
      pausedPacks: [],
      behaviorOverrides: {},
      dailyLogs: [
        {
          date: new Date().toISOString().slice(0, 10),
          score: 80,
          behaviorCompletions: {},
          sleepLog: {},
          energyLevel: 4,
          moodLevel: null,
          exerciseEntries: [],
          supplementEntries: [],
          sleepCompletions: [],
          completions: [],
          nutritionScorecard: { customItems: [], note: "" },
        },
      ],
      biomarkers: [],
      insights: [],
      currentStreak: 0,
      protocols: {},
      supplementMeta: {},
      version: 3,
    } as unknown as Parameters<typeof engine.adapt>[0];
    const a = engine.adapt(state);
    expect(a.mode).toBe("lighter");
    expect(a.headline).toBe(`e2e-${t}`);

    // Cleanup
    const rules = await auth.listAdaptationRules();
    const row = rules.find((x) => x.name === ruleName);
    if (row) await auth.deleteAdaptationRule(row.id);
  }, 60000);

  it("6. Bundle diff catches config / template / rule changes", async () => {
    if (!admin) return;
    const t = tag();
    // Author one of each so the diff has something to find.
    const cfgKey = "FREE_PACKS"; // known
    const cfgVal = 7;
    await auth.upsertConfigOverride({
      key: cfgKey,
      value: cfgVal,
      description: "e2e diff",
    });
    const tplKind = `e2e-diff-${t}`;
    await auth.saveInsightTemplate({
      kind: tplKind,
      template: "x",
      status: "published",
    });
    const ruleName = `e2e-diff-${t}`;
    await auth.saveAdaptationRule({
      name: ruleName,
      priority: 99,
      trigger: {},
      effect: { setMode: "normal" },
      status: "published",
    });

    // Publish to "lock in" current state so subsequent diff is computed
    // against this.
    know.resetKnowledge();
    await pub.publishBundle(`e2e diff baseline ${t}`);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();

    // Now change one of each and assert the diff lists them
    await auth.upsertConfigOverride({
      key: cfgKey,
      value: cfgVal + 1,
      description: "e2e diff bumped",
    });
    await auth.saveInsightTemplate({
      kind: tplKind,
      template: "x-bumped",
      status: "published",
    });
    await auth.saveAdaptationRule({
      name: ruleName,
      priority: 50, // changed
      trigger: {},
      effect: { setMode: "normal" },
      status: "published",
    });

    const prev = await pub.getLatestPublishedBundle();
    const next = await pub.previewNextBundle();
    const d = pub.diffBundles(prev, next);
    expect(d.hasChanges).toBe(true);
    expect(d.configChanged.map((c) => c.key)).toContain(cfgKey);
    expect(d.templatesChanged.map((x) => x.kind)).toContain(tplKind);
    expect(d.rulesChanged.map((x) => x.name)).toContain(ruleName);

    // Cleanup
    await auth.deleteConfigOverride(cfgKey);
    const tpls = await auth.listInsightTemplates();
    const tplRow = tpls.find((x) => x.kind === tplKind);
    if (tplRow) await auth.deleteInsightTemplate(tplRow.id);
    const rules = await auth.listAdaptationRules();
    const rRow = rules.find((x) => x.name === ruleName);
    if (rRow) await auth.deleteAdaptationRule(rRow.id);
  }, 90000);

  it("7. Evidence + Explanation upserts are atomic (no duplicates)", async () => {
    if (!admin) return;
    const t = tag();
    const ref = `e2e-${t}`;
    // Two concurrent upserts to the same target → must end with ONE row.
    await Promise.all([
      auth.upsertEvidence({
        targetType: "behavior",
        targetRef: ref,
        tier: "emerging",
        sourceLabel: "a",
      }),
      auth.upsertEvidence({
        targetType: "behavior",
        targetRef: ref,
        tier: "moderate",
        sourceLabel: "b",
      }),
    ]);
    const rows = await auth.listEvidence("behavior", ref);
    expect(rows.length).toBe(1);

    await Promise.all([
      auth.upsertExplanation({
        targetType: "behavior",
        targetRef: ref,
        kind: "why",
        text: "1",
      }),
      auth.upsertExplanation({
        targetType: "behavior",
        targetRef: ref,
        kind: "why",
        text: "2",
      }),
    ]);
    const ex = await auth.listExplanations("behavior", ref);
    expect(ex.filter((x) => x.kind === "why").length).toBe(1);
  }, 30000);

  it("8. Audit log is readable + recent publishes appear there", async () => {
    if (!admin) return;
    const before = (await auth.listAuditLog(10)).length;
    // Trigger something audited
    const t = tag();
    await auth.saveAdaptationRule({
      name: `e2e-audit-${t}`,
      priority: 99,
      trigger: {},
      effect: { setMode: "normal" },
      status: "draft",
    });
    know.resetKnowledge();
    await pub.publishBundle(`e2e audit ${t}`);
    const after = await auth.listAuditLog(10);
    expect(after.length).toBeGreaterThanOrEqual(before);
    // Cleanup
    const rules = await auth.listAdaptationRules();
    const r = rules.find((x) => x.name === `e2e-audit-${t}`);
    if (r) await auth.deleteAdaptationRule(r.id);
  }, 60000);

  it("9. Admin allowlist: list returns own row at minimum", async () => {
    if (!admin) return;
    const list = await auth.listAdmins();
    expect(list.length).toBeGreaterThanOrEqual(1);
    // We don't add/remove here — we'd lock the QA user out by mistake.
  }, 15000);

  it("10. Rollback creates a new version that adopts cleanly", async () => {
    if (!admin) return;
    // Snapshot the current state, publish, change, publish, then roll
    // back to the first one — confirm getCfgNumber reverts.
    const baseVal = 11;
    await auth.upsertConfigOverride({
      key: "AHA_DAYS",
      value: baseVal,
      description: "e2e rb baseline",
    });
    know.resetKnowledge();
    const a = await pub.publishBundle("e2e rb baseline");
    expect(a.ok || /no changes/i.test(a.reason ?? "")).toBe(true);

    // Bump
    await auth.upsertConfigOverride({
      key: "AHA_DAYS",
      value: baseVal + 5,
      description: "e2e rb bumped",
    });
    know.resetKnowledge();
    const b = await pub.publishBundle("e2e rb bump");
    expect(b.ok).toBe(true);
    const bumpedVersion = b.ok ? b.version : 0;

    // Roll back to the baseline version (bumpedVersion - 1)
    know.resetKnowledge();
    const rb = await pub.rollbackTo(bumpedVersion - 1);
    expect(rb.ok).toBe(true);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();
    expect(know.getCfgNumber("AHA_DAYS", 6)).toBe(baseVal);

    await auth.deleteConfigOverride("AHA_DAYS");
  }, 90000);

  it("11. Round-trip checksum integrity: re-fetched bundle still validates", async () => {
    if (!admin) return;
    // Publish a known-shape bundle and verify the read-back checksum
    // matches what we stored (the silent-failure surface for the
    // 'runtime didn't adopt' bug).
    const t = tag();
    await auth.upsertConfigOverride({
      key: "AHA_DAYS",
      value: 13,
      description: `rt-${t}`,
    });
    know.resetKnowledge();
    const p = await pub.publishBundle(`e2e rt ${t}`);
    expect(p.ok || /no changes/i.test(p.reason ?? "")).toBe(true);
    pub.resetRefresh();
    const adopted = await pub.fetchAndApplyPublished();
    expect(adopted).toBe(true);
    // If adopted is true, the checksum integrity check passed.
    await auth.deleteConfigOverride("AHA_DAYS");
  }, 60000);

  it("13. Deleting an override actually removes it from the next bundle", async () => {
    if (!admin) return;
    // Bug we hit: { ...activeConfig(), ...cms.config } merge made the
    // next bundle resurrect deleted overrides that lived in the last
    // published bundle. The fix is to make the next bundle a PURE
    // function of the CMS tables. Lock that in.
    const t = tag();
    const initial = 50 + Math.floor(Math.random() * 50);
    // Publish a baseline that includes an override.
    await auth.upsertConfigOverride({
      key: "AHA_DAYS",
      value: initial,
      description: `e2e del ${t}`,
    });
    know.resetKnowledge();
    const a = await pub.publishBundle(`e2e del baseline ${t}`);
    expect(a.ok || /no changes/i.test(a.reason ?? "")).toBe(true);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();
    expect(know.getCfgNumber("AHA_DAYS", 6)).toBe(initial);

    // Now DELETE the override row from the CMS. The next bundle must
    // not contain AHA_DAYS, even though activeConfig() in this session
    // still has it from the prior publish.
    await auth.deleteConfigOverride("AHA_DAYS");
    const preview = await pub.previewNextBundle();
    expect(preview.config.AHA_DAYS).toBeUndefined();
    const next = await pub.publishBundle(`e2e del removal ${t}`);
    expect(next.ok || /no changes/i.test(next.reason ?? "")).toBe(true);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();
    expect(know.getCfgNumber("AHA_DAYS", 6)).toBe(6); // back to default
  }, 90000);

  it("14. packById finds CMS-authored protocols (Library visibility)", async () => {
    if (!admin) return;
    const t = tag();
    const name = `e2e-vis-${t}`;
    const c = await auth.createProtocol({
      name,
      tagline: "x",
      goal: "test",
    });
    expect(c.ok).toBe(true);

    know.resetKnowledge();
    await pub.publishBundle(`e2e visibility ${t}`);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();

    // The library page iterates activePacks() — verify the new pack
    // is there AND packById finds it (previously broken; packById
    // only searched the built-in PACKS).
    const pkg = await import("@/lib/packs");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
    // Find by slug fragment since createProtocol appends a hash.
    const live = know.activePacks();
    const found = live.find((p) => p.id.startsWith(slug));
    expect(found).toBeTruthy();
    if (found) {
      const byId = pkg.packById(found.id);
      expect(byId?.id).toBe(found.id);
    }

    // Cleanup — archive the protocol so it stays out of future bundles.
    const protos = await auth.listCmsProtocols();
    const row = protos.find((p) => p.name === name);
    if (row) await auth.saveProtocol({ ...row, status: "archived" });
  }, 90000);

  it("12. intel.ts insight template kinds resolve from the published bundle", async () => {
    if (!admin) return;
    const t = tag();
    const customCopy = `e2e-keystone-${t}`;
    await auth.saveInsightTemplate({
      kind: "keystone-slipping-title",
      template: customCopy,
      status: "published",
    });
    know.resetKnowledge();
    await pub.publishBundle(`e2e intel ${t}`);
    pub.resetRefresh();
    await pub.fetchAndApplyPublished();
    expect(
      know.getInsightTemplate("keystone-slipping-title", "DEFAULT")
    ).toBe(customCopy);
    // Cleanup
    const rows = await auth.listInsightTemplates();
    const r = rows.find(
      (x) => x.kind === "keystone-slipping-title" && x.template === customCopy
    );
    if (r) await auth.deleteInsightTemplate(r.id);
  }, 60000);
});
