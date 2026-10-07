import { test, expect } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";

// B3 (T-0097): the rail must not scroll at 1280x720. It carried about
// twenty-two entries plus a config tree plus three deploy buttons, and at
// 720px tall it scrolled; the regroup (five sections, the config tree on the
// Settings index, the deploy buttons on Settings > System) is what makes this
// hold, and this is what keeps it held.

/**
 * Every route, not just `/` (T-0121).
 *
 * The rail is in the shell, so it is the same rail everywhere; its ACTIVE row
 * is not. The sub-link tier rendered only under the active link, and the one
 * route that could never show it was the one this test used: `/` is the
 * dashboard and the dashboard has no children. The tier that pushed the rail
 * past 720px was therefore invisible to the test written to catch it.
 */
for (const route of documentedRoutes()) {
  test(`the rail fits a 1280x720 viewport on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const nav = aside?.querySelector("nav");
      if (!aside || !nav) return null;
      return {
        asideHeight: aside.getBoundingClientRect().height,
        navScroll: nav.scrollHeight,
        navClient: nav.clientHeight,
        viewport: window.innerHeight,
      };
    });
    expect(metrics, `${route} rendered no rail`).not.toBeNull();
    expect(metrics!.asideHeight).toBeLessThanOrEqual(metrics!.viewport + 1);
    expect(metrics!.navScroll).toBeLessThanOrEqual(metrics!.navClient + 1);
  });
}

/**
 * The rail is its final width on FIRST PAINT.
 *
 * It used to read the collapse preference on the client, so a collapsed rail
 * painted 224px wide and snapped to 64px once /api/prefs answered: a visible
 * jump on the one surface the operator is looking at while the page arrives.
 * RootLayout reads it on the server now, so the width in the first frame is the
 * width in the last one.
 */
test("the rail does not change width after it has painted", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // , not . At commit the stylesheet has not applied
  // and the <aside> is still a full-width block, so the pair being compared
  // would be "before CSS" against "after hydration" rather than the two the
  // defect lived between: the SERVER's answer and the CLIENT's.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const painted = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  await page.waitForTimeout(1_500);
  const settled = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(settled - painted)).toBeLessThanOrEqual(1);
  // And whichever width it is, it is one of the two the rail has.
  expect([64, 224]).toContain(Math.round(settled));
});

test("the rail renders once: one aside, whatever the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.locator("aside").count()).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("aside").count()).toBe(1);
});
