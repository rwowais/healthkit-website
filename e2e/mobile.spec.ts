import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR } from "./lib/supa";

/**
 * Mobile layout sanity on a phone-sized viewport — catches the "content wider
 * than the screen" / horizontal-scroll class of bug that desktop runs miss.
 * (Not a substitute for a real-device touch check, but covers layout.)
 *
 * We use a mobile VIEWPORT on Chromium rather than devices["iPhone 13"]: the
 * device descriptor forces WebKit (not installed in CI) and can't be set
 * inside a describe group.
 */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

// Allow a couple of px for sub-pixel rounding; real overflow bugs are larger.
async function fitsViewport(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 2
  );
}

test.describe("mobile — public", () => {
  test.use(IPHONE);

  test("landing fits the viewport and shows the CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Create your free account", { exact: false })
    ).toBeVisible();
    expect(await fitsViewport(page)).toBe(true);
  });

  test("auth fits the viewport", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByTestId("auth-email")).toBeVisible();
    expect(await fitsViewport(page)).toBe(true);
  });
});

test.describe("mobile — authed Today", () => {
  test.use({ ...IPHONE, storageState: path.join(AUTH_DIR, "a.json") });

  test("Today renders and fits the viewport", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByRole("navigation").first()).toBeVisible();
    expect(await fitsViewport(page)).toBe(true);
  });
});
