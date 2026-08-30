/** @jest-environment node */

const mockExistsSync = jest.fn();
const mockStatSync = jest.fn(() => ({
  size: 12,
  mtime: new Date("2026-01-01T00:00:00Z"),
}));

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

const mockRequireAuth = jest.fn((..._a: unknown[]): NextResponse | null => null);

jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

const mockEnsureDb = jest.fn();
jest.mock("@/lib/db", () => ({
  ensureDb: () => mockEnsureDb(),
}));

const mockUpsertSkill = jest.fn();
jest.mock("@/lib/skills-repository", () => ({
  parseSkillFrontmatter: jest.fn(() => ({
    name: "demo",
    description: "Demo skill",
    category: "custom",
  })),
  upsertSkill: (...args: unknown[]) => mockUpsertSkill(...args),
  getSkill: jest.fn(),
}));

const mockPushSkillToHermes = jest.fn(
  (..._a: unknown[]): { success: boolean; error?: string } => ({ success: true }),
);
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushSkillToHermes: (...args: unknown[]) => mockPushSkillToHermes(...args),
}));

import { NextRequest, NextResponse } from "next/server";

describe("PUT /api/skills/[name]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue(null);
    mockExistsSync.mockReturnValue(true);
    mockPushSkillToHermes.mockReturnValue({ success: true });
  });

  it("upserts SKILL.md content when authenticated", async () => {
    const { PUT } = await import("@/app/api/skills/[name]/route");
    const req = new NextRequest("http://localhost/api/skills/demo?profile=default", {
      method: "PUT",
      body: JSON.stringify({ content: "updated skill body" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "demo" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(mockUpsertSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skillKey: "demo", content: "updated skill body" }),
    );
    expect(mockPushSkillToHermes).toHaveBeenCalledWith("demo");
  });

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.

  it("returns 500 when skill push fails", async () => {
    mockPushSkillToHermes.mockReturnValue({ success: false, error: "Push failed" });

    const { PUT } = await import("@/app/api/skills/[name]/route");
    const req = new NextRequest("http://localhost/api/skills/missing", {
      method: "PUT",
      body: JSON.stringify({ content: "x" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "missing" }) });
    expect(res.status).toBe(500);
  });

  it("returns 400 on invalid JSON body (not 500)", async () => {
    // Regression: parseJsonBody now returns 400 for malformed JSON.
    // Previously the inline try/catch did the same, but a refactor
    // that dropped the wrapper caused invalid JSON to surface as 500.
    const { PUT } = await import("@/app/api/skills/[name]/route");
    const req = new NextRequest("http://localhost/api/skills/demo", {
      method: "PUT",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "demo" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
    expect(mockUpsertSkill).not.toHaveBeenCalled();
  });
});
