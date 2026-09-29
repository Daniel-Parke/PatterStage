import { expect, test, type Locator, type Page } from "@playwright/test";
import { createStoryWeaverSaveFixture, fulfillStoryWeaverLoadOrSpend } from "../helpers/story-weaver-save-fixture";

const story = createStoryWeaverSaveFixture("t0186-layout-oracle");

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

async function visibleBox(locator: Locator, label: string): Promise<Box> {
  await expect(locator, `${label} must be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} must have a visible bounding box`).not.toBeNull();
  return box!;
}

function overlap(first: Box, second: Box): boolean {
  return first.x < second.x + second.width && second.x < first.x + first.width
    && first.y < second.y + second.height && second.y < first.y + first.height;
}

function insideViewport(box: Box, width: number, height: number): boolean {
  return box.x >= 0 && box.y >= 0
    && box.x + box.width <= width && box.y + box.height <= height;
}

async function openFailedSave(page: Page): Promise<void> {
  await page.route("**/api/stories", async (route) => {
    const body = route.request().postDataJSON() as { action?: string };
    if (await fulfillStoryWeaverLoadOrSpend(route, body.action, story)) return;
    if (body.action === "update") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Save unavailable" }) });
      return;
    }
    throw new Error(`Unexpected story action: ${body.action}`);
  });

  await page.goto(`/recroom/story-weaver/${story.id}`);
  await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
  await page.getByRole("group", { name: "Chapters" }).first()
    .getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Save unavailable" })).toBeVisible();
}

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  test.describe(`Story Weaver failed-save layout at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("save error clears global chrome and story heading; text and dismiss stay on screen", async ({ page }) => {
      await openFailedSave(page);

      const alert = page.getByRole("alert").filter({ hasText: "Save unavailable" });
      const chrome = width === 390
        ? page.getByText("PatterStage", { exact: true }).last().locator("xpath=ancestor::a[1]/..")
        : page.getByTestId("app-rail");
      const boxes = {
        alert: await visibleBox(alert, "save-error alert"),
        text: await visibleBox(alert.getByText("Save unavailable", { exact: true }), "save-error text"),
        dismiss: await visibleBox(alert.getByRole("button"), "save-error dismiss control"),
        chrome: await visibleBox(chrome, "global navigation/header"),
        heading: await visibleBox(page.getByRole("heading", { level: 1, name: story.title }), "story heading"),
      };

      const violations: string[] = [];
      if (overlap(boxes.alert, boxes.chrome)) violations.push("alert overlaps global navigation/header");
      if (overlap(boxes.alert, boxes.heading)) violations.push("alert overlaps story heading");
      if (!insideViewport(boxes.text, width, height)) violations.push("error text extends outside viewport");
      if (!insideViewport(boxes.dismiss, width, height)) violations.push("dismiss control extends outside viewport");
      expect(violations, JSON.stringify({ viewport: { width, height }, boxes, violations }, null, 2)).toEqual([]);
    });
  });
}
