import { test, expect } from "@playwright/test";

// Browser-level coverage of the runtime-era surfaces (the mission board + its
// folded-in Scheduled missions section, and the Scripts page). End-to-end
// dispatch against a real agent is covered by the real-Hermes integration gate
// (npm run test:e2e-hermes); this verifies the new UI renders and its key
// affordances are present, against the standard server.
test.describe("Runtime surfaces", () => {
  test("Missions page surfaces the Scheduled missions section + presets", async ({ page }) => {
    await page.goto("/orchestration/missions");
    await expect(page.getByRole("heading", { name: "Scheduled missions", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Schedule a mission/i }).click();
    await expect(page.getByRole("button", { name: "every 30m", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create schedule/i })).toBeVisible();
  });

  test("Scripts appears in the Orchestration sidebar and the page renders", async ({ page }) => {
    await page.goto("/orchestration/scripts");
    await expect(page.getByRole("heading", { name: "Scripts", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Scripts", exact: true }).first(),
    ).toBeVisible();
  });

  test("Mission board renders with the New Mission affordance", async ({ page }) => {
    await page.goto("/orchestration/missions");
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Mission/i })).toBeVisible();
  });
});
