import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility scan of the public pages. We assert no CRITICAL violations
 * (the highest-severity tier — empty controls, images with no alt, etc.).
 * Lower tiers (serious/moderate) are worth fixing too but aren't a hard gate
 * here, to avoid blocking on long-tail contrast nits.
 */
for (const path of ["/", "/auth", "/privacy", "/terms"]) {
  test(`no critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical.map((v) => `${v.id}: ${v.help}`),
      JSON.stringify(critical, null, 2)
    ).toEqual([]);
  });
}
