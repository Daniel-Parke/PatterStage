import { test, expect } from "@playwright/test";

test.describe("Restore page", () => {
  test("loads Settings → Restore", async ({ page }) => {
    await page.goto("/agent/settings/restore");
    // Every screen in this app is a client component, so its own heading does
    // not exist until hydration; the shell is server-rendered and arrives
    // first. The default five seconds is therefore a race rather than a limit,
    // and when it loses, the failure reads as "the heading is wrong" when what
    // happened is "the page had not rendered yet". Waiting longer costs nothing
    // on a healthy run and removes a whole class of false red.
    await expect(page.getByRole("heading", { name: /Restore everything/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
