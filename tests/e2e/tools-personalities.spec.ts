import { test, expect } from "@playwright/test";

test.describe("Tools and Personalities", () => {
  test("tools registry loads", async ({ page }) => {
    await page.goto("/operations/tools");
    await expect(page.getByRole("heading", { name: "Tool Registry" })).toBeVisible();
    await expect(page.getByTestId("ch-app-shell")).toBeVisible();
  });

  test("personalities page loads", async ({ page }) => {
    await page.goto("/operations/personalities");
    await expect(
      page.getByRole("heading", { name: "Personalities", exact: true })
    ).toBeVisible();
    await expect(page.getByTestId("ch-app-shell")).toBeVisible();
  });

  test("tools page exposes register action", async ({ page }) => {
    await page.goto("/operations/tools");
    await expect(page.getByRole("button", { name: /Register Tool/i })).toBeVisible();
  });
});
