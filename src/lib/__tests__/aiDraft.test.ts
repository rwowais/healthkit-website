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
  clampDraftWithSuggestions,
  capTier,
  AI_MAX_TIER,
  EVIDENCE_TIERS,
  OUTPUT_JSON_SCHEMA,
  OUTPUT_JSON_SCHEMA_WITH_SUGGEST,
} from "@/lib/cms/aiSchema";
import { isPublishableBehavior } from "@/lib/cms/authoring";
import {
  generateBehaviorDraft,
  generateBehaviorDraftAndSuggestProtocol,
} from "@/lib/cms/ai";
import { diffBundles } from "@/lib/cms/publish";
import type { KnowledgeBundle } from "@/lib/knowledge";

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

describe("OUTPUT_JSON_SCHEMA — Anthropic structured-outputs subset", () => {
  // Anthropic structured outputs only honor a subset of JSON Schema.
  // These walkers lock in the rules so a future schema change can't
  // re-introduce keywords the API rejects (caused live 400 once).
  const walk = (node: unknown, visit: (n: Record<string, unknown>) => void) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const c of node) walk(c, visit);
      return;
    }
    const o = node as Record<string, unknown>;
    visit(o);
    for (const v of Object.values(o)) walk(v, visit);
  };

  it("never uses minimum/maximum on integers (unsupported)", () => {
    walk(OUTPUT_JSON_SCHEMA, (n) => {
      if (n.type === "integer") {
        expect(n.minimum).toBeUndefined();
        expect(n.maximum).toBeUndefined();
      }
    });
  });

  it("never uses union types like ['string','null']", () => {
    walk(OUTPUT_JSON_SCHEMA, (n) => {
      expect(Array.isArray(n.type)).toBe(false);
    });
  });

  it("every object closes additionalProperties and lists required", () => {
    walk(OUTPUT_JSON_SCHEMA, (n) => {
      if (n.type === "object") {
        expect(n.additionalProperties).toBe(false);
        expect(Array.isArray(n.required)).toBe(true);
      }
    });
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

  it("suggest-protocol mode requires both a description and a candidate list", async () => {
    await expect(
      generateBehaviorDraftAndSuggestProtocol("", [])
    ).resolves.toMatchObject({ ok: false });
    await expect(
      generateBehaviorDraftAndSuggestProtocol("idea", [])
    ).resolves.toMatchObject({ ok: false });
    const r = await generateBehaviorDraftAndSuggestProtocol("idea", [
      { slug: "x", name: "X" },
    ]);
    expect(r.ok).toBe(false); // no cloud in tests
  });
});

describe("clampDraftWithSuggestions", () => {
  const allowed = new Set(["sleep", "focus"]);

  it("filters suggestions to the allowed slug list and caps at 3", () => {
    const raw = {
      title: "Demo",
      suggestedProtocols: [
        { slug: "sleep", name: "Better Sleep", reason: "evening behavior" },
        { slug: "phantom", name: "Made up", reason: "model hallucination" },
        { slug: "focus", name: "Deep Focus", reason: "morning ritual" },
        { slug: "sleep", name: "Better Sleep", reason: "dup" },
        { slug: "sleep", name: "Better Sleep", reason: "another" },
      ],
    };
    const out = clampDraftWithSuggestions(raw, allowed);
    expect(out.suggestedProtocols.map((s) => s.slug)).toEqual([
      "sleep",
      "focus",
      "sleep",
    ]);
    expect(out.suggestedProtocols.length).toBeLessThanOrEqual(3);
  });

  it("never lets the model smuggle an unknown slug through", () => {
    const out = clampDraftWithSuggestions(
      { suggestedProtocols: [{ slug: "unknown", name: "X", reason: "X" }] },
      allowed
    );
    expect(out.suggestedProtocols).toEqual([]);
  });

  it("the suggest-mode schema is still in the allowed-keywords subset", () => {
    const walk = (
      node: unknown,
      visit: (n: Record<string, unknown>) => void
    ) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const c of node) walk(c, visit);
        return;
      }
      const o = node as Record<string, unknown>;
      visit(o);
      for (const v of Object.values(o)) walk(v, visit);
    };
    walk(OUTPUT_JSON_SCHEMA_WITH_SUGGEST, (n) => {
      if (n.type === "integer") {
        expect(n.minimum).toBeUndefined();
        expect(n.maximum).toBeUndefined();
      }
      expect(Array.isArray(n.type)).toBe(false);
      if (n.type === "object") {
        expect(n.additionalProperties).toBe(false);
        expect(Array.isArray(n.required)).toBe(true);
      }
    });
  });
});

