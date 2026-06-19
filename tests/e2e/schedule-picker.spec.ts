import { test, expect } from "@playwright/test";

/**
 * E2E tests for SchedulePicker — the canonical schedule input used by the
 * missions composer (the "Schedule" dispatch mode), the Scheduled-missions
 * create form, and the Scripts schedule modal. Verifies the user-facing
 * behaviour end-to-end.
 */

test.describe("SchedulePicker (missions page)", () => {
  test("the schedule picker renders in the mission composer", async ({ page }) => {
    await page.goto("/orchestration/missions");
    // Open the new-mission composer
    await page.getByRole("button", { name: /New Mission/i }).first().click();

    // The Dispatch section is a closed accordion by default — expand it
    const dispatchAccordion = page.getByRole("button", { name: /Dispatch.*Expand/i });
    if (await dispatchAccordion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dispatchAccordion.click();
    }

    // Click the "Schedule" dispatch mode button
    const scheduleButton = page.getByRole("button", { name: /^Schedule$/ }).first();
    if (await scheduleButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await scheduleButton.click();
    }

    // The picker should be present — at minimum, a "Select a frequency" or current label button
    await expect(
      page.getByRole("button", { name: /Select a frequency|Every|Weekdays|Daily/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
