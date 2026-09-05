/** @jest-environment node */

jest.mock("@/lib/api-auth", () => ({
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));

const mockHydrate = jest.fn((..._a: unknown[]) => ({
  toolsets: { cli: ["hermes-cli"], discord: ["hermes-discord"] },
  source: "database" as const,
  platformToolsetsJson: '{"cli":["hermes-cli"],"discord":["hermes-discord"]}',
}));

const mockUpdateProfile = jest.fn();
const mockUpdateRoot = jest.fn();
const mockGetProfile = jest.fn((..._a: unknown[]) => ({ slug: "qa" }));
const mockPushProfile = jest.fn((..._a: unknown[]) => ({ success: true, slug: "qa", backupPath: null, error: null }));
const mockPushRoot = jest.fn((..._a: unknown[]) => ({ success: true, slug: "default", backupPath: null, error: null }));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  hydratePlatformToolsetsForSlug: (...args: unknown[]) => mockHydrate(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfileContent: (...args: unknown[]) => mockUpdateProfile(...args),
}));

jest.mock("@/lib/agent-root-repository", () => ({
  updateAgentRoot: (...args: unknown[]) => mockUpdateRoot(...args),
}));

jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: (...args: unknown[]) => mockPushProfile(...args),
  pushRootToHermes: (...args: unknown[]) => mockPushRoot(...args),
}));

describe("profile toolsets API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GET hydrates and returns platform toolsets", async () => {
    const { GET } = await import("@/app/api/agent/profiles/[id]/toolsets/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(
      new NextRequest("http://localhost/api/agent/profiles/qa/toolsets"),
      { params: Promise.resolve({ id: "qa" }) },
    );
    const body = (await res.json()) as {
      data: { platformToolsets: Record<string, string[]>; source: string };
    };
    expect(res.status).toBe(200);
    expect(body.data.platformToolsets.cli).toEqual(["hermes-cli"]);
    expect(mockHydrate).toHaveBeenCalledWith("qa", { persist: true });
  });

  it("PUT saves toolsets and pushes profile", async () => {
    const { PUT } = await import("@/app/api/agent/profiles/[id]/toolsets/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/agent/profiles/qa/toolsets", {
      method: "PUT",
      body: JSON.stringify({ platformToolsets: { cli: ["hermes-cli"] } }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "qa" }) });
    const body = (await res.json()) as { data: { success: boolean } };
    expect(body.data.success).toBe(true);
    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(mockPushProfile).toHaveBeenCalledWith("qa");
  });
});
