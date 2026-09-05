/**
 * @jest-environment node
 *
 * Integration coverage for /api/memory/hindsight — the route's HTTP transport
 * + response mapping against a faked Hindsight server (globalThis.fetch).
 * Fills the gap the pure-mapper unit tests left: the GET/POST/DELETE handlers,
 * URL shaping, the `ok()` envelope, validation, and the 503 connection-error
 * downgrade. The canned responses mirror what mock-hindsight/server.mjs serves.
 */

import { NextRequest } from "next/server";

import { GET, POST, DELETE } from "@/app/api/memory/hindsight/route";

const BASE = "http://localhost/api/memory/hindsight";
// Endpoint is the DB-owned default (host 127.0.0.1, port 9177, bank hermes).
const HS = "http://127.0.0.1:9177/v1/default/banks/hermes";

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const ORIGINAL_ENV = process.env;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PS_READ_ONLY;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = ORIGINAL_ENV;
});

async function dataOf(res: { json: () => Promise<unknown> }) {
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

describe("GET /api/memory/hindsight", () => {
  it("action=list maps raw Hindsight memory fields to the UI shape", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: "m1", text: "hello world", fact_type: "preference", date: "2026-01-01", tags: ["a"], proof_count: 2 },
        ],
        total: 1,
      }),
    );
    const data = await dataOf(await GET(new NextRequest(`${BASE}?action=list`)));
    expect(mockFetch.mock.calls[0][0]).toBe(`${HS}/memories/list?limit=100`);
    expect(data).toEqual({
      memories: [
        { id: "m1", content: "hello world", type: "preference", created_at: "2026-01-01", tags: ["a"], entities: "", proofCount: 2 },
      ],
      count: 1,
      total: 1,
    });
  });

  it("action=health reports availability + status", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, status: "healthy" }));
    const data = await dataOf(await GET(new NextRequest(`${BASE}?action=health`)));
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:9177/health");
    expect(data).toEqual({ available: true, mode: "external", status: "healthy" });
  });

  it("action=count reads the list total", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [], total: 7 }));
    const data = await dataOf(await GET(new NextRequest(`${BASE}?action=count`)));
    expect(mockFetch.mock.calls[0][0]).toBe(`${HS}/memories/list?limit=1`);
    expect(data).toEqual({ count: 7, bank: "hermes" });
  });

  it("rejects an unknown action with 400", async () => {
    const res = await GET(new NextRequest(`${BASE}?action=bogus`));
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("downgrades a connection failure to 503", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed: ECONNREFUSED 127.0.0.1:9177"));
    const res = await GET(new NextRequest(`${BASE}?action=list`));
    expect(res.status).toBe(503);
    expect((await dataOf(res)).available).toBe(false);
  });
});

describe("POST /api/memory/hindsight", () => {
  it("retain posts the content + returns success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, operation_id: "op1" }));
    const res = await POST(
      new NextRequest(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retain", content: "remember this", tags: ["x"] }),
      }),
    );
    const data = await dataOf(res);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${HS}/memories`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      items: [{ content: "remember this", tags: ["x"] }],
    });
    expect(data).toEqual({ success: true, operation_id: "op1" });
  });

  it("retain with empty content is a 400 (no upstream call)", async () => {
    const res = await POST(
      new NextRequest(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retain", content: "   " }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("create-model posts source_query", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ mental_model_id: "mm1", operation_id: "op2" }));
    const res = await POST(
      new NextRequest(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create-model", name: "Model", query: "how?" }),
      }),
    );
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${HS}/mental-models`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Model", source_query: "how?" });
    expect(await dataOf(res)).toEqual({ success: true, mental_model_id: "mm1", operation_id: "op2" });
  });
});

describe("DELETE /api/memory/hindsight", () => {
  it("deletes a directive by id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    const res = await DELETE(
      new NextRequest(BASE, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "directive", id: "d1" }),
      }),
    );
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${HS}/directives/d1`);
    expect((init as RequestInit).method).toBe("DELETE");
    expect(await dataOf(res)).toEqual({ success: true, id: "d1" });
  });

  it("requires type and id", async () => {
    const res = await DELETE(
      new NextRequest(BASE, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "d1" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