describe("diffBundles — what's about to ship", () => {
  const mkBundle = (
    protocols: KnowledgeBundle["protocols"]
  ): KnowledgeBundle => ({
    schema: 1,
    version: 1,
    generatedAt: new Date().toISOString(),
    protocols,
    config: {},
  });
  const beh = (k: string, title = k, extra = {}) =>
    ({
      canonicalKey: k,
      title,
      block: "morning",
      anchor: "wake",
      offsetMin: 0,
      rationale: "x",
      icon: "sparkle",
      leverage: 2,
      kind: "action",
      ...extra,
    }) as KnowledgeBundle["protocols"][number]["behaviors"][number];

  it("detects nothing changed when bundles match", () => {
    const a = mkBundle([
      {
        id: "sleep",
        name: "Sleep",
        tagline: "t",
        goal: "sleep",
        accent: "x",
        icon: "moon",
        source: "official",
        behaviors: [beh("k1"), beh("k2")],
      },
    ]);
    const d = diffBundles(a, a);
    expect(d.hasChanges).toBe(false);
    expect(d.unchanged).toBe(2);
  });

  it("classifies added / changed / removed", () => {
    const prev = mkBundle([
      {
        id: "sleep",
        name: "Sleep",
        tagline: "t",
        goal: "sleep",
        accent: "x",
        icon: "moon",
        source: "official",
        behaviors: [beh("k1", "Old title"), beh("k2"), beh("k3")],
      },
    ]);
    const next = mkBundle([
      {
        id: "sleep",
        name: "Sleep",
        tagline: "t",
        goal: "sleep",
        accent: "x",
        icon: "moon",
        source: "official",
        behaviors: [
          beh("k1", "New title"), // changed
          beh("k2"), // unchanged
          // k3 removed
          beh("k4"), // added
        ],
      },
    ]);
    const d = diffBundles(prev, next);
    expect(d.hasChanges).toBe(true);
    expect(d.behaviorsAdded.map((b) => b.canonicalKey)).toEqual(["k4"]);
    expect(d.behaviorsRemoved.map((b) => b.canonicalKey)).toEqual(["k3"]);
    expect(d.behaviorsChanged.map((b) => b.canonicalKey)).toEqual(["k1"]);
    expect(d.behaviorsChanged[0].fields).toContain("title");
    expect(d.unchanged).toBe(1);
  });

  it("detects config / template / rule changes — the silent-failure bug", () => {
    // The first version of diffBundles only watched protocols + behaviors,
    // so a config-only Publish (e.g. AHA_DAYS override) looked like
    // "no changes" and a user couldn't tell their override would ship.
    const base = mkBundle([
      {
        id: "p1",
        name: "P1",
        tagline: "t",
        goal: "g",
        accent: "x",
        icon: "sparkle",
        source: "custom",
        behaviors: [beh("k1")],
      },
    ]);
    const cfgOnly: KnowledgeBundle = {
      ...base,
      config: { AHA_DAYS: 21 },
    };
    const d = diffBundles(base, cfgOnly);
    expect(d.hasChanges).toBe(true);
    expect(d.configAdded.map((c) => c.key)).toEqual(["AHA_DAYS"]);
    expect(d.configAdded[0].next).toBe(21);

    const cfgChanged: KnowledgeBundle = {
      ...base,
      config: { AHA_DAYS: 6 },
    };
    const d2 = diffBundles(cfgOnly, cfgChanged);
    expect(d2.configChanged.map((c) => c.key)).toEqual(["AHA_DAYS"]);
    expect(d2.configChanged[0].prev).toBe(21);
    expect(d2.configChanged[0].next).toBe(6);

    const tplAdded: KnowledgeBundle = {
      ...base,
      insightTemplates: [{ kind: "keystone-slipping", template: "x" }],
    };
    const d3 = diffBundles(base, tplAdded);
    expect(d3.templatesAdded.map((t) => t.kind)).toEqual([
      "keystone-slipping",
    ]);
    expect(d3.hasChanges).toBe(true);

    const ruleAdded: KnowledgeBundle = {
      ...base,
      adaptationRules: [
        {
          name: "primed",
          priority: 30,
          trigger: {},
          effect: { setMode: "primed" },
        },
      ],
    };
    const d4 = diffBundles(base, ruleAdded);
    expect(d4.rulesAdded.map((r) => r.name)).toEqual(["primed"]);
    expect(d4.hasChanges).toBe(true);
  });

  it("detects whole protocols added or removed", () => {
    const empty = mkBundle([]);
    const one = mkBundle([
      {
        id: "p1",
        name: "P1",
        tagline: "t",
        goal: "g",
        accent: "x",
        icon: "sparkle",
        source: "custom",
        behaviors: [beh("k1")],
      },
    ]);
    const dAdd = diffBundles(empty, one);
    expect(dAdd.protocolsAdded.map((p) => p.id)).toEqual(["p1"]);
    expect(dAdd.behaviorsAdded.map((b) => b.canonicalKey)).toEqual(["k1"]);
    const dRemove = diffBundles(one, empty);
    expect(dRemove.protocolsRemoved.map((p) => p.id)).toEqual(["p1"]);
    expect(dRemove.behaviorsRemoved.map((b) => b.canonicalKey)).toEqual([
      "k1",
    ]);
  });
});
