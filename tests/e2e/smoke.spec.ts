import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/");
    // App shell + brand rendered (sidebar brand is present on every page).
    await expect(page.getByText("PatterStage").first()).toBeVisible();
  });

  test("missions page loads", async ({ page }) => {
    await page.goto("/orchestration/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true })
    ).toBeVisible();
  });

  test("scripts page loads", async ({ page }) => {
    await page.goto("/orchestration/scripts");
    await expect(
      page.getByRole("heading", { name: "Scripts", exact: true })
    ).toBeVisible();
  });

  test("unknown app route returns 404 (no extra middleware redirect)", async ({
    request,
  }) => {
    const response = await request.get("/operations");
    expect(response.status()).toBe(404);
  });

});
