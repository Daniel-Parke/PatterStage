import { test, expect, type Page } from "@playwright/test";

// B2 (T-0096), the read contract, end to end: when a page's list read fails,
// the page says so with a Retry and does NOT show its empty state. Nine pages
// rendered "no X yet" over a 500 (the review's false-empty list); the Story
// Weaver hub rendered both. Each row: the page, the request to break, and the
// empty-state text that must not appear.

const READY = { timeout: 30_000 } as const;

const PAGES: Array<{ path: string; api: string; empty: RegExp | null }> = [
  { path: "/work/composer", api: "**/api/composer/runs*", empty: /No workflow runs yet/ },
  { path: "/work/missions", api: "**/api/missions*", empty: /No missions yet/ },
  { path: "/agent/profiles", api: "**/api/agent/profiles", empty: null },
  { path: "/recroom/story-weaver", api: "**/api/stories", empty: /Your story awaits/ },
  { path: "/recroom/story-weaver/library", api: "**/api/stories", empty: /bookshelf is empty/ },
  { path: "/recroom/story-weaver/characters", api: "**/api/stories", empty: /No characters yet/ },
  { path: "/recroom/story-weaver/themes", api: "**/api/stories", empty: /No saved themes yet/ },
  { path: "/work/research", api: "**/api/laboratory/research", empty: /No research runs yet/ },
  { path: "/results/artifacts", api: "**/api/artifacts*", empty: /No artifacts yet/ },
  { path: "/work/chat", api: "**/api/chat", empty: /No conversations yet/ },
];

async function breakRead(page: Page, api: string) {
  await page.route(api, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "the database is locked" }),
    }),
  );
}

test.describe("a failed read is an error with Retry, never an empty state", () => {
  for (const row of PAGES) {
    test(`${row.path}`, async ({ page }) => {
      await breakRead(page, row.api);
      await page.goto(row.path);
      // The banner, not a toast: the one alert that carries a Retry.
      const banner = page.getByRole("alert").filter({ has: page.getByRole("button", { name: /retry/i }) });
      await expect(banner.first()).toBeVisible(READY);
      if (row.empty) {
        await expect(page.getByText(row.empty)).toHaveCount(0);
      }
    });
  }
});
