/**
 * The CMS adaptation-rule interpreter is the core of Wave D-3 — it
 * runs over jsonb shapes the admin authors, so it must be defensive
 * (any malformed input → non-match, never a throw) and the publish
 * gate that promotes drafts must be exactly the runtime contract.
 */
import { describe, it, expect } from "vitest";
import {
  evalCondition,
  evalTrigger,
  pickMatchingRule,
  sanitizeEffect,
  RULE_METRICS,
} from "@/lib/cms/rules";

const ctx = {
  gapDays: 3,
  recoveryProxy: 40,
  adherence7: 50,
  sleepQuality: 2,
  energy: 3,
  trackedDays: 5,
  eveningMissedYesterday: true,
  bioRecoveryFlag: false,
};

describe("evalCondition", () => {
  it("compares numbers and respects op precedence", () => {
    expect(
      evalCondition(
        { metric: "recoveryProxy", op: "<", value: 45 },
        ctx
      )
    ).toBe(true);
    expect(
      evalCondition(
        { metric: "recoveryProxy", op: "<", value: 40 },
        ctx
      )
    ).toBe(false);
    expect(
      evalCondition(
        { metric: "recoveryProxy", op: "<=", value: 40 },
        ctx
      )
    ).toBe(true);
    expect(
      evalCondition({ metric: "gapDays", op: ">=", value: 2 }, ctx)
    ).toBe(true);
  });

  it("handles booleans with == and !=", () => {
    expect(
      evalCondition(
        { metric: "eveningMissedYesterday", op: "==", value: true },
        ctx
      )
    ).toBe(true);
    expect(
      evalCondition(
        { metric: "bioRecoveryFlag", op: "!=", value: true },
        ctx
      )
    ).toBe(true);
  });

  it("rejects unknown metrics, unknown ops, and null lhs", () => {
    expect(
      evalCondition(
        { metric: "noSuch", op: "<", value: 1 },
        ctx
      )
    ).toBe(false);
    expect(
      evalCondition(
        // Run-time guard for shapes that wouldn't typecheck if they
        // were authored in TS — the table stores jsonb, so we have to
        // defend against any string here.
        {
          metric: "recoveryProxy",
          op: "***" as unknown as "<",
          value: 1,
        },
        ctx
      )
    ).toBe(false);
    expect(
      evalCondition(
        { metric: "recoveryProxy", op: "<", value: 45 },
        { ...ctx, recoveryProxy: null }
      )
    ).toBe(false);
  });

  it("doesn't compare a number op against a non-number rhs", () => {
    expect(
      evalCondition(
        { metric: "recoveryProxy", op: "<", value: "low" },
        ctx
      )
    ).toBe(false);
  });
});

describe("evalTrigger", () => {
  it("empty / missing trigger matches by definition", () => {
    expect(evalTrigger(undefined, ctx)).toBe(true);
    expect(evalTrigger({}, ctx)).toBe(true);
    expect(evalTrigger({ all: [], any: [] }, ctx)).toBe(true);
  });

  it("all[] requires every condition to match", () => {
    expect(
      evalTrigger(
        {
          all: [
            { metric: "recoveryProxy", op: "<", value: 45 },
            { metric: "trackedDays", op: ">=", value: 3 },
          ],
        },
        ctx
      )
    ).toBe(true);
    expect(
      evalTrigger(
        {
          all: [
            { metric: "recoveryProxy", op: "<", value: 45 },
            { metric: "trackedDays", op: ">=", value: 99 },
          ],
        },
        ctx
      )
    ).toBe(false);
  });

  it("any[] requires at least one condition to match", () => {
    expect(
      evalTrigger(
        {
          any: [
            { metric: "sleepQuality", op: "<=", value: 2 },
            { metric: "energy", op: "<=", value: 1 },
          ],
        },
        ctx
      )
    ).toBe(true);
    expect(
      evalTrigger(
        {
          any: [
            { metric: "sleepQuality", op: ">", value: 4 },
            { metric: "energy", op: "<=", value: 1 },
          ],
        },
        ctx
      )
    ).toBe(false);
  });

  it("combining all + any is conjunction (both must hold)", () => {
    expect(
      evalTrigger(
        {
          all: [{ metric: "recoveryProxy", op: "<", value: 45 }],
          any: [{ metric: "sleepQuality", op: "<=", value: 2 }],
        },
        ctx
      )
    ).toBe(true);
    expect(
      evalTrigger(
        {
          all: [{ metric: "recoveryProxy", op: "<", value: 45 }],
          any: [{ metric: "sleepQuality", op: ">", value: 4 }],
        },
        ctx
      )
    ).toBe(false);
  });

  it("never throws on garbage input", () => {
    expect(() => evalTrigger("not an object", ctx)).not.toThrow();
    expect(() =>
      evalTrigger({ all: "bogus", any: 42 } as unknown, ctx)
    ).not.toThrow();
  });
});

describe("pickMatchingRule", () => {
  const a = {
    name: "soft-recovery",
    priority: 50,
    trigger: { all: [{ metric: "recoveryProxy", op: "<", value: 60 }] },
    effect: { setMode: "lighter" as const },
  };
  const b = {
    name: "hard-recovery",
    priority: 10,
    trigger: { all: [{ metric: "recoveryProxy", op: "<", value: 45 }] },
    effect: { setMode: "recovery" as const },
  };
  const c = {
    name: "primed",
    priority: 20,
    trigger: { all: [{ metric: "recoveryProxy", op: ">=", value: 78 }] },
    effect: { setMode: "primed" as const },
  };

  it("returns null when no rule matches", () => {
    expect(pickMatchingRule([c], ctx)).toBeNull();
  });

  it("returns the lowest-priority match (lower number wins)", () => {
    const r = pickMatchingRule([a, b], ctx);
    expect(r?.name).toBe("hard-recovery");
  });

  it("safe-by-default with empty / null input", () => {
    expect(pickMatchingRule([], ctx)).toBeNull();
    expect(
      pickMatchingRule(null as unknown as never[], ctx)
    ).toBeNull();
  });
});

describe("sanitizeEffect", () => {
  it("whitelists known modes and clamps strings", () => {
    const e = sanitizeEffect({
      setMode: "recovery",
      headline: "x".repeat(500),
      tone: "y".repeat(500),
      reason: "z".repeat(500),
      smuggled: "nope",
    });
    expect(e.setMode).toBe("recovery");
    expect((e.headline ?? "").length).toBeLessThanOrEqual(120);
    expect((e.tone ?? "").length).toBeLessThanOrEqual(400);
    expect((e.reason ?? "").length).toBeLessThanOrEqual(160);
    expect("smuggled" in e).toBe(false);
  });

  it("drops invalid modes and non-string copy", () => {
    const e = sanitizeEffect({
      setMode: "destroy",
      headline: 42,
      tone: null,
    });
    expect(e.setMode).toBeUndefined();
    expect(e.headline).toBeUndefined();
    expect(e.tone).toBeUndefined();
  });

  it("returns empty object on garbage input", () => {
    expect(sanitizeEffect(null)).toEqual({});
    expect(sanitizeEffect("hi")).toEqual({});
    expect(sanitizeEffect(undefined)).toEqual({});
  });
});

describe("RULE_METRICS", () => {
  it("declares the same set of metrics evalCondition accepts", () => {
    for (const m of RULE_METRICS) {
      // Sanity: every advertised metric resolves a value in ctx (no
      // metric in the help panel that the interpreter would reject).
      expect(ctx).toHaveProperty(m.name);
    }
  });
});
