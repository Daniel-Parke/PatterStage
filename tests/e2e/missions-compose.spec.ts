import { test, expect } from "@playwright/test";

test.describe("Missions composer", () => {
  test("sheet shows category combobox and create row for new category", async ({
    page,
  }) => {
    await page.goto("/work/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: /New Mission/i }).click();

    await expect(
      page.getByText(/Category, task, and dispatch settings/i),
    ).toBeVisible({ timeout: 15_000 });

    const trigger = page.getByTestId("category-combobox-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const search = page.getByPlaceholder(/Search or create/i);
    await expect(search).toBeVisible();
    await search.fill("E2E Test Category");

    await expect(page.getByTestId("category-combobox-create")).toBeVisible();
    await expect(
      page.getByText(/Create category "E2E Test Category"/i),
    ).toBeVisible();

    await expect(page.getByText(/Mission Name/i)).toBeVisible();
    await expect(page.getByText(/^Instruction$/i)).toBeVisible();
  });

  test("manage categories modal has create form", async ({ page }) => {
    await page.goto("/work/missions");
    await page.getByRole("button", { name: /Manage categories/i }).click();
    await expect(
      page.getByRole("heading", { name: /Manage categories/i }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Category name"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create category/i }),
    ).toBeVisible();
  });
});
