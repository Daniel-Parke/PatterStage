import { test, expect } from "@playwright/test";

// Browser-level coverage of the runtime-era surfaces (Schedules + the mission
// board). End-to-end dispatch against a real agent is covered by the
// real-Hermes integration gate (npm run test:e2e-hermes); this verifies the new
// UI renders and its key affordances are present, against the standard server.
test.describe("Runtime surfaces", () => {
  test("Schedules page renders with the create form + presets", async ({ page }) => {
    await page.goto("/orchestration/schedules");
    await expect(page.getByRole("heading", { name: "Schedules", exact: true })).toBeVisible();
    await expect(page.getByText(/Control Hub-owned recurring missions/i)).toBeVisible();
    await expect(page.getByText(/New schedule/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "every 30m", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create schedule/i })).toBeVisible();
  });

  test("Schedules appears in the Orchestration sidebar", async ({ page }) => {
    await page.goto("/orchestration/missions");
    await expect(
      page.getByRole("link", { name: "Schedules", exact: true }).first(),
    ).toBeVisible();
  });

  test("Mission board renders with the New Mission affordance", async ({ page }) => {
    await page.goto("/orchestration/missions");
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Mission/i })).toBeVisible();
  });
});
