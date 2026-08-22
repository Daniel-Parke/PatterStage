/**
 * @jest-environment node
 *
 * MemorySync must report a LIVE memory provider as installed even when the
 * Hermes config.yaml `memory.provider` is blank (the dashboard-tile honesty
 * fix). It probes the active provider (DB-owned endpoint) directly.
 */

const mockSetMultipleStats = jest.fn();
const mockSetSystemStatBoolean = jest.fn();
jest.mock("@/lib/system-repository", () => ({
  setMultipleStats: (...a: unknown[]) => mockSetMultipleStats(...a),
  setSystemStatBoolean: (...a: unknown[]) => mockSetSystemStatBoolean(...a),
}));

let providerStats: { available: boolean; factCount: number; dbSize?: string };
// config.yaml says "none" — the blank-provider case the old code mishandled —
// but the active provider (Hindsight via DB config) is what actually decides.
jest.mock("@/lib/memory/memory-providers", () => ({
  getMemoryProviderType: () => "none",
  getActiveMemoryProvider: () => ({ stats: async () => providerStats }),
}));
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({ getActiveHermesPaths: () => ({ memoryDb: "/nope/memory.db" }) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

import { MemorySync } from "@/lib/sync/sources/MemorySync";

beforeEach(() => {
  mockSetMultipleStats.mockReset();
  mockSetSystemStatBoolean.mockReset();
});

function statsOf() {
  return mockSetMultipleStats.mock.calls[0][0] as Record<string, string>;
}

describe("MemorySync — honest tile", () => {
  it("reports the provider installed + fact count when it answers (config blank)", async () => {
    providerStats = { available: true, factCount: 17638, dbSize: "In-agent" };
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Hindsight");
    expect(statsOf()["memory.fact_count"]).toBe("17638");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", true);
  });

  it("reports a healthy-but-empty provider as installed (available, 0 facts)", async () => {
    providerStats = { available: true, factCount: 0 };
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Hindsight");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", true);
  });

  it("reports Not Installed when the provider is unreachable", async () => {
    providerStats = { available: false, factCount: 0 };
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Not Installed");
    expect(mockSetSystemStatBoolean).toHaveBeenCalledWith("memory.available", false);
  });
});
