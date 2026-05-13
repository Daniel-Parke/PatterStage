import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/");
    const title = page.locator("h1").filter({ hasText: "CONTROL" });
    await expect(title).toBeVisible();
    await expect(title.getByText("HUB", { exact: true })).toBeVisible();
  });

  test("cron page loads", async ({ page }) => {
    await page.goto("/cron");
    await expect(
      page.getByRole("heading", { name: "Cron Jobs", exact: true })
    ).toBeVisible();
  });

  test("missions page loads", async ({ page }) => {
    await page.goto("/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true })
    ).toBeVisible();
  });

  test("unknown app route returns 404 (no extra middleware redirect)", async ({
    request,
  }) => {
    const response = await request.get("/operations");
    expect(response.status()).toBe(404);
  });

});
