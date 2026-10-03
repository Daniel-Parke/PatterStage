import { test, expect, type Page } from "@playwright/test";
import { createStoryWeaverSaveFixture, fulfillStoryWeaverLoadOrSpend } from "../helpers/story-weaver-save-fixture";

type SaveResult = "http-error" | "network-error" | "success";

const story = createStoryWeaverSaveFixture("t0186-reader");

async function openReader(page: Page, result: SaveResult): Promise<unknown[]> {
  const updates: unknown[] = [];
  await page.route("**/api/stories", async (route) => {
    const body = route.request().postDataJSON() as { action?: string; chapters?: Array<{ number: number; readStatus?: string }> };
    if (await fulfillStoryWeaverLoadOrSpend(route, body.action, story)) return;
    if (body.action === "update") {
      updates.push(body.chapters);
      if (result === "network-error") {
        await route.abort("failed");
      } else {
        await route.fulfill({
          status: result === "success" ? 200 : 503,
          contentType: "application/json",
          body: JSON.stringify(result === "success"
            ? { data: { ...story, chapters: story.chapters.map((chapter) => ({
              ...chapter,
              ...body.chapters?.find((submitted) => submitted.number === chapter.number),
            })) } }
            : { error: "Save unavailable" }),
        });
      }
      return;
    }
    throw new Error(`Unexpected story action: ${body.action}`);
  });
  await page.goto(`/recroom/story-weaver/${story.id}`);
  await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
  return updates;
}

async function chapterList(page: Page, width: number) {
  if (width === 390) {
    await page.locator('button[title="Show chapters"]').click();
    return page.getByRole("dialog", { name: "Chapters" });
  }
  return page.getByRole("complementary", { name: "Chapters" });
}

for (const width of [1440, 390]) {
  test.describe(`Story Weaver save at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    for (const result of ["http-error", "network-error"] as const) {
      test(`${result} leaves the selected chapter unread and reports failure`, async ({ page }) => {
        const updates = await openReader(page, result);
        await page.getByRole("group", { name: "Chapters" }).first()
          .getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
        await expect.poll(() => updates.length).toBe(1);
        await expect(page.getByRole("alert").filter({ hasText: result === "http-error" ? "Save unavailable" : /save|network|failed/i })).toBeVisible();
        const list = await chapterList(page, width);
        await expect(list.getByRole("button", { name: /Second/ }).locator('[aria-label="Read"]')).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 2, name: /Second/ })).toBeVisible();
      });
    }

    test("successful save marks the selected chapter read and keeps navigation", async ({ page }) => {
      const updates = await openReader(page, "success");
      await page.getByRole("group", { name: "Chapters" }).first()
        .getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
      await expect.poll(() => updates.length).toBe(1);
      const list = await chapterList(page, width);
      await expect(list.getByRole("button", { name: /Second/ }).locator('[aria-label="Read"]')).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 2, name: /Second/ })).toBeVisible();
    });
  });
}
