import { test, expect } from "@playwright/test";
import { CONFIG_SECTION_ANCHORS } from "./app-routes";

/**
 * Every settings section is reachable by its anchor on the one Settings page
 * (U11, T-0125). The old matrix visited 27 section pages and asked each for an
 * h1; this asks each anchor to land the section's own heading in the viewport,
 * which is what the redirect from the old URL and the section nav both promise.
 */
test.describe("Settings sections, by anchor", () => {
  for (const path of CONFIG_SECTION_ANCHORS) {
    const id = path.split("#")[1];
    test(`settings section ${id}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 0).toBeLessThan(500);
      await expect(page.getByTestId("ps-app-shell")).toBeVisible();
      // The registry's word, which is also the rail entry (T-0097).
      await expect(page.getByRole("heading", { level: 1, name: "Settings", exact: true })).toBeVisible({
        timeout: 30_000,
      });
      const section = page.locator(`section#${id}`);
      await expect(section).toBeVisible({ timeout: 30_000 });
      // A section is an h3: its group is the h2 above it.
      await expect(section.getByRole("heading", { level: 3 }).first()).toBeInViewport();
    });
  }
});
