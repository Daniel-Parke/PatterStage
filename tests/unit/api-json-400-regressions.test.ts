/** @jest-environment node */

// Regression tests for the request.json() 500-instead-of-400 bug class.
// These three routes were fixed in session 37 (2026-06-02) to hoist
// `parseJsonBody` out of the main try/catch. The bug: invalid JSON
// was being caught by the route's catch block and returned as
// "Failed to <verb>" with status 500. REST semantics require 400.

import { NextRequest } from "next/server";

// Mock everything the touched routes import so we can isolate the
// parseJsonBody behaviour without standing up a full DB.
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

jest.mock("@/lib/sessions/session-repository", () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(() => ({ sessions: [], total: 0 })),
}));

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({ logs: "/tmp/non-existent" })),
}));

function makeInvalidJsonRequest(url: string, method: "POST" | "PUT" | "DELETE") {
  return new NextRequest(url, {
    method,
    body: "{not valid json",
    headers: { "content-type": "application/json" },
  });
}

describe("invalid-JSON 400 regressions (session 37, 2026-06-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/sessions returns 400 (not 500) on malformed JSON", async () => {
    const { POST } = await import("@/app/api/sessions/route");
    const req = makeInvalidJsonRequest(
      "http://localhost/api/sessions",
      "POST",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("POST /api/memory/hindsight returns 400 (not 500) on malformed JSON", async () => {
    const { POST } = await import("@/app/api/memory/hindsight/route");
    const req = makeInvalidJsonRequest(
      "http://localhost/api/memory/hindsight",
      "POST",
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("DELETE /api/memory/hindsight returns 400 (not 500) on malformed JSON", async () => {
    const { DELETE } = await import("@/app/api/memory/hindsight/route");
    const req = makeInvalidJsonRequest(
      "http://localhost/api/memory/hindsight",
      "DELETE",
    );
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });
});
