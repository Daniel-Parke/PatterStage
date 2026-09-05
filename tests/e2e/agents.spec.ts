import { test, expect, type Page } from "@playwright/test";

// Every test here waits out the same thing first: /operations/agents renders a
// "Loading profiles..." spinner and nothing else until its post-hydration fetch
// of /api/agent/profiles resolves. Against a warm server each of these runs in
// about 1.2s and Playwright's 5s default is ample; from a cold server under a
// full-suite worker pool they all fail on the spinner instead. The endpoint is
// not the problem (it answers in ~0.4s when timed directly), so this is
// first-paint contention, and the fix is the 30s ceiling the rest of this suite
// already uses (config-sections, navigation-matrix, story-weaver) rather than a
// looser assertion. Nothing checked here changed; only the patience.
const READY = { timeout: 30_000 } as const;

async function openAgentsPage(page: Page) {
  await page.goto("/agent/profiles");
  await expect(page.getByRole("heading", { name: "Agent Profiles" })).toBeVisible(READY);
}

test.describe("Agents page", () => {
  test("loads agent profiles list", async ({ page }) => {
    await openAgentsPage(page);
  });

  test("profile sync controls are visible", async ({ page }) => {
    await openAgentsPage(page);
    // Exact names, because /Push all/i is ambiguous: ProfileSyncBar renders
    // "Push all" always, and ProfilesDriftBanner renders "Push all to Hermes"
    // whenever the database and the Hermes disk disagree. The loose regex made
    // this test pass or fail on whether the run's data happened to have drifted
    // (a strict-mode violation on a drifted DB, green on a clean one). The two
    // sync-bar controls are what the test is about, so it names them.
    await expect(page.getByRole("button", { name: "Push all", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pull all", exact: true })).toBeVisible();
  });

  test("New Profile button is visible", async ({ page }) => {
    await openAgentsPage(page);
    await expect(
      page.getByRole("button", { name: /New Profile/i })
    ).toBeVisible();
  });

  test("opens create modal on New Profile click", async ({ page }) => {
    await openAgentsPage(page);
    await page.getByRole("button", { name: /New Profile/i }).click();
    await expect(page.getByText("New Agent Profile")).toBeVisible();
    await expect(page.getByPlaceholder(/e\.g\. Research Assistant/i)).toBeVisible();
  });

  test("closes create modal on Cancel", async ({ page }) => {
    await openAgentsPage(page);
    await page.getByRole("button", { name: /New Profile/i }).click();
    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByText("New Agent Profile")).not.toBeVisible();
  });
});
