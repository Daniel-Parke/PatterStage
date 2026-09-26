import { expect, test } from "@playwright/test";

const routes = ["/agent/profiles", "/results/sessions", "/work/missions"];

test.describe("T-0152 · the no-agent notice shares the page column", () => {
  for (const route of routes) {
    test(`${route}: notice aligns with the heading at 1440`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.route("**/api/monitor", async (request) => request.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { framework: { name: "Hermes", available: false } } }),
      }));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const heading = page.locator("main h1");
      const noticeText = page.getByText("Hermes is not installed", { exact: true });
      await expect(heading).toBeVisible();
      await expect(noticeText).toBeVisible();
      const noticeCard = noticeText.locator("xpath=../..");
      const headingBox = await heading.boundingBox();
      const noticeBox = await noticeCard.boundingBox();
      expect(headingBox).not.toBeNull();
      expect(noticeBox).not.toBeNull();
      expect(Math.abs(noticeBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
    });
  }
});
