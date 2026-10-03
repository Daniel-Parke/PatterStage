/** @jest-environment node */
import { openBaselineDb, dbSingletonMock } from "../helpers/baseline-db";
import type { Database } from "better-sqlite3";

let mockDb: Database | null = null;
jest.mock("@/lib/db", () => dbSingletonMock(() => mockDb));
jest.mock("@/lib/models/llm", () => ({ callLLM: jest.fn(() => { throw new Error("No provider calls permitted"); }) }));

import { handleList } from "@/modules/rec-room/handlers/crud";
import { apiFetch } from "@/lib/api/api-fetch";

const originalFetch = global.fetch;
beforeEach(() => { mockDb = openBaselineDb(); });
afterEach(() => { mockDb?.close(); mockDb = null; global.fetch = originalFetch; });

function seed(config = '{"premise":"An owned synthetic story"}', chapters = "[]") {
  mockDb!.prepare(`INSERT INTO stories (id,title,config,chapters,chapter_contents,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run("owned-story", "Owned story", config, chapters, "{}", "active", "2026-01-01", "2026-01-01");
}

describe("T-0192 Story list read contract", () => {
  it("returns a healthy story from real in-memory SQLite", async () => {
    seed();
    const response = await handleList();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { stories: [{ id: "owned-story", title: "Owned story", premise: "An owned synthetic story" }] } });
  });

  it("returns successful empty data only for a healthy empty library", async () => {
    const response = await handleList();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { stories: [] } });
  });

  it("keeps a damaged JSON row visible through the real parser", async () => {
    seed("{damaged", "null");
    const response = await handleList();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { stories: [{ id: "owned-story", config: {}, chapters: [] }] } });
    expect(mockDb!.prepare("SELECT config FROM stories WHERE id = ?").get("owned-story")).toEqual({ config: "{damaged" });
  });

  it("reports a genuine SQL read failure instead of a successful empty library", async () => {
    mockDb!.exec("ALTER TABLE stories RENAME TO owned_unavailable_stories");
    const response = await handleList();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: expect.any(String) });
    expect(body.error.trim()).not.toBe("");
  });

  it("lets the API consumer distinguish SQL failure and then recover the original story", async () => {
    seed();
    mockDb!.exec("ALTER TABLE stories RENAME TO owned_unavailable_stories");
    // Handler-to-client contract, not a running HTTP server or React view proof.
    global.fetch = jest.fn(async () => handleList());
    const failed = await apiFetch("/api/stories", { method: "POST", body: JSON.stringify({ action: "list" }) })
      .then(value => ({ value, error: null }), error => ({ value: null, error }));
    mockDb!.exec("ALTER TABLE owned_unavailable_stories RENAME TO stories");
    const recovered = await apiFetch("/api/stories", { method: "POST", body: JSON.stringify({ action: "list" }) });
    expect(recovered).toMatchObject({ data: { stories: [{ id: "owned-story" }] } });
    expect(failed.error).not.toBeNull();
    expect(failed.error).toMatchObject({ status: 500, message: expect.any(String) });
    expect(failed.value).toBeNull();
  });
});
