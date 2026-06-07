import { test, expect } from "@playwright/test";

/**
 * E2E tests for SchedulePicker — the canonical schedule input used by
 * both the cron page and the missions page. Verifies the user-facing
 * behaviour end-to-end (preset selection, day-of-week picker, schedule
 * persistence, edit-mode repeat toggle).
 */

test.describe("SchedulePicker (cron page)", () => {
  test("create a cron job with a Weekly preset and verify the schedule persists", async ({ page, request }) => {
    const uniqueName = `E2E Schedule Test ${Date.now()}`;

    // Pre-clean: delete any prior test job with this name (idempotency)
    const before = await request.get("/api/cron");
    const beforeJson = await before.json();
    const prior = (beforeJson.data?.jobs ?? []).find(
      (j: { name: string }) => j.name === uniqueName,
    );
    if (prior) {
      await request.delete(`/api/cron?id=${prior.id}`);
    }

    // Open the cron page and the New Job modal
    await page.goto("/orchestration/cron");
    await page.getByRole("button", { name: /New Job/i }).first().click();
    await expect(page.getByRole("heading", { name: /New Cron Job/i })).toBeVisible();

    // Fill the name
    await page.getByPlaceholder(/daily-health-check/i).fill(uniqueName);

    // Open the schedule picker dropdown
    await page.getByRole("button", { name: /Select a frequency/i }).click();

    // Click the "Weekdays at 9am" preset
    await page.getByRole("button", { name: /Weekdays at 9am/i }).click();

    // The read-only cron display (in a <code> element) should now show 0 9 * * 1-5.
    // Use getByRole("code") to disambiguate from the dropdown button text.
    await expect(page.getByRole("code").filter({ hasText: "0 9 * * 1-5" })).toBeVisible();

    // Fill prompt and submit
    await page.getByPlaceholder(/What should the agent do\?/i).fill("E2E test job");
    await page.getByRole("button", { name: /Create Job/i }).click();

    // Wait for the modal to close
    await expect(page.getByRole("heading", { name: /New Cron Job/i })).not.toBeVisible();

    // Verify the job exists in the API
    const after = await request.get("/api/cron");
    const afterJson = await after.json();
    const created = (afterJson.data?.jobs ?? []).find(
      (j: { name: string }) => j.name === uniqueName,
    );
    expect(created).toBeTruthy();
    // The schedule field is now correctly normalised to raw cron by recordToApiJob
    expect(created.schedule).toBe("0 9 * * 1-5");

    // Cleanup
    await request.delete(`/api/cron?id=${created.id}`);
  });

  test("day-of-week picker surfaces in the UI", async ({ page }) => {
    await page.goto("/orchestration/cron");
    await page.getByRole("button", { name: /New Job/i }).first().click();
    await expect(page.getByRole("heading", { name: /New Cron Job/i })).toBeVisible();

    // Open the dropdown and click "Custom…"
    await page.getByRole("button", { name: /Select a frequency/i }).click();
    await page.getByRole("button", { name: /Custom…/i }).click();

    // The custom builder should show day-of-week checkboxes
    await expect(page.getByText(/Days of week/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mon$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sun$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Weekdays$/ })).toBeVisible();
  });

  test("edit-mode shows the Repeat toggle (was previously hidden)", async ({ page, request }) => {
    const uniqueName = `E2E Edit Test ${Date.now()}`;

    // Create a job first via the API
    const created = await request.post("/api/cron", {
      data: {
        name: uniqueName,
        schedule: "0 */2 * * *",
        prompt: "E2E edit test",
        repeat: { times: null, completed: 0 },
      },
    });
    // POST returns 201 (created)
    expect(created.ok()).toBe(true);
    const createdJson = await created.json();
    const jobId = createdJson.data?.job?.id;
    expect(jobId).toBeTruthy();

    // Allow generous time for the cron page to load and render the row
    test.setTimeout(60_000);

    try {
      // Open the cron page and click edit on the new job
      await page.goto("/orchestration/cron", { timeout: 45_000 });
      // The job name is rendered in an <h3> inside the JobCard.
      // The Edit button is icon-only with title="Edit", located in the same card.
      const jobCard = page.locator("div", { has: page.locator("h3", { hasText: uniqueName }) }).first();
      await jobCard.waitFor({ timeout: 15_000 });
      await jobCard.locator("button[title='Edit']").first().click({ timeout: 15_000 });

      // The edit modal should show the Repeat toggle
      await expect(page.getByRole("heading", { name: /Edit:/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/^Repeat$/)).toBeVisible();
      await expect(page.getByText(/Toggle between recurring and one-shot/i)).toBeVisible();
    } finally {
      // Cleanup via the API fixture (not page.request, which closes with the page)
      try {
        await request.delete(`/api/cron?id=${jobId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});

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

    // Click the "Schedule" dispatch mode button (id: "cron")
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
