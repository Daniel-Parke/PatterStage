import { test, expect } from "@playwright/test";

// B3 (T-0097): the rail must not scroll at 1280x720. It carried about
// twenty-two entries plus a config tree plus three deploy buttons, and at
// 720px tall it scrolled; the regroup (five sections, the config tree on the
// Settings index, the deploy buttons on Settings > System) is what makes this
// hold, and this is what keeps it held.

test("the rail fits a 1280x720 viewport without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
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
  expect(metrics).not.toBeNull();
  expect(metrics!.asideHeight).toBeLessThanOrEqual(metrics!.viewport + 1);
  expect(metrics!.navScroll).toBeLessThanOrEqual(metrics!.navClient + 1);
});

test("the rail renders once: one aside, whatever the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.locator("aside").count()).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("aside").count()).toBe(1);
});
