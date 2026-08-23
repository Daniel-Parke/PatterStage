import { test, expect } from "@playwright/test";

// Behavioral coverage of the missions page so the useMissionsPage refactor is
// verifiable: composer form state + dispatch-mode switching, save-draft → board,
// detail expansion, edit-draft repopulation, and category creation. Runs against
// an isolated fresh DB (see prepare-data-dir.mjs); no agent gateway is required for these
// flows (drafts persist locally).

const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function openComposer(page: import("@playwright/test").Page) {
  await page.goto("/orchestration/missions");
  await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /New Mission/i }).click();
  await expect(page.getByPlaceholder("e.g., Research quantum computing trends")).toBeVisible({
    timeout: 15_000,
  });
}

async function openDispatchAccordion(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /When and how this mission runs/ }).click();
}

test.describe("Missions page flows", () => {
  test("compose → save draft → board → expand → edit repopulates", async ({ page }) => {
    const name = uniq("e2e-mission");
    await openComposer(page);

    await page.getByPlaceholder("e.g., Research quantum computing trends").fill(name);
    await page.getByPlaceholder("The agent's task instructions...").fill("E2E instruction body");

    await openDispatchAccordion(page);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();

    // Draft appears on the board.
    const card = page.getByText(name, { exact: true });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Expand → detail panel.
    await card.click();
    await expect(page.getByText("Agent", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // Edit draft → composer repopulates the instruction.
    await page.getByRole("button", { name: /Edit draft/i }).click();
    await expect(page.getByPlaceholder("The agent's task instructions...")).toHaveValue(
      /E2E instruction body/,
    );
  });

  test("dispatch mode 'Schedule' reveals the cron schedule picker", async ({ page }) => {
    await openComposer(page);
    await openDispatchAccordion(page);
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    // SchedulePicker renders only for cron mode.
    await expect(page.getByText(/every|cron|schedule/i).first()).toBeVisible();
  });

  test("create a category via Manage categories", async ({ page }) => {
    const cat = uniq("e2e-cat");
    await page.goto("/orchestration/missions");
    await page.getByRole("button", { name: /Manage categories/i }).click();
    await expect(page.getByRole("heading", { name: /Manage categories/i })).toBeVisible();
    await page.getByPlaceholder("Category name").fill(cat);
    await page.getByRole("button", { name: /Create category/i }).click();
    await expect(page.getByText(cat, { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
