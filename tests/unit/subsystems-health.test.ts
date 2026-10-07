/** @jest-environment node */

// T-0091, ruling 2: the subsystem health summary. Round 6 asked for one place
// that says whether each thing this product depends on is up, and why not.
// Five rows: gateway (reachable and accepting our key), memory (the provider
// answers), sync (the last cycle), config (config.yaml parses; T-0086's
// refusal surfaces here loudly) and the gateway gate (T-0090's counters).
// Every row carries a reason a person can act on, never a bare colour.

import { collectSubsystems, type SubsystemDeps } from "@/lib/status/subsystems";

function deps(over: Partial<SubsystemDeps> = {}): SubsystemDeps {
  return {
    gatewayBaseUrl: () => "http://127.0.0.1:8642",
    probeGateway: async () => ({ ok: true }),
    memoryProviderType: () => "hindsight",
    memoryHealth: async () => ({ available: true }),
    lastSyncCycle: () => ({ completedAt: "2026-09-05T10:00:00Z", allSuccessful: true, results: [], errorsBySource: {} }),
    systemStat: (key: string) => (key === "config.present" ? "true" : null),
    gateSnapshot: () => ({ limits: { maxInFlight: 8, maxQueue: 32, queueTimeoutMs: 10_000 }, admitted: 12, refused: 0, endpoints: {} }),
    ...over,
  };
}

const row = async (d: SubsystemDeps, id: string) => (await collectSubsystems(d)).subsystems.find((s) => s.id === id)!;

describe("gateway", () => {
  it("is ok when the health probe answers, naming the address", async () => {
    const r = await row(deps(), "gateway");
    expect(r.state).toBe("ok");
    expect(r.reason).toContain("http://127.0.0.1:8642");
    // The dashboard reads the address as data, not out of the sentence (T-0092).
    expect(r.url).toBe("http://127.0.0.1:8642");
  });

  it("is down with the probe's own reason when it throws", async () => {
    const r = await row(deps({ probeGateway: async () => { throw new Error("Could not reach the Hermes gateway at http://127.0.0.1:8642 (connection refused)"); } }), "gateway");
    expect(r.state).toBe("down");
    expect(r.reason).toMatch(/connection refused/);
  });

  it("is down and says so when the gateway rejects our key", async () => {
    const { RuntimeRequestError } = await import("@/lib/runtime/types");
    const r = await row(deps({ probeGateway: async () => { throw new RuntimeRequestError("GET /health → 401 Unauthorized", 401); } }), "gateway");
    expect(r.state).toBe("down");
    // Found by mutation: the generic branch's message already said
    // "Unauthorized", so the branch that names the fix had no oracle.
    expect(r.reason).toMatch(/API key/);
    expect(r.reason).toContain("HERMES_API_KEY");
  });

  it("is down when the probe answers but says ok=false", async () => {
    // Found by mutation: no fixture ever had the gateway answer with ok=false.
    const r = await row(deps({ probeGateway: async () => ({ ok: false }) }), "gateway");
    expect(r.state).toBe("down");
    expect(r.reason).toMatch(/ok=false/);
  });
});

describe("memory", () => {
  it("is ok when the provider answers", async () => {
    const r = await row(deps(), "memory");
    expect(r.state).toBe("ok");
    expect(r.reason).toContain("hindsight");
  });

  it("is degraded, not down, when the provider is unavailable: memory is optional", async () => {
    const r = await row(deps({ memoryHealth: async () => ({ available: false, error: "ECONNREFUSED 127.0.0.1:9177" }) }), "memory");
    expect(r.state).toBe("degraded");
    expect(r.reason).toContain("ECONNREFUSED 127.0.0.1:9177");
  });

  it("is degraded when the health call itself throws", async () => {
    const r = await row(deps({ memoryHealth: async () => { throw new Error("timeout"); } }), "memory");
    expect(r.state).toBe("degraded");
    expect(r.reason).toContain("timeout");
  });
});

describe("sync", () => {
  it("is ok after a clean cycle and says when", async () => {
    const r = await row(deps(), "sync");
    expect(r.state).toBe("ok");
    expect(r.reason).toContain("2026-09-05T10:00:00Z");
  });

  it("is degraded before any cycle has completed", async () => {
    const r = await row(deps({ lastSyncCycle: () => null }), "sync");
    expect(r.state).toBe("degraded");
    expect(r.reason).toMatch(/no sync cycle/i);
  });

  it("is degraded naming the failing source and its error", async () => {
    const r = await row(deps({ lastSyncCycle: () => ({ completedAt: "t", allSuccessful: false, results: [], errorsBySource: { SessionSync: "EACCES /sessions" } }) }), "sync");
    expect(r.state).toBe("degraded");
    expect(r.reason).toContain("SessionSync");
    expect(r.reason).toContain("EACCES /sessions");
  });
});

describe("config", () => {
  it("is ok when config.yaml is present and parses", async () => {
    expect((await row(deps(), "config")).state).toBe("ok");
  });

  it("is down with the parse fault when config.yaml does not parse", async () => {
    const r = await row(deps({ systemStat: (k) => (k === "config.yaml_error" ? "duplicated mapping key (27:1)" : k === "config.present" ? "true" : null) }), "config");
    expect(r.state).toBe("down");
    expect(r.reason).toContain("duplicated mapping key (27:1)");
  });

  it("is degraded when there is no config.yaml at all", async () => {
    const r = await row(deps({ systemStat: () => null }), "config");
    expect(r.state).toBe("degraded");
    expect(r.reason).toMatch(/no config\.yaml/i);
  });
});

describe("gate", () => {
  it("is ok with the counters when nothing was refused", async () => {
    const r = await row(deps(), "gate");
    expect(r.state).toBe("ok");
    expect(r.reason).toMatch(/12 admitted/);
  });

  it("is degraded when an endpoint is at its limit right now", async () => {
    const r = await row(deps({ gateSnapshot: () => ({ limits: { maxInFlight: 2, maxQueue: 0, queueTimeoutMs: 1 }, admitted: 5, refused: 0, endpoints: { "http://gw": { inFlight: 2, queued: 0, admitted: 5, refused: 0 } } }) }), "gate");
    expect(r.state).toBe("degraded");
    expect(r.reason).toContain("http://gw");
    expect(r.reason).toMatch(/2 in flight/);
  });

  it("is degraded when calls have been refused", async () => {
    const r = await row(deps({ gateSnapshot: () => ({ limits: { maxInFlight: 8, maxQueue: 32, queueTimeoutMs: 1 }, admitted: 5, refused: 3, endpoints: {} }) }), "gate");
    expect(r.state).toBe("degraded");
    expect(r.reason).toMatch(/3 refused/);
  });
});

describe("the summary", () => {
  it("has exactly the five rows, each with a state and a reason, and says when it looked", async () => {
    const s = await collectSubsystems(deps());
    expect(s.subsystems.map((r) => r.id)).toEqual(["gateway", "memory", "sync", "config", "gate"]);
    for (const r of s.subsystems) {
      expect(["ok", "degraded", "down"]).toContain(r.state);
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
    }
    expect(Number.isFinite(Date.parse(s.checkedAt))).toBe(true);
  });

  it("one dependency throwing does not take the others with it", async () => {
    const s = await collectSubsystems(deps({ gateSnapshot: () => { throw new Error("no gate"); } }));
    expect(s.subsystems).toHaveLength(5);
    expect(s.subsystems.find((r) => r.id === "gate")!.state).toBe("degraded");
    expect(s.subsystems.find((r) => r.id === "gateway")!.state).toBe("ok");
  });
});
