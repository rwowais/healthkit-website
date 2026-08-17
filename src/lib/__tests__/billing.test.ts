/**
 * billing.test.ts — the fulfillment hand-off.
 *
 * These guard the one property that makes a payment deliverable: Stripe must
 * be told WHO is buying (`client_reference_id`), because the fulfillment
 * webhook has no other way to map a payment back to a user. A regression here
 * is not a broken button — it is a customer charged real money with no way to
 * grant them what they bought, discovered only via a support email.
 *
 * The env vars are read at module load, so each case re-imports with vi.resetModules().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const LINK = "https://buy.stripe.com/test_annual";
const USER = "11111111-2222-3333-4444-555555555555";

let mockUserId: string | null = USER;
let userIdThrows = false;

vi.mock("../supabase", () => ({
  getUserId: async () => {
    if (userIdThrows) throw new Error("network");
    return mockUserId;
  },
}));

/** Fresh module with the given env, so `LINKS` is rebuilt. */
async function loadBilling(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("../billing");
}

const ENV_KEYS = [
  "NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL",
  "NEXT_PUBLIC_STRIPE_CHECKOUT_MONTHLY",
  "NEXT_PUBLIC_STRIPE_CHECKOUT_LIFETIME",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  mockUserId = USER;
  userIdThrows = false;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("withClientReference", () => {
  it("attaches the buyer's user id", async () => {
    const { withClientReference } = await loadBilling({});
    const out = new URL(withClientReference(LINK, USER));
    expect(out.searchParams.get("client_reference_id")).toBe(USER);
  });

  it("preserves query params the payment link already carries", async () => {
    const { withClientReference } = await loadBilling({});
    const out = new URL(
      withClientReference(`${LINK}?prefilled_email=a%40b.com`, USER)
    );
    // Naive string concatenation would produce a second "?" and silently
    // corrupt both params.
    expect(out.searchParams.get("prefilled_email")).toBe("a@b.com");
    expect(out.searchParams.get("client_reference_id")).toBe(USER);
  });

  it("throws on a malformed link rather than returning a broken URL", async () => {
    const { withClientReference } = await loadBilling({});
    expect(() => withClientReference("not-a-url", USER)).toThrow();
  });
});

describe("startCheckout", () => {
  it("refuses when no payment link is configured", async () => {
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: undefined,
      NEXT_PUBLIC_STRIPE_CHECKOUT_MONTHLY: undefined,
      NEXT_PUBLIC_STRIPE_CHECKOUT_LIFETIME: undefined,
    });
    expect(billing.billingConfigured).toBe(false);
    const r = await billing.startCheckout("annual");
    expect(r.ok).toBe(false);
  });

  it("REFUSES to open checkout for a signed-out user", async () => {
    // The whole point: no user id means the webhook could never fulfill the
    // purchase, so the money must not be taken in the first place.
    mockUserId = null;
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: LINK,
    });
    const r = await billing.startCheckout("annual");
    expect(r.ok).toBe(false);
    expect(r.needsAuth).toBe(true);
  });

  it("refuses when the identity lookup fails, rather than guessing", async () => {
    userIdThrows = true;
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: LINK,
    });
    const r = await billing.startCheckout("annual");
    expect(r.ok).toBe(false);
    expect(r.needsAuth).toBe(true);
  });

  it("refuses when the configured link is malformed", async () => {
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: "not-a-url",
    });
    const r = await billing.startCheckout("annual");
    expect(r.ok).toBe(false);
    expect(r.needsAuth).toBeUndefined();
  });

  it("navigates to the link WITH the client reference attached", async () => {
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: LINK,
    });
    let navigatedTo = "";
    vi.stubGlobal("window", {
      get location() {
        return {
          set href(v: string) {
            navigatedTo = v;
          },
        };
      },
    });

    const r = await billing.startCheckout("annual");
    expect(r.ok).toBe(true);
    expect(navigatedTo).not.toBe("");
    expect(new URL(navigatedTo).searchParams.get("client_reference_id")).toBe(
      USER
    );
  });

  it("sends each plan to its own link", async () => {
    const billing = await loadBilling({
      NEXT_PUBLIC_STRIPE_CHECKOUT_ANNUAL: LINK,
      NEXT_PUBLIC_STRIPE_CHECKOUT_LIFETIME: "https://buy.stripe.com/test_life",
    });
    let navigatedTo = "";
    vi.stubGlobal("window", {
      get location() {
        return {
          set href(v: string) {
            navigatedTo = v;
          },
        };
      },
    });

    await billing.startCheckout("lifetime");
    expect(new URL(navigatedTo).pathname).toContain("test_life");
  });
});
