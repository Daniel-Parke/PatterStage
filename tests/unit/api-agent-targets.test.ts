/** @jest-environment node */

import { getHermesEntry } from "@/lib/agent-registry";

jest.mock("@/lib/agent-registry", () => ({
  getHermesEntry: jest.fn(),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

describe("GET /api/agent/targets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getHermesEntry as jest.Mock).mockReturnValue({
      id: "default",
      label: "Default Hermes",
      filesystemRoot: "/tmp/hermes",
      gatewayBaseUrl: undefined,
      llmBaseUrl: undefined,
    });
  });

  it("returns the single Hermes entry", async () => {
    const { GET } = await import("@/app/api/agent/targets/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("default");
    expect(body.data.label).toBe("Default Hermes");
    expect(body.data.filesystemRoot).toBe("/tmp/hermes");
    expect(body.data.gatewayBaseUrl).toBeNull();
    expect(body.data.llmBaseUrl).toBeNull();
  });

  it("includes gateway and LLM URLs when set", async () => {
    (getHermesEntry as jest.Mock).mockReturnValue({
      id: "default",
      label: "Custom",
      filesystemRoot: "/opt/hermes",
      gatewayBaseUrl: "http://localhost:9999",
      llmBaseUrl: "http://localhost:9999/v1/chat/completions",
    });

    // Force re-import to pick up new mock
    jest.resetModules();
    jest.mock("@/lib/agent-registry", () => ({
      getHermesEntry: jest.fn().mockReturnValue({
        id: "default",
        label: "Custom",
        filesystemRoot: "/opt/hermes",
        gatewayBaseUrl: "http://localhost:9999",
        llmBaseUrl: "http://localhost:9999/v1/chat/completions",
      }),
    }));
    jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

    const { GET } = await import("@/app/api/agent/targets/route");
    const res = await GET();
    const body = await res.json();
    expect(body.data.gatewayBaseUrl).toBe("http://localhost:9999");
    expect(body.data.llmBaseUrl).toBe("http://localhost:9999/v1/chat/completions");
  });
});
