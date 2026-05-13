/** @jest-environment node */

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

const mockReadAgentRegistry = jest.fn();
const mockSetActiveAgentId = jest.fn();
const mockUpsertAgentEntry = jest.fn();

jest.mock("@/lib/agent-registry", () => ({
  readAgentRegistry: () => mockReadAgentRegistry(),
  setActiveAgentId: (id: string) => mockSetActiveAgentId(id),
  upsertAgentEntry: (e: unknown) => mockUpsertAgentEntry(e),
}));

import { NextRequest } from "next/server";

describe("POST /api/agent/active", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetActiveAgentId.mockReturnValue({ ok: true });
    mockReadAgentRegistry.mockReturnValue({
      version: 1,
      activeAgentId: "a2",
      agents: [
        { id: "a1", label: "One", filesystemRoot: "/x" },
        { id: "a2", label: "Two", filesystemRoot: "/y" },
      ],
    });
  });

  it("returns 400 when agentId missing", async () => {
    const { POST } = await import("@/app/api/agent/active/route");
    const req = new NextRequest("http://localhost/api/agent/active", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets active agent and returns registry", async () => {
    const { POST } = await import("@/app/api/agent/active/route");
    const req = new NextRequest("http://localhost/api/agent/active", {
      method: "POST",
      body: JSON.stringify({ agentId: "a2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSetActiveAgentId).toHaveBeenCalledWith("a2");
    const body = await res.json();
    expect(body.data.activeAgentId).toBe("a2");
  });

  it("upserts register payload when provided", async () => {
    const { POST } = await import("@/app/api/agent/active/route");
    const req = new NextRequest("http://localhost/api/agent/active", {
      method: "POST",
      body: JSON.stringify({
        agentId: "a2",
        register: {
          id: "new1",
          label: "New",
          filesystemRoot: "/z/",
        },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsertAgentEntry).toHaveBeenCalled();
    expect(mockSetActiveAgentId).toHaveBeenCalledWith("a2");
  });
});
