import { test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR } from "./lib/supa";

/**
 * Visual tour — NOT an assertion suite. It signs in (via the harness's
 * captured session) and attaches a full-page screenshot of every key screen,
 * desktop AND mobile, to the test report. The point is to let a human (or me)
 * actually SEE the live, rendered app each run — the visual layer the
 * behavioral specs can't cover — and catch "it works but it looks broken".
 */

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const AUTHED = [
  "/today",
  "/insights",
  "/protocols",
  "/supplements",
  "/biomarkers",
  "/profile",
];
const PUBLIC = ["/", "/auth"];

async function capture(page: Page, info: TestInfo, label: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200); // let client effects + animations settle
  await info.attach(label, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("visual tour — public", () => {
  test("public screens (desktop)", async ({ page }, info) => {
    for (const p of PUBLIC) {
      await page.goto(p);
      await capture(page, info, `public ${p}`);
    }
  });
});

test.describe("visual tour — authed (desktop)", () => {
  test.use({ storageState: path.join(AUTH_DIR, "a.json") });
  test("every app screen (desktop)", async ({ page }, info) => {
    for (const p of AUTHED) {
      await page.goto(p);
      await capture(page, info, `desktop ${p}`);
    }
  });
});

test.describe("visual tour — authed (mobile)", () => {
  test.use({ ...IPHONE, storageState: path.join(AUTH_DIR, "a.json") });
  test("every app screen (mobile)", async ({ page }, info) => {
    for (const p of AUTHED) {
      await page.goto(p);
      await capture(page, info, `mobile ${p}`);
    }
  });
});
