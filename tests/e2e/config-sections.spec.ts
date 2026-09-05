import { test, expect } from "@playwright/test";
import { CONFIG_SECTION_ROUTES } from "./app-routes";

test.describe("Config section editors", () => {
  for (const path of CONFIG_SECTION_ROUTES) {
    test(`config shell ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 0).toBeLessThan(500);
      await expect(page.getByTestId("ps-app-shell")).toBeVisible();
      if (path === "/agent/settings") {
        // The registry's word, which is also the rail entry (T-0097).
        await expect(
          page.getByRole("heading", { level: 1, name: "Settings", exact: true })
        ).toBeVisible({ timeout: 30_000 });
      } else {
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
      }
    });
  }
});
