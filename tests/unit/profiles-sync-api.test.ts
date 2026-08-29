/** @jest-environment node */

jest.mock("@/lib/api-auth", () => ({
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));

const mockPushProfile = jest.fn((..._a: unknown[]) => ({ success: true, slug: "qa", backupPath: null, error: null }));
const mockPushAll = jest.fn((..._a: unknown[]) => [{ success: true, slug: "qa", backupPath: null, error: null }]);
const mockPullProfile = jest.fn((..._a: unknown[]) => ({ success: true, slug: "qa", backupPath: null, error: null }));

jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: (...args: unknown[]) => mockPushProfile(...args),
  pushAllProfiles: (...args: unknown[]) => mockPushAll(...args),
  pushRootToHermes: jest.fn(),
  pushAllSkillsToHermes: jest.fn(),
  pushSkillToHermes: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/profile-pull", () => ({
  pullProfileFromHermes: (...args: unknown[]) => mockPullProfile(...args),
  pullRootFromHermes: jest.fn(),
  pullSkillFromHermes: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/profile-discovery", () => ({
  discoverLocalProfiles: jest.fn(() => []),
  importDiscoveredProfile: jest.fn(),
  importAllSkillsFromDisk: jest.fn(() => []),
}));

describe("profile sync API routes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("POST push single slug", async () => {
    const { POST } = await import("@/app/api/agent/profiles/sync/push/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/agent/profiles/sync/push", {
      method: "POST",
      body: JSON.stringify({ slug: "qa" }),
    });
    const res = await POST(req);
    const body = (await res.json()) as { data: { success: boolean } };
    expect(body.data.success).toBe(true);
    expect(mockPushProfile).toHaveBeenCalledWith("qa");
  });

  it("POST push all", async () => {
    const { POST } = await import("@/app/api/agent/profiles/sync/push/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/agent/profiles/sync/push", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    });
    await POST(req);
    expect(mockPushAll).toHaveBeenCalled();
  });

  it("POST pull requires slug", async () => {
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/agent/profiles/sync/pull", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
