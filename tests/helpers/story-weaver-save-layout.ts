import type { Page } from "@playwright/test";

export async function openStoryWeaverWithFailedSaveRoute(page: Page, id: string, title: string) {
  const story = {
    id,
    title,
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
  return story;
}
