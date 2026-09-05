import { test, expect } from "@playwright/test";

// Behavioral coverage of the missions page so the useMissionsPage refactor is
// verifiable: composer form state + dispatch-mode switching, save-draft → board,
// detail expansion, edit-draft repopulation, and category creation. Runs against
// an isolated fresh DB (see prepare-data-dir.mjs); no agent gateway is required for these
// flows (drafts persist locally).
//
// T-0043: Dispatch opens BY DEFAULT, so no flow here clicks its way in any
// more — showing the operator the choice IS the acknowledgement. The gate is
// unchanged and still asserted, on the collapsed path, by
// "Dispatch collapsed re-arms the gate" below.

const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function openComposer(page: import("@playwright/test").Page) {
  await page.goto("/work/missions");
  // See seed-catalog.spec.ts: the heading is client-rendered, so this waits for
  // hydration rather than racing it.
  await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /New Mission/i }).click();
  await expect(page.getByPlaceholder("e.g., Research quantum computing trends")).toBeVisible({
    timeout: 15_000,
  });
}

/** The Dispatch accordion header. Open by default; clicking it collapses. */
const dispatchToggle = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /When and how this mission runs/ });

test.describe("Missions page flows", () => {
  test("compose → save draft → board → expand → edit repopulates", async ({ page }) => {
    const name = uniq("e2e-mission");
    await openComposer(page);

    await page.getByPlaceholder("e.g., Research quantum computing trends").fill(name);
    await page.getByPlaceholder("The agent's task instructions...").fill("E2E instruction body");

    // No dispatch click: the choice is already on screen, so the mission is
    // submittable as soon as it has a name and an instruction.
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

  test("Dispatch is open by default, and collapsing it re-arms the gate", async ({ page }) => {
    await openComposer(page);
    await page.getByPlaceholder("e.g., Research quantum computing trends").fill(uniq("e2e-gate"));
    await page.getByPlaceholder("The agent's task instructions...").fill("Gate check");

    const save = page.getByRole("button", { name: "Save draft", exact: true });
    const hint = page.getByText(/to choose how this mission runs before submitting/i);

    // Default: the choice is visible and that is the acknowledgement.
    await expect(page.getByRole("button", { name: "Run now", exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
    await expect(hint).toHaveCount(0);

    // Collapsed: the gate is still there, and the button itself says why.
    await dispatchToggle(page).click();
    await expect(page.getByRole("button", { name: "Run now", exact: true })).toHaveCount(0);
    await expect(save).toBeDisabled();
    await expect(hint).toBeVisible();
    await expect(save).toHaveAttribute("title", /Dispatch/);

    // Re-opened: gate lifted again.
    await dispatchToggle(page).click();
    await expect(save).toBeEnabled();
  });

  test("dispatch mode 'Schedule' reveals the cron schedule picker", async ({ page }) => {
    await openComposer(page);
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    // SchedulePicker renders only for cron mode.
    await expect(page.getByText(/every|cron|schedule/i).first()).toBeVisible();
  });

  test("create a category via Manage categories", async ({ page }) => {
    const cat = uniq("e2e-cat");
    await page.goto("/work/missions");
    await page.getByRole("button", { name: /Manage categories/i }).click();
    await expect(page.getByRole("heading", { name: /Manage categories/i })).toBeVisible();
    await page.getByPlaceholder("Category name").fill(cat);
    await page.getByRole("button", { name: /Create category/i }).click();
    await expect(page.getByText(cat, { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
