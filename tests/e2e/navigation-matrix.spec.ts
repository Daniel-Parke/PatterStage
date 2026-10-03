import { test, expect } from "@playwright/test";
import { APP_MATRIX_ROUTES } from "./app-routes";

test.describe("Navigation matrix", () => {
  for (const path of APP_MATRIX_ROUTES) {
    test(`loads ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status() ?? 0).toBeLessThan(500);
      await expect(page.getByTestId("ps-app-shell")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    });
  }
});
