/**
 * AI suggestion rail — safe-by-default without Supabase, and it can
 * never create anything but a pending proposal.
 */
import { describe, it, expect } from "vitest";
import {
  listSuggestions,
  createSuggestion,
  rejectSuggestion,
} from "@/lib/cms/suggestions";

describe("AI suggestion rail", () => {
  it("is safe-by-default with no Supabase (never throws)", async () => {
    await expect(listSuggestions("pending")).resolves.toEqual([]);
    const c = await createSuggestion({
      entityType: "protocol",
      entityId: "x",
      proposed: { tagline: "y" },
      rationale: "z",
    });
    expect(c.ok).toBe(false);
    const r = await rejectSuggestion("nope");
    expect(r.ok).toBe(false);
  });
});
