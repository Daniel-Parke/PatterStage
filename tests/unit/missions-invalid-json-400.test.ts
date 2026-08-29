/** @jest-environment node */

// Regression tests for the request.json() 500-instead-of-400 bug class.
// /api/missions was fixed in session 41 (2026-06-02) to hoist
// `parseJsonBody` out of the main try/catch. The bug: invalid JSON
// was being caught by the route's catch block and returned as
// "Internal server error" with status 500. REST semantics require 400.

import { NextRequest } from "next/server";

// Mock everything the touched routes import so we can isolate the
// parseJsonBody behaviour without standing up a full DB / sync layer.
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  // requireNotReadOnly is the honest name of what these routes call now;
  // requireAuth stays mocked for the modules that have not been renamed yet.
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
}));

jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: jest.fn(() => []),
  getMission: jest.fn(),
}));

function makeInvalidJsonRequest(url: string) {
  return new NextRequest(url, {
    method: "POST",
    body: "{not valid json",
    headers: { "content-type": "application/json" },
  });
}

describe("invalid-JSON 400 regressions (session 41, 2026-06-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/missions returns 400 (not 500) on malformed JSON", async () => {
    const { POST } = await import("@/app/api/missions/route");
    const req = makeInvalidJsonRequest("http://localhost/api/missions");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });
});
