/**
 * The OAuth buttons must not render unless the provider is actually
 * configured in Supabase. This is not cosmetic: they were the two most
 * prominent buttons on the sign-in screen (Apple styled as the primary
 * action) and every first-time visitor who tapped one hit an error, because
 * "Supabase is enabled" was being used as a proxy for "Apple/Google are
 * configured" — two different questions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const KEY = "NEXT_PUBLIC_OAUTH_PROVIDERS";
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[KEY];
});
afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

async function load(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  return import("../auth");
}

describe("oauth provider gate", () => {
  it("defaults to NOTHING when unset — a broken button is worse than none", async () => {
    const m = await load(undefined);
    expect(m.oauthProviders.google).toBe(false);
    expect(m.oauthProviders.apple).toBe(false);
    expect(m.anyOAuthConfigured).toBe(false);
  });

  it("enables only the provider named", async () => {
    // Google OAuth is free to set up; Apple needs a paid developer account,
    // so enabling one without the other is the likely real-world case.
    const m = await load("google");
    expect(m.oauthProviders.google).toBe(true);
    expect(m.oauthProviders.apple).toBe(false);
    expect(m.anyOAuthConfigured).toBe(true);
  });

  it("supports both", async () => {
    const m = await load("google,apple");
    expect(m.oauthProviders.google).toBe(true);
    expect(m.oauthProviders.apple).toBe(true);
  });

  it("tolerates whitespace and casing", async () => {
    const m = await load(" Google , APPLE ");
    expect(m.oauthProviders.google).toBe(true);
    expect(m.oauthProviders.apple).toBe(true);
  });

  it("ignores unknown values rather than enabling anything", async () => {
    const m = await load("facebook,,github");
    expect(m.anyOAuthConfigured).toBe(false);
  });
});
