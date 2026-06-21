/**
 * @jest-environment node
 */

/** Verify that the templates POST endpoint requires authentication. */

const mockRequireAuth = jest.fn();

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: { templates: "/tmp/ch-data/templates" },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  unlinkSync: jest.fn(),
}));

jest.mock("@/lib/schema", () => ({
  parseTemplatePackManifestV1: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";

describe("POST /api/templates auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no auth required (returns null = allowed)
    mockRequireAuth.mockReturnValue(null);
  });

  it("rejects read-only mode", async () => {
    const readOnlyResponse = NextResponse.json(
      { error: "Read-only mode" },
      { status: 403 }
    );
    mockRequireAuth.mockReturnValue(readOnlyResponse);

    const { POST } = await import("@/app/api/templates/route");
    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify({ action: "create", name: "test" }),
    });
    const res = await POST(request);

    expect(res.status).toBe(403);
    expect(mockRequireAuth).toHaveBeenCalled();
  });

  it("rejects requests without valid API key", async () => {
    const authResponse = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    mockRequireAuth.mockReturnValue(authResponse);

    const { POST } = await import("@/app/api/templates/route");
    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify({ action: "create", name: "test" }),
    });
    const res = await POST(request);

    expect(res.status).toBe(401);
    expect(mockRequireAuth).toHaveBeenCalled();
  });

  it("allows requests with valid auth", async () => {
    // Both checks pass (return null)
    mockRequireAuth.mockReturnValue(null);
    mockRequireAuth.mockReturnValue(null);

    const { POST } = await import("@/app/api/templates/route");
    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify({ action: "create", name: "Test Template" }),
    });
    const res = await POST(request);

    // Should proceed to create (not blocked by auth)
    expect(mockRequireAuth).toHaveBeenCalled();
    expect(mockRequireAuth).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
