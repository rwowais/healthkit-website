import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR } from "./lib/supa";

/**
 * No uncaught JavaScript errors while loading the core pages — catches silent
 * runtime breakage (a crash in a component, a bad import) that still "renders"
 * something. Scoped to `pageerror` (real uncaught exceptions), not console
 * noise. A couple of well-known benign errors are ignored.
 */
const BENIGN = [
  /ResizeObserver loop/i, // browser quirk, harmless
  /Failed to load resource/i, // covered by network checks elsewhere
];

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    const msg = String(e);
    if (!BENIGN.some((re) => re.test(msg))) errors.push(msg);
  });
  return errors;
}

async function visit(page: Page, paths: string[]) {
  for (const p of paths) {
    await page.goto(p);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500); // let client effects run
  }
}

test("no uncaught errors on public pages", async ({ page }) => {
  const errors = trackPageErrors(page);
  await visit(page, ["/", "/auth", "/privacy", "/terms"]);
  expect(errors, `Uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
});

test.describe("authed pages", () => {
  test.use({ storageState: path.join(AUTH_DIR, "a.json") });

  test("no uncaught errors on Today / Insights / Profile", async ({ page }) => {
    const errors = trackPageErrors(page);
    await visit(page, ["/today", "/insights", "/profile"]);
    expect(errors, `Uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
  });
});
