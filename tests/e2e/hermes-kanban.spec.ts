// ═══════════════════════════════════════════════════════════════
// hermes-kanban.spec.ts — Hermes Kanban board smoke test
// ═══════════════════════════════════════════════════════════════
// Verifies the new Kanban board page renders correctly with
// columns, toolbar, and create modal.
// ═══════════════════════════════════════════════════════════════

import { test, expect } from "@playwright/test";

test.describe("Hermes Kanban Board", () => {
  test("page loads with correct heading and columns", async ({ page }) => {
    await page.goto("/orchestration/hermes-kanban");

    // Wait for page to render
    await page.waitForSelector("text=Kanban Board", { timeout: 10000 });

    // Should see the 7 status columns
    await expect(page.locator("text=Triage")).toBeVisible();
    await expect(page.locator("text=Todo")).toBeVisible();
    await expect(page.locator("text=Ready")).toBeVisible();
    await expect(page.locator("text=Running")).toBeVisible();
    await expect(page.locator("text=Blocked")).toBeVisible();
    await expect(page.locator("text=Done")).toBeVisible();
    await expect(page.locator("text=Archived")).toBeVisible();
  });

  test("toolbar with search and filters is visible", async ({ page }) => {
    await page.goto("/orchestration/hermes-kanban");
    await page.waitForSelector("text=Kanban Board");

    // Search input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();

    // Nudge dispatcher button
    await expect(page.locator("text=Nudge Dispatcher")).toBeVisible();
  });

  test("create task modal opens and has required fields", async ({ page }) => {
    await page.goto("/orchestration/hermes-kanban");
    await page.waitForSelector("text=Kanban Board");

    // Click new task button
    await page.click("text=New Task");

    // Modal should be visible
    await expect(page.locator("text=Create Kanban Task")).toBeVisible();

    // Title field should be present
    await expect(page.locator('input[placeholder*="task title"]')).toBeVisible();

    // Close modal
    await page.click("button:has(svg.lucide-x)");
  });

  test("inline create input appears in column", async ({ page }) => {
    await page.goto("/orchestration/hermes-kanban");
    await page.waitForSelector("text=Kanban Board");

    // Click the + button on Todo column
    const todoColumn = page.locator("text=Todo").first();
    await todoColumn.scrollIntoViewIfNeeded();

    // Find + button within the column
    const plusButton = page.locator("button:has(svg.lucide-plus)").first();
    await plusButton.click();

    // Inline input should appear
    await expect(page.locator('input[placeholder*="Quick title"]')).toBeVisible();
  });
});
