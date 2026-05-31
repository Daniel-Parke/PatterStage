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

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

const mockRequireAuth = jest.fn(() => null);

jest.mock("@/lib/api-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  isChReadOnly: jest.fn(() => false),
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

const mockPushSkillToHermes = jest.fn(() => ({ success: true }));
jest.mock("@/lib/hermes-profile-sync", () => ({
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

  it("rejects when requireAuth returns a response", async () => {
    const readOnlyResponse = NextResponse.json({ error: "Read-only" }, { status: 403 });
    mockRequireAuth.mockReturnValue(readOnlyResponse);

    const { PUT } = await import("@/app/api/skills/[name]/route");
    const req = new NextRequest("http://localhost/api/skills/demo", {
      method: "PUT",
      body: JSON.stringify({ content: "x" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "demo" }) });
    expect(res.status).toBe(403);
    expect(mockUpsertSkill).not.toHaveBeenCalled();
  });

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
});
