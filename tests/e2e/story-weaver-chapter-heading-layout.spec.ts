import { test, expect } from "@playwright/test";
import { openStoryWeaverWithFailedSaveRoute } from "../helpers/story-weaver-save-layout";

test("a failed phone save keeps the selected chapter heading below the reader alert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const story = await openStoryWeaverWithFailedSaveRoute(page, "t0186-heading", "Reader Heading");
  await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
  await page.getByRole("group", { name: "Chapters" }).first()
    .getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Save unavailable" });
  const chapterHeading = page.getByRole("heading", { level: 2, name: "Chapter 2: Second" });
  await expect(alert).toBeVisible();
  await expect(chapterHeading).toBeVisible();
  await page.waitForTimeout(750);
  const alertBox = await alert.boundingBox();
  const headingBox = await chapterHeading.boundingBox();
  expect(alertBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.y, JSON.stringify({ alertBox, headingBox })).toBeGreaterThanOrEqual(alertBox!.y + alertBox!.height);
});
