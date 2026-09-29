import { test, expect } from "@playwright/test";

test("a failed phone save keeps the selected chapter heading below the reader alert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const story = {
    id: "t0186-heading",
    title: "Reader Heading",
    status: "active",
    chapters: [
      { number: 1, title: "First", status: "complete", readStatus: "unread", wordCount: 100 },
      { number: 2, title: "Second", status: "complete", readStatus: "unread", wordCount: 100 },
    ],
    chapterContents: { "1": "First chapter text.", "2": "Second chapter text." },
  };
  await page.route("**/api/stories", async (route) => {
    const { action } = route.request().postDataJSON() as { action?: string };
    if (action === "load") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: story }) });
    } else if (action === "spend") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { spend: null } }) });
    } else if (action === "update") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Save unavailable" }) });
    } else {
      throw new Error(`Unexpected story action: ${action}`);
    }
  });

  await page.goto(`/recroom/story-weaver/${story.id}`);
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
