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
});
