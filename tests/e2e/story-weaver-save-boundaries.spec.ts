import { expect, test, type Page } from "@playwright/test";

type Chapter = {
  number: number;
  title: string;
  status: "complete";
  readStatus: "unread" | "read";
  wordCount: number;
};

type Story = {
  id: string;
  title: string;
  status: "active";
  chapters: Chapter[];
  chapterContents: Record<string, string>;
};

type Acknowledgement = "saved" | "empty" | "malformed" | "unchanged";
type ChapterUpdate = Partial<Chapter> & Pick<Chapter, "number">;

function newStory(): Story {
  return {
    id: "t0186-save-boundaries",
    title: "The Save Boundary",
    status: "active",
    chapters: [
      { number: 1, title: "First", status: "complete", readStatus: "unread", wordCount: 100 },
      { number: 2, title: "Second", status: "complete", readStatus: "unread", wordCount: 100 },
      { number: 3, title: "Third", status: "complete", readStatus: "unread", wordCount: 100 },
    ],
    chapterContents: {
      "1": "First chapter text.",
      "2": "Second chapter text.",
      "3": "Third chapter text.",
    },
  };
}

async function openReader(page: Page, acknowledgement: Acknowledgement, delayFirstSave = false) {
  let serverStory = newStory();
  let updateCount = 0;
  let completedUpdates = 0;

  await page.route("**/api/stories", async (route) => {
    const request = route.request().postDataJSON() as { action?: string; chapters?: ChapterUpdate[] };
    if (request.action === "load") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: serverStory }) });
      return;
    }
    if (request.action === "spend") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { spend: null } }) });
      return;
    }
    if (request.action !== "update") {
      throw new Error(`Unexpected story action: ${request.action}`);
    }
    if (!Array.isArray(request.chapters)) {
      throw new Error("Read-status save did not include a chapter array");
    }

    updateCount += 1;
    const saveNumber = updateCount;
    if (delayFirstSave && saveNumber === 1) {
      // The second selection may complete first. Each completed request merges
      // its submitted chapters by number, as the story API does.
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    let body: unknown;
    if (acknowledgement === "saved") {
      const submitted = new Map(request.chapters.map((chapter) => [chapter.number, chapter]));
      serverStory = {
        ...serverStory,
        chapters: serverStory.chapters.map((chapter) => ({ ...chapter, ...submitted.get(chapter.number) })),
      };
      body = { data: serverStory };
    } else if (acknowledgement === "empty") {
      body = {};
    } else if (acknowledgement === "malformed") {
      body = { data: { ...serverStory, chapters: "not a chapter array" } };
    } else {
      body = { data: serverStory };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    completedUpdates += 1;
  });

  await page.goto(`/recroom/story-weaver/${serverStory.id}`);
  await expect(page.getByRole("heading", { level: 1, name: serverStory.title })).toBeVisible();
  return {
    updates: () => updateCount,
    completed: () => completedUpdates,
  };
}

async function selectChapter(page: Page, number: number, title: string) {
  await page.getByRole("group", { name: "Chapters" }).first()
    .getByRole("button", { name: `Chapter ${number}: ${title} (complete)` }).click();
}

async function chaptersPanel(page: Page, width: number) {
  if (width === 390) {
    const dialog = page.getByRole("dialog", { name: "Chapters" });
    if (!(await dialog.isVisible())) {
      await page.locator('button[title="Show chapters"]').click();
    }
    return dialog;
  }
  return page.getByRole("complementary", { name: "Chapters" });
}

async function expectReadStatus(page: Page, width: number, title: string, read: boolean) {
  const panel = await chaptersPanel(page, width);
  await expect.soft(panel.getByRole("button", { name: new RegExp(title) }).locator('[aria-label="Read"]'))
    .toHaveCount(read ? 1 : 0);
}

for (const width of [1440, 390]) {
  test.describe(`Story Weaver save boundaries at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    for (const acknowledgement of ["empty", "malformed", "unchanged"] as const) {
      test(`200 ${acknowledgement} response leaves the selection unread and reports failure`, async ({ page }) => {
        const server = await openReader(page, acknowledgement);
        await selectChapter(page, 2, "Second");
        await expect.poll(server.completed).toBe(1);
        await expect.soft(page.getByRole("alert").filter({ hasText: /save|failed|unavailable/i })).toBeVisible();
        await expectReadStatus(page, width, "Second", false);
        await expect(page.getByRole("heading", { level: 2, name: /Second/ })).toBeVisible();
      });
    }

    test("confirmed save marks the chapter read and survives reload", async ({ page }) => {
      const server = await openReader(page, "saved");
      await selectChapter(page, 2, "Second");
      await expect.poll(server.completed).toBe(1);
      await expectReadStatus(page, width, "Second", true);
      await page.reload();
      await expectReadStatus(page, width, "Second", true);
    });

    test("overlapping selections preserve both read marks after reload", async ({ page }) => {
      const server = await openReader(page, "saved", true);
      await selectChapter(page, 2, "Second");
      await expect.poll(server.updates).toBe(1);
      await selectChapter(page, 3, "Third");
      await expect.poll(server.completed).toBe(2);
      await page.reload();
      await expectReadStatus(page, width, "Second", true);
      await expectReadStatus(page, width, "Third", true);
    });

    test("Next failed save leaves its chapter unread and navigation usable", async ({ page }) => {
      const server = await openReader(page, "empty");
      await expect(page.getByRole("heading", { level: 2, name: /First/ })).toBeVisible();
      await page.getByRole("button", { name: "Second", exact: true }).click();
      await expect.poll(server.completed).toBe(1);
      await expect.soft(page.getByRole("alert").filter({ hasText: /save|failed|unavailable/i })).toBeVisible();
      await expectReadStatus(page, width, "First", false);
      await expect(page.getByRole("heading", { level: 2, name: /Second/ })).toBeVisible();
      if (width === 390) {
        await page.getByRole("button", { name: "Close chapter list" }).click();
      }
      await page.getByRole("button", { name: "First", exact: true }).click();
      await expect(page.getByRole("heading", { level: 2, name: /First/ })).toBeVisible();
    });
  });
}
