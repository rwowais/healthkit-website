/**
 * Opt-in CMS pipeline e2e against the STAGING Supabase project (never
 * production). Dormant unless STAGING_* env vars exist AND the staging
 * QA user is in cms_admins there. Verifies the real governed path:
 * seed → assemble → publish → list → rollback, over the network.
 *
 * To enable in staging (one line, in the staging SQL editor):
 *   insert into public.cms_admins (user_id) values ('<staging QA uid>');
 */
import { describe, it, expect, beforeAll } from "vitest";

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
type SBmod = typeof import("@/lib/supabase");

describe.skipIf(!enabled)("CMS pipeline e2e (real staging Supabase)", () => {
  let pub: Pub;
  let auth: Auth;
  let admin = false;

  beforeAll(async () => {
    const sbm: SBmod = await import("@/lib/supabase");
    pub = await import("@/lib/cms/publish");
    auth = await import("@/lib/cms/authoring");
    const client = sbm.getSupabase();
    if (!client) throw new Error("No Supabase client (env?)");
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
  }, 30000);

  it("seeds, assembles, and publishes from the CMS (admin path)", async () => {
    if (!admin) {
      // Optional path: staging CMS not enabled (schema not run there
      // and/or QA user not in cms_admins). Skip, don't fail — to verify
      // here, run the CMS schema in staging then:
      //   insert into public.cms_admins (user_id) values ('<QA uid>');
      console.warn(
        "[cmsStaging] skipped — staging QA user not in cms_admins"
      );
      return;
    }
    const seed = await auth.importBuiltin();
    expect(seed.ok).toBe(true);

    const assembled = await auth.assembleBundleFromCMS();
    expect(assembled).not.toBeNull();
    expect(assembled!.length).toBeGreaterThan(0);
    expect(assembled![0].behaviors.length).toBeGreaterThan(0);

    const r = await pub.publishBundle("e2e: seed snapshot");
    // ok, OR a benign "no changes" if a prior identical bundle exists
    expect(r.ok || /no changes/i.test(r.reason ?? "")).toBe(true);

    const list = await pub.listPublications();
    expect(Array.isArray(list)).toBe(true);
  }, 60000);

  it("rolls back to a prior version when history allows", async () => {
    if (!admin) return;
    const list = await pub.listPublications();
    if (list.length < 2) return; // not enough history yet — fine
    const prev = list[1].version;
    const r = await pub.rollbackTo(prev);
    expect(r.ok).toBe(true);
    const after = await pub.listPublications();
    expect(after[0].version).toBeGreaterThan(list[0].version);
  }, 60000);

  it("governs AI suggestions: create → approve writes draft → reject", async () => {
    if (!admin) return;
    const sug = await import("@/lib/cms/suggestions");
    const protos = await auth.listCmsProtocols();
    expect(protos.length).toBeGreaterThan(0);
    const target = protos[0];
    const tag = `e2e ${Date.now()}`;

    const c = await sug.createSuggestion({
      entityType: "protocol",
      entityId: target.id,
      proposed: { tagline: tag },
      rationale: "e2e governance",
    });
    expect(c.ok).toBe(true);

    const pending = await sug.listSuggestions("pending");
    const mine = pending.find(
      (s) =>
        s.entity_id === target.id &&
        (s.proposed as { tagline?: string }).tagline === tag
    );
    expect(mine).toBeTruthy();

    const ap = await sug.approveSuggestion(mine!);
    expect(ap.ok).toBe(true);
    // draft updated, NOT published — the protocol row now carries it
    const after = await auth.listCmsProtocols();
    expect(after.find((p) => p.id === target.id)?.tagline).toBe(tag);

    // a second proposal can be cleanly rejected
    const c2 = await sug.createSuggestion({
      entityType: "protocol",
      entityId: target.id,
      proposed: { tagline: "reject me" },
      rationale: "e2e reject",
    });
    expect(c2.ok).toBe(true);
    const p2 = (await sug.listSuggestions("pending")).find(
      (s) => (s.proposed as { tagline?: string }).tagline === "reject me"
    );
    expect(p2).toBeTruthy();
    const rj = await sug.rejectSuggestion(p2!.id);
    expect(rj.ok).toBe(true);
    const stillPending = (await sug.listSuggestions("pending")).some(
      (s) => s.id === p2!.id
    );
    expect(stillPending).toBe(false);
  }, 60000);
});
