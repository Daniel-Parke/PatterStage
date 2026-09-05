import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/");
    // App shell + brand rendered (sidebar brand is present on every page).
    await expect(page.getByText("PatterStage").first()).toBeVisible();
  });

  test("missions page loads", async ({ page }) => {
    await page.goto("/work/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true })
    ).toBeVisible();
  });

  test("scripts page loads", async ({ page }) => {
    await page.goto("/work/scripts");
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

  test.describe("auth boundary", () => {
    // Drop the config-level Authorization header — even contexts made via
    // playwright.request.newContext() inherit it, so an override is the only
    // way to send a genuinely unauthenticated request.
    test.use({ extraHTTPHeaders: {} });

    test("unauthenticated API request is refused; /api/health stays public", async ({
      request,
    }) => {
      // The proxy must 401 a real API route while keeping the deliberate
      // public liveness path open.
      const refused = await request.get("/api/stats");
      expect(refused.status()).toBe(401);
      const health = await request.get("/api/health");
      expect(health.status()).toBe(200);
    });
  });

});
