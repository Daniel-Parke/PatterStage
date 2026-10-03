import { test, expect, type Page, type Route } from "@playwright/test";
import { createStoryWeaverSaveFixture } from "../helpers/story-weaver-save-fixture";

type Answer = (route: Route, url: URL, body: Record<string, unknown>) => Promise<boolean>;
async function controlledApi(page: Page, answer: Answer) {
  const unexpectedWrites: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : {};
    if (await answer(route, url, body)) return;
    if (request.method() !== "GET") {
      unexpectedWrites.push(`${request.method()} ${url.pathname}`);
      await route.fulfill({ status: 500, json: { error: "Unclaimed oracle request" } }); return;
    }
    const payload: Record<string, unknown> = {
      "/api/gateway/health": { online: true, authConfigured: true, baseUrl: "http://fixture.invalid" },
      "/api/models": { models: [] }, "/api/gateway/models": { models: [] },
      "/api/models/defaults": { defaults: {}, modelReadiness: { ready: true, detail: "Controlled fixture" } },
      "/api/templates": { templates: [] }, "/api/mission-categories": { categories: [] },
      "/api/stats": { stats: { achievements: [], quests: { quests: [], seeding: false } } },
    };
    if (payload[url.pathname]) await route.fulfill({ json: { data: payload[url.pathname] } });
    else await route.fallback();
  });
  return { errors, unexpectedWrites };
}
const conversation = (id: string, title = `Owned conversation ${id}`) => ({ id, title, model: null, sessionId: null, profileName: null, previousResponseId: null, createdAt: "2026-10-02", updatedAt: "2026-10-02" });

