import { test, expect } from "@playwright/test";

// T-0092, finding E from this device's browser pass: at ~1280px the Missions
// stats strip's Total/Active and Done/Failed labels overlapped. Measured by
// bounding boxes, not by eye: no two labels may intersect.
//
// U9 (T-0123) moved what this measures. The four count tiles are gone - they
// restated the five numbers the board writes on its own column headers, on the
// screen whose worst problem was vertical space - and the counts went onto the
// status filter, where a number says what you are about to filter TO.
//
// So this holds the same property at the surface that now carries those words,
// and it is a STRONGER reading than the one it replaces: it walks every option
// in the group rather than four named tiles, so a sixth filter added tomorrow
// is measured too. The failure it exists to catch - labels colliding when the
// row runs out of width - is exactly the failure a wrapping filter bar can
// still have.

test.describe("Missions status filter at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("filter labels do not overlap", async ({ page }) => {
    // The board and its filter render only when there is at least one mission.
    const created = await page.request.post("/api/missions", {
      data: { action: "dispatch", instruction: "Stats strip probe mission", dispatchMode: "save" },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/work/missions");
    await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();

    const group = page.getByRole("radiogroup", { name: "Status" });
    await expect(group).toBeVisible();
    const options = group.getByRole("radio");
    // The ratified words (decision 13), plus All: six of them.
    await expect(options).toHaveCount(6);

    const boxes: { label: string; x: number; right: number; y: number; bottom: number }[] = [];
    for (const option of await options.all()) {
      const label = (await option.textContent())?.trim() ?? "?";
      const b = (await option.boundingBox())!;
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
