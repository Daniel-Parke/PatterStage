import { test, expect } from "@playwright/test";

test.describe("Seed catalog page", () => {
  test("loads Config → Seed", async ({ page }) => {
    await page.goto("/agent/settings/restore");
    await expect(page.getByRole("heading", { name: /Seed/i })).toBeVisible();
  });
});
