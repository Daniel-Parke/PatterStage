/** @jest-environment node */

import { existsSync, readFileSync } from "fs";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

const mockReadAgentRegistry = jest.fn();

jest.mock("@/lib/agent-registry", () => ({
  readAgentRegistry: () => mockReadAgentRegistry(),
}));

jest.mock("@/lib/paths", () => ({
  CH_DATA_DIR: "/tmp/ch-data",
}));

describe("GET /api/agent/targets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadAgentRegistry.mockReturnValue({
      version: 1,
      activeAgentId: "default",
      agents: [
        {
          id: "default",
          label: "Default",
          filesystemRoot: "/tmp/hermes",
        },
      ],
    });
  });

  it("returns registry and null discovery when file missing", async () => {
    (existsSync as jest.Mock).mockReturnValue(false);

    const { GET } = await import("@/app/api/agent/targets/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activeAgentId).toBe("default");
    expect(body.data.agents).toHaveLength(1);
    expect(body.data.discovery).toBeNull();
  });

  it("includes discovery JSON when present", async () => {
    (existsSync as jest.Mock).mockImplementation((p: string) =>
      String(p).endsWith("agents.discovery.json")
    );
    (readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: 1, entries: [] }));

    const { GET } = await import("@/app/api/agent/targets/route");
    const res = await GET();
    const body = await res.json();
    expect(body.data.discovery).toEqual({ version: 1, entries: [] });
  });
});
