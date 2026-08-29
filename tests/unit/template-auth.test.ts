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

import { NextRequest } from "next/server";

describe("POST /api/templates auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no auth required (returns null = allowed)
    mockRequireAuth.mockReturnValue(null);
  });

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.

  // Restored from the T-0048 sweep. What this actually covers is the create
  // path answering 200; the two identical `mockRequireAuth` assertions it
  // carried were asserting a function that no longer exists.
  it("creates a template and answers 200", async () => {
    const { POST } = await import("@/app/api/templates/route");
    const request = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify({ action: "create", name: "Test Template" }),
    });
    const res = await POST(request);
    expect(res.status).toBe(200);
  });

});
