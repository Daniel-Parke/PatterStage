import { test, expect } from "@playwright/test";

// Personalities is the Agents card's Identity tab now (decision 11, T-0103);
// its redirect is covered by b3-old-paths-redirect.spec.ts.
test.describe("Tools", () => {
  test("Hermes toolsets page loads with sync actions", async ({ page }) => {
    await page.goto("/agent/tools");
    await expect(page.getByRole("heading", { level: 1, name: "Tools", exact: true })).toBeVisible();
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pull from Hermes/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Push to Hermes/i })).toBeVisible();
  });

  test("creative-lead profile shows non-empty toolsets after load", async ({ page }) => {
    await page.goto("/agent/tools");
    await page.getByRole("button", { name: /Bob|Creative Lead|Profile/i }).first().click();
    await page.getByRole("button", { name: "Creative Lead" }).click();
    await expect(page.getByText(/hermes-cli|Web|CLI/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
