import { test, expect } from "@playwright/test";

test("a phone save error leaves the chapter controls usable after navigation settles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const story = {
    id: "t0186-controls",
    title: "Reader Controls",
    status: "active",
    chapters: [
      { number: 1, title: "First", status: "complete", readStatus: "unread", wordCount: 100 },
      { number: 2, title: "Second", status: "complete", readStatus: "unread", wordCount: 100 },
    ],
    chapterContents: { "1": "First chapter text.", "2": "Second chapter text." },
  };
  await page.route("**/api/stories", async (route) => {
    const { action } = route.request().postDataJSON() as { action?: string };
    const body = action === "load" ? { data: story }
      : action === "spend" ? { data: { spend: null } }
      : action === "update" ? { error: "Save unavailable" }
      : null;
    if (!body) throw new Error(`Unexpected story action: ${action}`);
    await route.fulfill({ status: action === "update" ? 503 : 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`/recroom/story-weaver/${story.id}`);
  await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
  await page.getByRole("group", { name: "Chapters" }).first()
    .getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Save unavailable" });
  await expect(alert).toBeVisible();
  // The page schedules smooth scroll 50 ms after chapter selection. Check the
  // settled control positions, not an intermediate animation frame.
  await page.waitForTimeout(750);
  const chaptersButton = page.locator('button[title="Show chapters"]');
  const alertBox = await alert.boundingBox();
  const buttonBox = await chaptersButton.boundingBox();
  expect(alertBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  const overlap = alertBox!.x < buttonBox!.x + buttonBox!.width
    && buttonBox!.x < alertBox!.x + alertBox!.width
    && alertBox!.y < buttonBox!.y + buttonBox!.height
    && buttonBox!.y < alertBox!.y + alertBox!.height;
  expect(overlap, JSON.stringify({ alertBox, buttonBox })).toBe(false);
  await chaptersButton.click();
  await expect(page.getByRole("dialog", { name: "Chapters" })).toBeVisible();
});
