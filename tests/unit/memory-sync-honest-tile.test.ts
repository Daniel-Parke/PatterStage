/**
 * @jest-environment node
 *
 * MemorySync must report a LIVE Hindsight as installed even when the Hermes
 * config.yaml `memory.provider` is blank (the dashboard-tile honesty fix). It
 * probes the running server directly rather than trusting the YAML value.
 */

const mockSetMultipleStats = jest.fn();
const mockSetSystemStatBoolean = jest.fn();
jest.mock("@/lib/system-repository", () => ({
  setMultipleStats: (...a: unknown[]) => mockSetMultipleStats(...a),
  setSystemStatBoolean: (...a: unknown[]) => mockSetSystemStatBoolean(...a),
}));

// config.yaml says "none" — the blank-provider case the old code mishandled.
jest.mock("@/lib/memory-providers", () => ({ getMemoryProviderType: () => "none" }));
jest.mock("@/lib/hermes-agent-runtime", () => ({ getActiveHermesPaths: () => ({ memoryDb: "/nope/memory.db" }) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

import { MemorySync } from "@/lib/sync/sources/MemorySync";

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  mockSetMultipleStats.mockReset();
  mockSetSystemStatBoolean.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

function statsOf() {
  return mockSetMultipleStats.mock.calls[0][0] as Record<string, string>;
}

describe("MemorySync — honest tile", () => {
  it("reports Hindsight installed + fact count when the server answers (provider blank)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ total: 17638 }), { status: 200 }),
    );
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Hindsight");
    expect(statsOf()["memory.fact_count"]).toBe("17638");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", true);
  });

  it("reports a healthy-but-empty Hindsight as installed (available, 0 facts)", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ total: 0 }), { status: 200 }));
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Hindsight");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", true);
  });

  it("reports Not Installed when the server is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Not Installed");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", false);
  });
});
