import { test, expect } from "@playwright/test";

// Two routes since decision 6 (U12, T-0126): the library is the page at the
// door, Characters and Themes are panels on Create, and the three retired
// addresses answer 307 to where their content went.
test.describe("Story Weaver", () => {
  test("the library is the page at the door", async ({ page }) => {
    await page.goto("/recroom/story-weaver");
    await expect(page.getByRole("heading", { level: 1, name: "Story Weaver" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("radiogroup", { name: "Filter stories" })).toBeVisible();
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  });

  test("create loads, with both libraries on it", async ({ page }) => {
    await page.goto("/recroom/story-weaver/create");
    await expect(page.getByRole("heading", { level: 1, name: "Create", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Saved themes", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Character library", exact: true })).toBeVisible();
  });

  test("the three retired addresses land where their content went", async ({ page }) => {
    await page.goto("/recroom/story-weaver/library");
    await expect(page).toHaveURL(/\/recroom\/story-weaver\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Story Weaver" })).toBeVisible({
      timeout: 30_000,
    });

    // Landing on the anchor means the panel is IN VIEW, not merely on the
    // page: the browser's own fragment jump fires before this client page has
    // rendered its sections, so the page scrolls to the anchor itself.
    await page.goto("/recroom/story-weaver/characters");
    await expect(page).toHaveURL(/\/recroom\/story-weaver\/create#characters$/);
    await expect(page.getByRole("heading", { name: "Character library", exact: true })).toBeInViewport({ timeout: 30_000 });

    await page.goto("/recroom/story-weaver/themes");
    await expect(page).toHaveURL(/\/recroom\/story-weaver\/create#themes$/);
    await expect(page.getByRole("heading", { name: "Saved themes", exact: true })).toBeInViewport({ timeout: 30_000 });
  });

  test("optional story detail from a shelf row", async ({ page }) => {
    await page.goto("/recroom/story-weaver", { waitUntil: "domcontentloaded" });
    const shelf = page.getByTestId("story-shelf");
    if (await shelf.isVisible().catch(() => false)) {
      await shelf.getByRole("link").first().click();
      await expect(page).toHaveURL(/\/recroom\/story-weaver\/[^/]+$/);
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    } else {
      test.skip(true, "No stories on the shelf to open");
    }
  });
});
