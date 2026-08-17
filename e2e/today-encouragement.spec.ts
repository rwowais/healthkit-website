import { test, expect, type Browser, type Page } from "@playwright/test";
import { adminClient, createUser, signInViaUI, onboardedState } from "./lib/supa";

/**
 * Today's encouragement cards must never be un-removable.
 *
 * The founder's complaint: the evening "You moved N things today" card fires
 * EVERY evening a day is partly done, is full-width and centered, and had no
 * dismiss control — so the checklist (the reason you open the app) started
 * below the fold. Two escapes now exist and both are covered here: a per-day
 * "Got it", and a global Profile switch (settings.hideEncouragement).
 */

/**
 * Picks a timezone in which it is currently ~19:xx, which is what makes the
 * app's current block "evening".
 *
 * The app reads its clock from settings.timezone (getTz → dateKeyInTz /
 * nowMinutesInTz), NOT from the browser — so this zone must be written into
 * the seeded STATE, and the browser context is set to the same zone only so
 * TimezoneSentry's "you've moved timezones?" prompt stays quiet.
 *
 * Deliberately NOT done by shimming Date.now(): that shifts time past the
 * Supabase access token's expiry, so the very next page.reload() lands on
 * /auth. That silently made an earlier version of the "stays gone after
 * reload" assertion pass VACUOUSLY — the card was absent because the user had
 * been logged out, not because the dismissal persisted. Timezone moves the
 * wall clock the app reads while leaving absolute epoch time (and therefore
 * the session) untouched.
 */
function eveningTimezone(): { zone: string; localDate: string } {
  const now = new Date();
  let offset = 19 - now.getUTCHours(); // hours to add to UTC to land at ~19:xx
  if (offset > 14) offset -= 24; // Etc/GMT zones only span -12..+14
  if (offset < -12) offset += 24;
  // Etc/GMT signs are INVERTED: Etc/GMT-5 is UTC+5.
  const zone =
    offset === 0 ? "UTC" : `Etc/GMT${offset >= 0 ? "-" : "+"}${Math.abs(offset)}`;
  const localDate = new Date(now.getTime() + offset * 3_600_000)
    .toISOString()
    .slice(0, 10);
  return { zone, localDate };
}

/** Seeds an evening-with-partial-progress day — the state that fires the card. */
function partialDayState(
  zone: string,
  localDate: string,
  overrides: Record<string, unknown> = {}
) {
  const base = onboardedState();
  return {
    ...base,
    settings: {
      ...base.settings,
      name: "Rami",
      wakeTime: "06:30",
      bedtime: "22:30",
      // Overrides the onboardedState() default of "UTC" — see eveningTimezone.
      timezone: zone,
      ...overrides,
    },
    // Some-but-not-all done: partialClose needs prog.done > 0 and !dayComplete.
    dailyLogs: [
      {
        date: localDate,
        behaviorCompletions: { "hydrate-am": true },
        score: 30,
        sleepLog: { sleepQuality: 4 },
        energyLevel: 3,
        moodLevel: null,
        dayNote: "",
        pillarScores: {},
        sleepCompletions: [],
        exerciseEntries: [],
        supplementEntries: [],
        completions: [],
        nutritionScorecard: { customItems: [], note: "" },
      },
    ],
  };
}

const CARD = /You moved \d+ thing/;
/** Only rendered once state has loaded AND the timeline is non-empty. */
const TIMELINE_READY = "Today's flow";

/**
 * Waits for the app to be genuinely ready. Landing on /today is not enough:
 * the seeded state arrives via the cloud pull, and until it lands the timeline
 * is empty and every card is absent — so a toBeHidden() check would pass on a
 * page that simply hadn't finished rendering.
 */
async function waitForTimeline(page: Page) {
  await page
    .getByText(TIMELINE_READY)
    .waitFor({ state: "visible", timeout: 60_000 });
}

async function eveningPage(
  browser: Browser,
  user: { email: string; password: string },
  zone: string
) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone-ish: where the fold matters
    timezoneId: zone,
  });
  const page = await ctx.newPage();
  await signInViaUI(page, user.email, user.password, "**/today");
  await waitForTimeline(page);
  return { ctx, page };
}

test("evening card can be dismissed and stays gone for the day", async ({
  browser,
}) => {
  const { zone, localDate } = eveningTimezone();
  const admin = adminClient();
  const user = await createUser(admin, {
    state: partialDayState(zone, localDate),
  });
  const { ctx, page } = await eveningPage(browser, user, zone);
  try {
    const card = page.getByText(CARD);
    await expect(card).toBeVisible();

    await page.getByRole("button", { name: "Got it" }).first().click();
    await expect(card).toBeHidden();

    // Must STAY gone across a reload — an in-memory-only dismissal would put
    // the card back on the user's next visit that same evening. The session
    // has to survive the reload for this to mean anything, hence no clock shim.
    await page.reload();
    await page.waitForURL("**/today");
    await waitForTimeline(page);
    await expect(page.getByText(CARD)).toBeHidden();
  } finally {
    await ctx.close();
  }
});

test("evening card never renders when encouragement is switched off", async ({
  browser,
}) => {
  const { zone, localDate } = eveningTimezone();
  const admin = adminClient();
  const user = await createUser(admin, {
    state: partialDayState(zone, localDate, { hideEncouragement: true }),
  });
  const { ctx, page } = await eveningPage(browser, user, zone);
  try {
    // Same day-state as the test above, which proves the card WOULD fire, and
    // eveningPage already proved the timeline rendered — so this absence is
    // the switch working, not a blank page.
    await expect(page.getByText(CARD)).toBeHidden();
  } finally {
    await ctx.close();
  }
});