for (const width of [1440, 390]) {
  test.describe(`T-0190 client ownership at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    for (const switchConversation of [false, true]) {
      test(`New Chat preserves a newer selection and typed draft [${switchConversation ? "select B" : "same selection"}]`, async ({ page }, info) => {
        let held: Route | undefined;
        const boundary = await controlledApi(page, async (route, url) => {
          if (url.pathname === "/api/chat") {
            if (route.request().method() === "POST") { held = route; return true; }
            await route.fulfill({ json: { data: { conversations: [conversation("A"), conversation("B")] } } }); return true;
          }
          if (/^\/api\/chat\/[AB]$/.test(url.pathname)) { const id = url.pathname.slice(-1); await route.fulfill({ json: { data: { conversation: conversation(id), messages: [] } } }); return true; }
          return false;
        });
        await page.goto("/work/chat"); await expect(page.locator("main")).toContainText("Owned conversation A");
        await page.getByRole("button", { name: "New Chat", exact: true }).click(); await expect.poll(() => Boolean(held)).toBe(true);
        if (switchConversation) {
          if (width === 390) await page.getByRole("button", { name: /Conversations \(/ }).click();
          await page.getByRole("button").filter({ hasText: "Owned conversation B" }).click();
          await expect(page.locator("main h2")).toContainText("Owned conversation B");
        }
        const draft = `Fresh draft at ${width}`; await page.getByRole("textbox", { name: "Message", exact: true }).fill(draft);
        await info.attach("pending-draft", { body: await page.screenshot(), contentType: "image/png" });
        await held!.fulfill({ status: 201, json: { data: { conversation: conversation("N", "New Chat") } } });
        // A browser task after delivery, followed by auto-retrying assertions.
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(draft);
        if (switchConversation) await expect(page.locator("main h2")).toContainText("Owned conversation B");
        expect(boundary.errors).toEqual([]); expect(boundary.unexpectedWrites).toEqual([]);
      });
    }

    test("mission polling failures remain visible and recover in place", async ({ page }) => {
      let failed = true, reads = 0;
      const boundary = await controlledApi(page, async (route, url) => {
        if (url.pathname !== "/api/missions") return false;
        reads++; await route.fulfill({ status: failed ? 503 : 200, json: failed ? { error: "Owned mission read failure" } : { data: { missions: [{ id: "owned", name: "Recovered mission", status: "queued", queuedForRun: false }] } } }); return true;
      });
      await page.clock.install(); await page.goto("/work/missions");
      await expect(page.getByRole("alert").filter({ hasText: "Owned mission read failure" })).toBeVisible();
      const first = reads; await page.clock.runFor(15001); await expect.poll(() => reads).toBeGreaterThan(first);
      await expect(page.getByTestId("toast")).toHaveCount(0);
      await expect(page.getByText("Owned mission read failure", { exact: true })).toHaveCount(1);
      failed = false; await page.getByRole("button", { name: /retry/i }).click();
      await expect(page.getByText("Recovered mission", { exact: true })).toBeVisible();
      await expect(page.getByText("Owned mission read failure", { exact: true })).toHaveCount(0);
      expect(boundary.errors).toEqual([]); expect(boundary.unexpectedWrites).toEqual([]);
    });

    test("Hindsight distinguishes failed reads from an empty bank", async ({ page }) => {
      let failed = true;
      const boundary = await controlledApi(page, async (route, url) => {
        if (url.pathname !== "/api/memory/hindsight") return false;
        const action = url.searchParams.get("action");
        await route.fulfill({ status: action === "directives" && failed ? 503 : 200, json: action === "directives" && failed ? { error: "Owned directives failure" } : { data: action === "health" ? { available: true, mode: "ok" } : { memories: [], directives: [], models: [], total: 0, mode: "ok" } } }); return true;
      });
      await page.goto("/agent/memory"); await page.getByRole("button", { name: /^Directives/ }).click();
      await expect(page.getByRole("alert").filter({ hasText: /failure|failed|unavailable/i })).toBeVisible();
      await expect(page.getByText("Hindsight returned no directives for this bank.")).toHaveCount(0);
      failed = false; await page.getByRole("button", { name: /retry/i }).click();
      await expect(page.getByText("Hindsight returned no directives for this bank.")).toBeVisible();
      expect(boundary.errors).toEqual([]); expect(boundary.unexpectedWrites).toEqual([]);
    });

    test("Story controls preserve page-owned writes and successful creation when storage is denied", async ({ page }) => {
      const writes: Record<string, unknown>[] = [], story = createStoryWeaverSaveFixture("owned-created-story");
      const boundary = await controlledApi(page, async (route, url, body) => {
        if (url.pathname !== "/api/stories") return false;
        if (body.action === "themes" || body.action === "characters") { await route.fulfill({ json: { data: { themes: [], characters: [] } } }); return true; }
        if (body.action === "load") { await route.fulfill({ json: { data: story } }); return true; }
        if (body.action === "spend") { await route.fulfill({ json: { data: { spend: null } } }); return true; }
        writes.push(body);
        if (body.action === "create") await route.fulfill({ status: 201, json: { data: { id: story.id } } });
        else if (body.action === "update") await route.fulfill({ json: { data: { ...story, chapters: story.chapters.map(c => ({ ...c, readStatus: c.number === 2 ? "read" : c.readStatus })) } } });
        else await route.fulfill({ status: 500, json: { error: "Unexpected Story write" } });
        return true;
      });
      await page.addInitScript(() => { const original = Storage.prototype.removeItem; Storage.prototype.removeItem = function (key) { if (key === "story-weaver-draft") throw new DOMException("Owned cleanup refusal", "SecurityError"); original.call(this, key); }; });
      await page.goto("/recroom/story-weaver/create");
      await page.getByLabel("Story title", { exact: true }).fill("Owned story"); await page.getByLabel("Premise", { exact: true }).fill("A controlled premise");
      expect(writes).toEqual([]); await page.getByRole("button", { name: "Begin Writing", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/recroom/story-weaver/${story.id}$`));
      expect(writes.filter(b => b.action === "create")).toHaveLength(1);
      await page.getByRole("group", { name: "Chapters" }).first().getByRole("button", { name: "Chapter 2: Second (complete)" }).click();
      await expect.poll(() => writes.filter(b => b.action === "update").length).toBe(1);
      expect(writes.map(b => b.action)).toEqual(["create", "update"]);
      expect(boundary.errors).toEqual([]); expect(boundary.unexpectedWrites).toEqual([]);
    });
  });
}
