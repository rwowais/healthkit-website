/**
 * Publish pipeline — pure builders + safe-by-default when Supabase off.
 * (Live publish/rollback require admin + cloud; exercised via staging.)
 */
import { describe, it, expect } from "vitest";
import { PACKS } from "@/lib/packs";
import { isValidBundle, bundleChecksum } from "@/lib/knowledge";
import {
  buildCatalogBundle,
  listPublications,
  publishBundle,
  rollbackTo,
  fetchAndApplyPublished,
} from "@/lib/cms/publish";

describe("publish pipeline", () => {
  it("builds a valid, checksummable bundle of the effective catalog", () => {
    const b = buildCatalogBundle(3);
    expect(isValidBundle(b)).toBe(true);
    expect(b.version).toBe(3);
    expect(b.protocols).toEqual(PACKS); // built-in by default
    expect(typeof bundleChecksum(b)).toBe("string");
  });

  it("checksum changes only when content changes", () => {
    const a = buildCatalogBundle(1);
    const b = buildCatalogBundle(2); // version differs, content same
    expect(bundleChecksum(a)).toBe(bundleChecksum(b)); // version excluded
  });

  it("is safe-by-default with no Supabase (never throws)", async () => {
    await expect(listPublications()).resolves.toEqual([]);
    await expect(fetchAndApplyPublished()).resolves.toBe(false);
    const r = await publishBundle("x");
    expect(r.ok).toBe(false);
    const rb = await rollbackTo(1);
    expect(rb.ok).toBe(false);
  });
});
