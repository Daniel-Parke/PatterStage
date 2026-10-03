/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// Regression: Config PUT must reject non-object `values`
// Bug: passing values as string/array caused deepMerge to crash with Object.keys()

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRequireAuth = jest.fn();
// The route writes config.yaml through `writeHermesConfigFile`, which stages to
// a tmpfile and renames. A mock without these two is a route that throws 500 on
// the success path, so they belong to the write, not to any one assertion.
const mockRenameSync = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  renameSync: mockRenameSync,
  unlinkSync: mockUnlinkSync,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => require("../helpers/mocks").agentRuntimeMock());

jest.mock("@/lib/host/paths", () => require("../helpers/mocks").pathsMock());

jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api/api-auth", () => ({
}));

jest.mock("@/lib/api/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

import { NextRequest } from "next/server";

describe("PUT /api/config values validation regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue("agent:\n  personality: technical\n");
    mockExistsSync.mockReturnValue(true);
    mockRequireAuth.mockReturnValue(null);
    mockRequireAuth.mockReturnValue(null);
  });

  // PUT body is now zod-validated (session 121 migration to
  // parseAndValidateJsonBody). Bad `values` shape → 400 "Invalid
  // request body" with the per-field zod issue list. We assert on the
  // status code + that the zod details point at the `values` field.
  it("rejects when values is a string", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: "invalid" }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid request body/i);
    expect(JSON.stringify(body.details)).toMatch(/values/);
  });

  it("rejects when values is an array", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: ["a", "b"] }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid request body/i);
    expect(JSON.stringify(body.details)).toMatch(/values/);
  });

  it("rejects when values is null", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: null }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid request body/i);
    expect(JSON.stringify(body.details)).toMatch(/values/);
  });

  it("accepts when values is a valid object", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: { personality: "creative" } }),
    });
    const res = await PUT(req);

    // Should not return 400
    expect(res.status).not.toBe(400);
  });

  // Regression for: PUT used to call request.json() inside the main
  // try/catch, so malformed JSON returned 500 (caught by the catch-all).
  // After adopting parseJsonBody (hoisted out of the main try/catch),
  // malformed JSON now correctly returns 400 with a parse error message.
  it("returns 400 (not 500) when request body is malformed JSON", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      // Intentionally truncated JSON that will fail to parse
      body: "{this is not valid json",
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid json/i);
  });
});
