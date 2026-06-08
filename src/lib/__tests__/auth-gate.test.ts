import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/lib/authGate";

describe("authGate.isPublicPath — the account-wall allowlist", () => {
  it("treats the marketing landing as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("treats auth + legal pages as public", () => {
    expect(isPublicPath("/auth")).toBe(true);
    expect(isPublicPath("/auth/reset")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
  });

  it("treats every app surface as protected", () => {
    for (const p of [
      "/today",
      "/insights",
      "/protocols",
      "/supplements",
      "/biomarkers",
      "/profile",
      "/library",
      "/upgrade",
      "/onboarding",
      "/share",
      "/admin",
      "/dev",
    ]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("does not let a lookalike prefix slip through the wall", () => {
    // "/authority" must NOT match the "/auth" allowlist entry — we only
    // allow the exact segment or a true sub-path ("/auth/..."), never a
    // longer word that merely starts with the same letters.
    expect(isPublicPath("/authority")).toBe(false);
    expect(isPublicPath("/termsofwar")).toBe(false);
    expect(isPublicPath("/privacy-policy")).toBe(false);
  });
});
