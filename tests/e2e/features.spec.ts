import { test, expect } from "@playwright/test";

test.describe("Missions page", () => {
  test("loads missions list", async ({ page }) => {
    await page.goto("/work/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true })
    ).toBeVisible();
  });

  test("shows quick deploy template region", async ({ page }) => {
    await page.goto("/work/missions");
    await expect(
      page.getByRole("heading", { name: "Missions", exact: true })
    ).toBeVisible();
    const region = page.getByTestId("missions-quick-templates");
    await expect(region).toBeVisible({ timeout: 30_000 });
    await expect(region.getByText(/Quick load template/i)).toBeVisible();
  });

  test("can open create mission form", async ({ page }) => {
    await page.goto("/work/missions");

    // EXACT name, not /Create|New Mission|Draft/i. That pattern also matched the
    // "draft" status-filter chip, so once both had rendered the locator resolved
    // to two elements and `isVisible()` threw a strict-mode violation. Under
    // fullyParallel the chips sometimes rendered after the check and sometimes
    // before, which is why it passed alone and failed in the full run. Retries
    // are zero here by policy (WG-DEL-004, determinism first), so the fix is to
    // remove the ambiguity rather than to paper over the race.
    const createBtn = page.getByRole("button", { name: "New Mission", exact: true });

    // Unconditional. This was `if (await createBtn.isVisible()) { ... }`, which
    // meant that whenever the button had not rendered yet the test passed having
    // asserted NOTHING — the same shape of hole T-0044 closed elsewhere. An
    // auto-retrying expect waits for the button instead of sampling for it.
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page.getByText(/Mission Name|Name/i).first()).toBeVisible();
  });
});

test.describe("Sessions page", () => {
  test("loads sessions list", async ({ page }) => {
    await page.goto("/results/sessions");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sessions", exact: true })
    ).toBeVisible();
  });

  test("optional session detail from list link", async ({ page, request }) => {
    const res = await request.get("/api/sessions?limit=5");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const sessions: { id: string }[] = body.data?.sessions ?? body.sessions ?? [];
    if (sessions.length === 0) {
      test.skip(true, "No sessions available for detail view");
      return;
    }
    const id = sessions[0].id;
    await page.goto(`/results/sessions/${encodeURIComponent(id)}`);
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Chat page", () => {
  test("loads chat shell", async ({ page }) => {
    await page.goto("/work/chat");
    await expect(
      page.getByRole("heading", { name: "Chat", exact: true })
    ).toBeVisible();
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  });
});

test.describe("Config page", () => {
  test("loads config sections", async ({ page }) => {
    await page.goto("/agent/settings");
    await expect(
      page.getByRole("heading", { name: /Config|Settings/i }).first()
    ).toBeVisible();
  });

  test("shows config section cards", async ({ page }) => {
    await page.goto("/agent/settings");
    // Should show at least Agent and Model sections
    await expect(page.getByText("Agent").first()).toBeVisible();
  });
});

test.describe("Skills page", () => {
  test("loads skills browser", async ({ page }) => {
    await page.goto("/agent/skills");
    await expect(
      page.getByRole("heading", { level: 1, name: "Skills", exact: true })
    ).toBeVisible();
  });

  test("optional skill detail from API path", async ({ page, request }) => {
    const res = await request.get("/api/skills?profile=default");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const skills: { name: string; category: string }[] =
      body.data?.skills ?? body.skills ?? [];
    if (skills.length === 0) {
      test.skip(true, "No skills on disk for detail view");
      return;
    }
    const skill = skills[0];
    // `name` is the catalog key and already carries its category ("engineering/
    // code-review"); `category` is derived from it (deriveCategory splits on the
    // first "/"). Prefixing the category again built
    // /operations/skills/engineering/engineering%2Fcode-review, and that encoded
    // slash is precisely what the route's path guard refuses: the page rendered
    // "Skill Not Found · Invalid skill path" from
    // resolveSkillDirUnderRoot in src/lib/fs/path-security.ts. The guard is
    // right; the URL the test built was wrong. One key segment, one path
    // segment.
    const segments = skill.name.split("/").filter(Boolean);
    const path = segments.map((s) => encodeURIComponent(s)).join("/");
    const detailRes = await page.goto(`/agent/skills/${path}`, {
      waitUntil: "domcontentloaded",
    });
    expect(detailRes?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Memory page", () => {
  test("loads memory page", async ({ page }) => {
    await page.goto("/agent/memory");
    // The page title, not any heading containing "Memory": the memory-provider
    // tile added a second one ("Memory provider", an h2), so the unqualified
    // regex became a strict-mode violation. Level 1 names the page heading the
    // test was always about.
    await expect(
      page.getByRole("heading", { level: 1, name: /Memory/i })
    ).toBeVisible();
  });
});

test.describe("Logs page", () => {
  test("loads logs viewer", async ({ page }) => {
    await page.goto("/results/logs");
    await expect(
      page.getByRole("heading", { name: /Logs/i })
    ).toBeVisible();
  });
});
