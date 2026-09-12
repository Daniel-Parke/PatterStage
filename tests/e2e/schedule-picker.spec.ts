import { test, expect } from "@playwright/test";

/**
 * E2E tests for SchedulePicker — the canonical schedule input used by the
 * missions composer (the "Schedule" dispatch mode), the Scheduled-missions
 * create form, and the Scripts schedule modal. Verifies the user-facing
 * behaviour end-to-end.
 */

test.describe("SchedulePicker (missions page)", () => {
  test("the schedule picker renders in the mission composer", async ({ page }) => {
    await page.goto("/work/missions");
    // Open the new-mission composer
    await page.getByRole("button", { name: /New Mission/i }).first().click();

    // The Dispatch step opens BY DEFAULT since T-0043, so there is nothing to
    // expand. This comment used to say the opposite and the click below was
    // guarded by an `isVisible().catch(() => false)` that silently did nothing
    // once the default flipped — a branch that cannot fire, above a comment that
    // was no longer true.
    //
    // Asserted rather than tolerated: if Dispatch ever collapses by default
    // again, this line fails and says so, instead of the guard quietly absorbing
    // the change and leaving the operator ruling unprotected at this level.
    // Read through aria-expanded, which MissionComposerLayout sets on the
    // accordion button, rather than through visible text. The old locator was
    // /Dispatch.*Expand/i, and the words "Expand" and "Collapse" appear nowhere
    // in that component: it never matched anything, before or after T-0043, so
    // the guarded click had always been dead.
    const dispatchAccordion = page
      .getByRole("button", { expanded: true })
      .filter({ hasText: /Dispatch/i });
    await expect(dispatchAccordion).toBeVisible({ timeout: 10_000 });

    // Click the "Schedule" dispatch mode button. Unconditional for the same
    // reason: it is visible because Dispatch is open, which the line above just
    // established.
    await page.getByRole("button", { name: /^Schedule$/ }).first().click();

    // The picker should be present — at minimum, a "Select a frequency" or current label button
    await expect(
      page.getByRole("button", { name: /Select a frequency|Every|Weekdays|Daily/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
