import { test, expect } from "@playwright/test";

test.describe("Tools and Personalities", () => {
  test("Hermes toolsets page loads with sync actions", async ({ page }) => {
    await page.goto("/operations/tools");
    await expect(page.getByRole("heading", { name: "Hermes Toolsets" })).toBeVisible();
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pull from Hermes/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Push to Hermes/i })).toBeVisible();
  });

  test("creative-lead profile shows non-empty toolsets after load", async ({ page }) => {
    await page.goto("/operations/tools");
    await page.getByRole("button", { name: /Bob|Creative Lead|Profile/i }).first().click();
    await page.getByRole("button", { name: "Creative Lead" }).click();
    await expect(page.getByText(/hermes-cli|Web|CLI/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("personalities page loads", async ({ page }) => {
    await page.goto("/operations/personalities");
    await expect(
      page.getByRole("heading", { name: "Personalities", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  });
});
