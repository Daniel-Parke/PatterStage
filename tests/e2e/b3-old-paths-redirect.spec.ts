import { test, expect } from "@playwright/test";

// B3 (T-0097), decision 8: every old page path answers 307 to its new
// address, with the query string intact. Read without following, so a page
// that happens to render at the new address cannot hide a missing redirect.

const OLD_TO_NEW: Array<[string, string]> = [
  ["/orchestration/chat", "/work/chat"],
  ["/orchestration/missions?template=t1", "/work/missions?template=t1"],
  ["/orchestration/composer", "/work/composer"],
  ["/orchestration/scripts", "/work/scripts"],
  ["/laboratory/research", "/work/research"],
  ["/sessions", "/results/sessions"],
  ["/sessions/abc-123", "/results/sessions/abc-123"],
  ["/laboratory/artifacts", "/results/artifacts"],
  ["/laboratory/insights", "/results/insights"],
  ["/insights", "/results/insights"],
  ["/logs", "/results/logs"],
  ["/operations/agents", "/agent/profiles"],
  ["/operations/skills", "/agent/skills"],
  ["/operations/skills/foo/SKILL.md", "/agent/skills/foo/SKILL.md"],
  ["/operations/tools", "/agent/tools"],
  // Personalities folded into the Agents card (decision 11, T-0103).
  ["/operations/personalities", "/agent/profiles?tab=identity"],
  ["/agent/personalities", "/agent/profiles?tab=identity"],
  ["/memory", "/agent/memory"],
  ["/config", "/agent/settings"],
  ["/config/models", "/agent/models"],
  ["/config/seed", "/agent/settings/restore"],
  ["/config/agent", "/agent/settings/agent"],
];

test.describe("old page paths answer 307 to the new address", () => {
  for (const [from, to] of OLD_TO_NEW) {
    test(`${from} → ${to}`, async ({ request, baseURL }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"] ?? "";
      const resolved = location.startsWith("http") ? location.slice((baseURL ?? "").length) : location;
      expect(resolved).toBe(to);
    });
  }

  test("and the new address itself answers 200, not another hop", async ({ request }) => {
    const res = await request.get("/work/missions", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });
});
