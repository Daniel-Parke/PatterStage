import { test, expect } from "@playwright/test";

// B12 (T-0106). The Composer's two tabs, walked: the starters are there, the
// Build tab keeps its board across a look at Run, and a description typed in
// survives a save. The unit oracles hold the shapes; this holds that they are
// wired to a real server.

test.describe("Composer", () => {
  test("the two starter workflows are seeded and offered", async ({ page }) => {
    const res = await page.request.get("/api/composer/workflows");
    if (!res.ok()) {
      test.skip(true, "the composer flag is off on this instance");
      return;
    }
    // The starters are written by the background scheduler's boot seed, which
    // races a request made the instant the server answers.
    await expect
      .poll(
        async () => {
          const r = await page.request.get("/api/composer/workflows");
          const b = (await r.json()) as { data?: { workflows?: { name: string }[] } };
          return (b.data?.workflows ?? []).map((w) => w.name);
        },
        { timeout: 30_000 },
      )
      .toEqual(expect.arrayContaining(["Research then summarise", "Draft and review"]));
  });

  test("the Build tab keeps its board across a look at the Run tab", async ({ page }) => {
    await page.goto("/work/composer");
    const build = page.getByRole("button", { name: "Build", exact: true });
    if ((await build.count()) === 0) {
      test.skip(true, "the composer flag is off on this instance");
      return;
    }

    await build.click();
    const nameField = page.getByLabel("Name", { exact: true });
    await expect(nameField).toBeVisible({ timeout: 15_000 });
    await nameField.fill("A board that must survive");
    await expect(nameField).toHaveValue("A board that must survive");

    await page.getByRole("button", { name: "Run", exact: true }).click();
    await page.getByRole("button", { name: "Build", exact: true }).click();

    // The editor is mounted once: the value is still there because the
    // component was never unmounted (T-0106, D7).
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("A board that must survive");
  });

  test("a description typed on the Build tab is what comes back", async ({ page }) => {
    await page.goto("/work/composer");
    const build = page.getByRole("button", { name: "Build", exact: true });
    if ((await build.count()) === 0) {
      test.skip(true, "the composer flag is off on this instance");
      return;
    }
    await build.click();

    const unique = `walk ${Date.now()}`;
    await page.getByLabel("Name", { exact: true }).fill(unique);
    await page.getByLabel("Description", { exact: true }).fill("What this one is for");
    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 20_000 });

    const res = await page.request.get("/api/composer/workflows");
    const body = (await res.json()) as { data?: { workflows?: { name: string; description: string }[] } };
    const saved = (body.data?.workflows ?? []).find((w) => w.name === unique);
    expect(saved?.description).toBe("What this one is for");
  });
});
