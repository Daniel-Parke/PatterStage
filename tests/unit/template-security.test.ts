/** @jest-environment node */

import { NextRequest } from "next/server";

// ── Bug regression: path traversal in templates API ──

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
  mkdirSync: mockMkdirSync,
  unlinkSync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("@/lib/host/paths", () => require("../helpers/mocks").pathsMock({ PATHS: { templates: "/tmp/test-templates" } }));

jest.mock("@/lib/schema", () => ({
  parseTemplatePackManifestV1: jest.fn(),
}));

describe("POST /api/templates — path traversal regression", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects empty sanitized IDs in delete action", async () => {
    mockExistsSync.mockReturnValue(false);

    // "../" gets sanitized to empty string
    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        templateId: "../",
      }),
    });

    const { POST } = await import("@/app/api/templates/route");
    const res = await POST(request);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid template id");
  });

  it("sanitizes traversal chars in delete (checks sanitized path)", async () => {
    // After sanitization, "../valid-id" becomes "valid-id"
    // The function checks for /tmp/test-templates/valid-id.json
    mockExistsSync.mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        templateId: "../valid-id",
      }),
    });

    const { POST } = await import("@/app/api/templates/route");
    const res = await POST(request);

    // sanitized to "valid-id", file doesn't exist → 404
    expect(res.status).toBe(404);
  });

  it("sanitizes traversal chars in update action", async () => {
    mockExistsSync.mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "update",
        templateId: "../../config",
        name: "hacked",
      }),
    });

    const { POST } = await import("@/app/api/templates/route");
    const res = await POST(request);

    // sanitized to "config", file doesn't exist → 404
    expect(res.status).toBe(404);
  });

  it("allows valid alphanumeric template IDs", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      id: "my-template",
      name: "Test",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }));

    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        templateId: "my-template",
      }),
    });

    const { POST } = await import("@/app/api/templates/route");
    const res = await POST(request);

    expect(res.status).toBe(200);
  });
});
