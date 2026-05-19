/**
 * The AI authoring rail's load-bearing safety guarantees, tested on the
 * pure boundary functions (no SDK, no network, no Supabase):
 *  - clampDraft can never emit unsafe/over-confident output
 *  - isPublishableBehavior keeps AI drafts out of every bundle
 *  - the client wrapper is safe-by-default with no cloud
 */
import { describe, it, expect } from "vitest";
import {
  clampDraft,
  capTier,
  AI_MAX_TIER,
  EVIDENCE_TIERS,
} from "@/lib/cms/aiSchema";
import { isPublishableBehavior } from "@/lib/cms/authoring";
import { generateBehaviorDraft } from "@/lib/cms/ai";

describe("clampDraft — the safety boundary", () => {
  it("caps evidence tier at 'emerging' no matter what the model claims", () => {
    expect(clampDraft({ evidence: { tier: "strong" } }).evidence.tier).toBe(
      "emerging"
    );
    expect(
      clampDraft({ evidence: { tier: "moderate" } }).evidence.tier
    ).toBe("emerging");
    // weaker-than-cap is allowed through unchanged
    expect(
      clampDraft({ evidence: { tier: "anecdotal" } }).evidence.tier
    ).toBe("anecdotal");
    // garbage never resolves stronger than the cap
    expect(
      clampDraft({ evidence: { tier: "bulletproof" } }).evidence.tier
    ).toBe("emerging");
    expect(clampDraft({}).evidence.tier).toBe("emerging");
  });

  it("capTier never returns a tier stronger than AI_MAX_TIER", () => {
    const ceil = EVIDENCE_TIERS.indexOf(AI_MAX_TIER);
    for (const t of [...EVIDENCE_TIERS, "junk", undefined, 7]) {
      expect(EVIDENCE_TIERS.indexOf(capTier(t))).toBeGreaterThanOrEqual(
        ceil
      );
    }
  });

  it("always forces aiUnverified true and status-safe shape", () => {
    const d = clampDraft({
      title: "x",
      aiUnverified: false,
      status: "published",
    });
    expect(d.aiUnverified).toBe(true);
    expect("status" in d).toBe(false); // status is not a draft field
  });

  it("whitelists enums and bounds numbers", () => {
    const d = clampDraft({
      block: "whenever",
      anchor: "moon",
      kind: "destroy",
      icon: "skull",
      leverage: 99,
      offsetMin: 99999,
    });
    expect(d.block).toBe("anytime");
    expect(d.anchor).toBe("wake");
    expect(d.kind).toBe("action");
    expect(d.icon).toBe("sparkle");
    expect(d.leverage).toBe(3); // clamped into 1..3
    expect(d.offsetMin).toBe(240); // clamped into [-240,240]
  });

  it("drops unknown fields and sanitizes the source URL", () => {
    const d = clampDraft({
      title: "Mag",
      evilField: "DROP TABLE",
      evidence: { url: "javascript:alert(1)" },
    }) as unknown as Record<string, unknown>;
    expect(d.evilField).toBeUndefined();
    expect((d.evidence as { url: string | null }).url).toBeNull();
    const ok = clampDraft({
      evidence: { url: "https://pubmed.example/abc" },
    });
    expect(ok.evidence.url).toBe("https://pubmed.example/abc");
  });

  it("never throws on hostile input", () => {
    expect(() => clampDraft(null)).not.toThrow();
    expect(() => clampDraft("nope")).not.toThrow();
    expect(() => clampDraft(42)).not.toThrow();
    expect(clampDraft(null).title).toBe("Untitled behavior");
  });
});

describe("isPublishableBehavior — the publish gate", () => {
  it("excludes archived and any unverified AI draft", () => {
    expect(
      isPublishableBehavior({ status: "published", ai_unverified: false })
    ).toBe(true);
    expect(
      isPublishableBehavior({ status: "draft", ai_unverified: false })
    ).toBe(true);
    expect(
      isPublishableBehavior({ status: "archived", ai_unverified: false })
    ).toBe(false);
    // the key guarantee: AI drafts can never reach a bundle
    expect(
      isPublishableBehavior({ status: "published", ai_unverified: true })
    ).toBe(false);
  });
});

describe("generateBehaviorDraft — safe-by-default", () => {
  it("returns ok:false (never throws) with no description or no cloud", async () => {
    await expect(generateBehaviorDraft("")).resolves.toMatchObject({
      ok: false,
    });
    const r = await generateBehaviorDraft("magnesium 300mg");
    expect(r.ok).toBe(false); // no Supabase configured in the test env
    expect(typeof r.reason).toBe("string");
  });
});
