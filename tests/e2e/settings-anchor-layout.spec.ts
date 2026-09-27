import { expect, test } from "@playwright/test";

test("a bookmarked Settings heading stays in view after an earlier file read expands", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  let releaseHermes!: () => void;
  const heldHermes = new Promise<void>((resolve) => { releaseHermes = resolve; });
  let hermesRequested = false;
  await page.route("**/api/agent/files/hermes", async (route) => {
    const response = await route.fetch();
    hermesRequested = true;
    await heldHermes;
    await route.fulfill({ response });
  });

  try {
    await page.goto("/agent/settings#env", { waitUntil: "domcontentloaded" });
    const heading = page.locator("section#env").getByRole("heading", { level: 3, name: "Environment Variables" });
    await expect.poll(() => hermesRequested).toBe(true);
    await expect(heading).toBeInViewport();

    releaseHermes();
    await expect(page.getByRole("textbox", { name: "HERMES.md content" })).toBeVisible();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(page).toHaveURL(/\/agent\/settings#env$/);
    await expect(heading).toBeInViewport();
    const top = await heading.evaluate((element) => element.getBoundingClientRect().top);
    expect(top, "the bookmarked heading should land near the sticky header, not the viewport bottom").toBeGreaterThan(40);
    expect(top, "the bookmarked heading should land near the sticky header, not the viewport bottom").toBeLessThan(240);
  } finally {
    releaseHermes();
  }
});
