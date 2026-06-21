import { test, expect } from "@playwright/test";
import { CONFIG_SECTION_ROUTES } from "./app-routes";

test.describe("Config section editors", () => {
  for (const path of CONFIG_SECTION_ROUTES) {
    test(`config shell ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 0).toBeLessThan(500);
      await expect(page.getByTestId("ps-app-shell")).toBeVisible();
      if (path === "/config") {
        await expect(
          page.getByRole("heading", { name: "Configuration", exact: true })
        ).toBeVisible({ timeout: 30_000 });
      } else {
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
      }
    });
  }
});
