import { test, expect } from "@playwright/test";

// T-0092, finding E from this device's browser pass: at ~1280px the Missions
// stats strip's Total/Active and Done/Failed labels overlapped. Measured by
// bounding boxes, not by eye: no two tile labels may intersect.

test.describe("Missions stats strip at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("tile labels do not overlap", async ({ page }) => {
    // The strip renders only when there is at least one mission.
    const created = await page.request.post("/api/missions", {
      data: { action: "dispatch", instruction: "Stats strip probe mission", dispatchMode: "save" },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/work/missions");
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();

    // The ratified words (decision 13). "Active" and "Done" were the second
    // vocabulary this strip spoke; B10 gave it the board's five (T-0104).
    const labels = ["Total", "Running", "Completed", "Failed"];
    const boxes: { label: string; x: number; right: number; y: number; bottom: number }[] = [];
    for (const label of labels) {
      const el = page.getByText(label, { exact: true }).first();
      await expect(el).toBeVisible();
      const b = (await el.boundingBox())!;
      boxes.push({ label, x: b.x, right: b.x + b.width, y: b.y, bottom: b.y + b.height });
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i], b = boxes[j];
        const overlaps = a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        expect(overlaps, `${a.label} overlaps ${b.label}`).toBeFalsy();
      }
    }
  });
});
