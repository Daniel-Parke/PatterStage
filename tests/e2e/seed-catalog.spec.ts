import { test, expect } from "@playwright/test";

test.describe("Restore page", () => {
  test("loads Settings → Restore", async ({ page }) => {
    await page.goto("/agent/settings/restore");
    await expect(page.getByRole("heading", { name: /Restore everything/i })).toBeVisible();
  });
});
