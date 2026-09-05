import { test, expect } from "@playwright/test";

// A journey, not a render assertion.
//
// This file used to open with its own confession: it "verifies the new UI
// renders and its key affordances are present". Three tests, all of the form
// "go to a page, a heading is visible". WG-DEL-002 named that shape when it
// ruled the end-to-end acceptance suite blocks main, so this is the file that
// changes shape first.
//
// The journey below is one an operator actually performs: put a saved mission
// on a timer from the Missions page, see the schedule land in the list with the
// cadence they chose, pause it, reload to prove it survived the round trip to
// the database, and remove it again. Every affordance the old file asserted is
// still touched on the way through: the Missions heading, the New Mission
// button, the Scheduled missions section, the "every 30m" preset, the Create
// schedule button, the Scripts page and its sidebar link, so nothing it
// covered was traded away for the conversion.
//
// PatterStage owns this timer (orchestration/scheduler; no Hermes jobs.json),
// so create, list, pause and delete need no agent runtime. Firing a schedule at
// a real agent stays where it was, with the real-Hermes gate
// (npm run test:e2e-hermes).

const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test.describe("Scheduling a mission", () => {
  test("save a mission, put it on a timer, pause it, reload, remove it", async ({
    page,
    request,
  }) => {
    const missionName = uniq("e2e-scheduled-mission");
    const scheduleName = uniq("e2e-schedule");

    // Fixture, not the journey: the schedule form puts an *existing* saved
    // mission on a timer, so one has to exist. Composing a draft through the
    // sheet is missions-flows.spec.ts's journey; this one starts after it.
    const saved = await request.post("/api/missions", {
      data: {
        action: "dispatch",
        name: missionName,
        instruction: "Journey fixture: a saved mission for the scheduler.",
        dispatchMode: "save",
      },
    });
    expect(saved.ok()).toBeTruthy();

    await page.goto("/work/missions");
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Mission/i })).toBeVisible();

    const scheduled = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Scheduled missions", exact: true }) });
    await expect(scheduled).toBeVisible();

    // ── Open the create form ────────────────────────────────────────────────
    await scheduled.getByRole("button", { name: /Schedule a mission/i }).click();
    const form = page
      .locator("form")
      .filter({ hasText: /Put an existing saved mission on a timer/i });
    await expect(form).toBeVisible({ timeout: 15_000 });

    // The saved mission is offered by name. This is the assertion the old
    // "presets are visible" test could not make: the form is wired to real data.
    const missionSelect = form
      .locator("select")
      .filter({ has: page.getByRole("option", { name: missionName }) });
    await expect(missionSelect).toBeVisible({ timeout: 15_000 });
    await missionSelect.selectOption({ label: missionName });

    await form.getByPlaceholder("daily digest").fill(scheduleName);

    // ── The presets set the cadence, rather than merely existing ─────────────
    // The schedule field is the one input in this form with no placeholder.
    const cadence = form.locator("input:not([placeholder])");
    await expect(cadence).toHaveValue("every 30m");
    await expect(form.getByRole("button", { name: "every 30m", exact: true })).toBeVisible();
    await form.getByRole("button", { name: "every 1h", exact: true }).click();
    await expect(cadence).toHaveValue("every 1h");

    // ── Create ──────────────────────────────────────────────────────────────
    await form.getByRole("button", { name: /Create schedule/i }).click();
    // A successful create closes the form; a rejected one leaves it open with
    // the error, so this also asserts the request was accepted.
    await expect(form).toBeHidden({ timeout: 15_000 });

    const row = scheduled
      .locator("div")
      .filter({ hasText: scheduleName })
      .filter({ has: page.getByRole("button", { name: /^(Pause|Resume)$/ }) })
      .last();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("every 1h");

    // ── Pause ───────────────────────────────────────────────────────────────
    await row.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(row.getByRole("button", { name: "Resume", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(row).toContainText("paused");

    // ── It survives a reload, which is what "scheduled" has to mean ─────────
    await page.reload();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("every 1h");
    await expect(row).toContainText("paused");

    // ── Remove ──────────────────────────────────────────────────────────────
    // The delete control has a name now, and takes two clicks: it is a
    // ConfirmButton, per row, and the armed button is not disabled (T-0104,
    // D73). The positional locator and the note about an unnamed icon button
    // that used to be here are both obsolete.
    const del = row.getByRole("button", { name: `Delete the schedule "${scheduleName}"` });
    await del.click();
    await expect(del).toContainText("Confirm?");
    await expect(scheduled.getByText(scheduleName, { exact: true })).toHaveCount(1);
    await del.click();
    await expect(scheduled.getByText(scheduleName, { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("reach Scripts from the Work section of the rail", async ({ page }) => {
    await page.goto("/work/missions");
    await page.getByRole("link", { name: "Scripts", exact: true }).first().click();
    await expect(page).toHaveURL(/\/work\/scripts$/);
    await expect(page.getByRole("heading", { name: "Scripts", exact: true })).toBeVisible();
  });
});
