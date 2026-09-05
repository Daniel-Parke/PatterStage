import { test, expect } from "@playwright/test";

test.describe("Story Weaver", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/recroom/story-weaver");
    await expect(page.getByRole("heading", { name: "Story Weaver" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  });

  test("library loads", async ({ page }) => {
    await page.goto("/recroom/story-weaver/library");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("create loads", async ({ page }) => {
    await page.goto("/recroom/story-weaver/create");
    await expect(page.getByRole("heading", { level: 1, name: "Create", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("characters and themes load", async ({ page }) => {
    await page.goto("/recroom/story-weaver/characters");
    await expect(page.getByRole("heading", { name: "Characters" })).toBeVisible({
      timeout: 30_000,
    });
    await page.goto("/recroom/story-weaver/themes");
    await expect(page.getByRole("heading", { level: 1, name: "Themes", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("optional story detail from library row", async ({ page }) => {
    await page.goto("/recroom/story-weaver/library", { waitUntil: "domcontentloaded" });
    const card = page.locator(".cursor-pointer.group").filter({ has: page.locator("h3") }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await expect(page).toHaveURL(/\/recroom\/story-weaver\/[^/]+$/);
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    } else {
      test.skip(true, "No stories in library to open detail view");
    }
  });
});
