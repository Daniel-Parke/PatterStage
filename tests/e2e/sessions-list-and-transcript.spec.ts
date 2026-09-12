import { test, expect } from "@playwright/test";

// B11 (T-0105). The sessions list and one transcript, walked the way an
// operator walks them: filter, page, open, come back. The unit oracles hold
// the shapes; this holds that the shapes are wired to each other.

test.describe("Sessions", () => {
  test("the view is in the URL, and a reload restores it", async ({ page }) => {
    await page.goto("/results/sessions");
    await expect(page.getByRole("heading", { level: 1, name: "Sessions", exact: true })).toBeVisible();

    await page.getByLabel(/Search sessions/i).fill("zzz-no-such-session");
    await expect(page).toHaveURL(/search=zzz-no-such-session/, { timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel(/Search sessions/i)).toHaveValue("zzz-no-such-session");
  });

  test("the Failed filter is a filter, and asks the server for it", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/sessions?")) asked.push(r.url());
    });

    await page.goto("/results/sessions");
    await expect(page.getByRole("heading", { level: 1, name: "Sessions", exact: true })).toBeVisible();

    const failed = page.getByRole("button", { name: "Failed", exact: true });
    if ((await failed.count()) === 0) {
      // No sources at all means an empty table on this instance: the filter
      // bar is gated on having something to filter, which is correct.
      test.skip(true, "the instance has no sessions to filter");
      return;
    }
    await failed.click();
    await expect(page).toHaveURL(/status=failed/, { timeout: 15_000 });
    await expect
      .poll(() => asked.some((u) => u.includes("status=failed")), { timeout: 15_000 })
      .toBe(true);
  });

  test("a transcript that does not exist says so, and offers a way back", async ({ page }) => {
    await page.goto("/results/sessions/definitely-not-a-session-id");

    await expect(page.getByText(/Session not found|Couldn't load this transcript/)).toBeVisible({
      timeout: 20_000,
    });
    // Never the old single answer, and never a dead end.
    await expect(page.getByText("Session Not Found", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Back to Sessions/i })).toBeVisible();
  });
});
