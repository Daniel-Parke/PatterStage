/**
 * @jest-environment node
 *
 * MemorySync must report a LIVE memory provider as installed even when the
 * Hermes config.yaml `memory.provider` is blank (the dashboard-tile honesty
 * fix). It probes the active provider (DB-owned endpoint) directly.
 *
 * These used to also assert a `memory.available` boolean. Nothing ever read it
 * (T-0081), and it was derivable from `memory.provider`, which IS read: "Not
 * Installed" is precisely the unavailable case. The assertions moved onto that
 * key rather than being deleted, so all three cases are still pinned — on the
 * value a reader actually sees.
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
  });

  it("reports a healthy-but-empty provider as installed (available, 0 facts)", async () => {
    providerStats = { available: true, factCount: 0 };
    await new MemorySync().sync();
    // Available and empty is still installed. The tile said "Not Installed" for
    // a working provider with nothing in it yet, which is the honesty fix this
    // file is named for.
    expect(statsOf()["memory.provider"]).toBe("Hindsight");
    expect(statsOf()["memory.fact_count"]).toBe("0");
  });

  it("reports Not Installed when the provider is unreachable", async () => {
    providerStats = { available: false, factCount: 0 };
    await new MemorySync().sync();
    expect(statsOf()["memory.provider"]).toBe("Not Installed");
  });

  it("writes no key that nothing reads", () => {
    // The removal, pinned. `memory.available` going back in would pass every
    // test above and put the sync layer back to doing work for no reader.
    expect(mockSetSystemStatBoolean).not.toHaveBeenCalled();
  });
});
