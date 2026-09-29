import type { Route } from "@playwright/test";

export function createStoryWeaverSaveFixture(id: string) {
  return {
    id,
    title: "The Save Boundary",
    status: "active",
    chapters: [
      { number: 1, title: "First", status: "complete", readStatus: "unread", wordCount: 100 },
      { number: 2, title: "Second", status: "complete", readStatus: "unread", wordCount: 100 },
    ],
    chapterContents: { "1": "First chapter text.", "2": "Second chapter text." },
  };
}

export async function fulfillStoryWeaverLoadOrSpend(
  route: Route,
  action: string | undefined,
  story: ReturnType<typeof createStoryWeaverSaveFixture>,
): Promise<boolean> {
  if (action === "load") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: story }) });
    return true;
  }
  if (action === "spend") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { spend: null } }) });
    return true;
  }
  return false;
}
