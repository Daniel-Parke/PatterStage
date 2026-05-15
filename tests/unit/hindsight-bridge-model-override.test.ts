/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * PR 7 — Hindsight bridge model override
 *
 * Now uses direct HTTP calls instead of subprocess. These tests verify
 * that the route makes correct HTTP requests to the Hindsight server.
 */

const fetchCalls: Array<{ url: string; method: string; body?: string }> = [];

const mockFetch = jest.fn(
  (url: string, opts?: RequestInit): Promise<Response> => {
    fetchCalls.push({ url, method: opts?.method || "GET", body: opts?.body as string | undefined });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ memories: [], items: [], total: 0 }),
    } as Response);
  }
);

global.fetch = mockFetch;

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    nextUrl: URL;
    headers: Headers;
    constructor(url: string) {
      this.url = url;
      this.nextUrl = new URL(url);
      this.headers = new Headers();
    }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
      };
    },
  },
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

beforeEach(() => {
  fetchCalls.length = 0;
  mockFetch.mockClear();
});

describe("Hindsight memory direct HTTP", () => {
  it("calls Hindsight server for recall action", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const url = "http://localhost/api/memory/hindsight?action=recall&query=foo";
    const req = new NextRequest(url);
    await GET(req);

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const call = fetchCalls[0];
    expect(call.url).toContain("9177");
    expect(call.url).toContain("memories/list");
    expect(call.url).toContain("search=foo");
    expect(call.method).toBe("GET");
  });

  it("calls Hindsight server for list action with limit", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const url = "http://localhost/api/memory/hindsight?action=list&limit=10";
    const req = new NextRequest(url);
    await GET(req);

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const call = fetchCalls[0];
    expect(call.url).toContain("9177");
    expect(call.url).toContain("limit=10");
    expect(call.method).toBe("GET");
  });

  it("calls Hindsight server for health action", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const url = "http://localhost/api/memory/hindsight?action=health";
    const req = new NextRequest(url);
    await GET(req);

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("calls Hindsight server for retain action via POST", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const mockReq = {
      json: () => Promise.resolve({ action: "retain", content: "Test memory", tags: ["test"] }),
    } as unknown as Request;
    await POST(mockReq);

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const call = fetchCalls[0];
    expect(call.method).toBe("POST");
    expect(call.url).toContain("memories");
  });

  it("handles missing query for recall with 400 error", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const url = "http://localhost/api/memory/hindsight?action=recall";
    const req = new NextRequest(url);
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("query is required");
  });

  it("handles unknown action with 400 error", async () => {
    const { GET } = await import("@/app/api/memory/hindsight/route");
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const url = "http://localhost/api/memory/hindsight?action=invalid";
    const req = new NextRequest(url);
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("Unknown action");
  });
});
