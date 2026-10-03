/** @jest-environment node */

// T-0090: the gate sits inside HermesRuntime.fetchJson, so every caller that
// goes through the runtime (mission dispatch, chat, composer, research,
// reconcile) shares it without knowing it exists. Streams are exempt: an SSE
// subscription is open for the life of a run and would hold a slot for
// minutes; the gate is for the request/response calls that pile up.

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { GatewayGate, getDefaultGatewayGate } from "@/lib/runtime/gateway-gate";
import { RuntimeRequestError } from "@/lib/runtime/types";

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

const RUN = { run_id: "run_1", status: "completed", session_id: "s" };

/** A fetch that never answers for the slow endpoint and answers at once for the rest. */
function fetchHangingOn(slowBase: string) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith(slowBase)) return new Promise<Response>(() => {});
    return jsonResponse(200, RUN);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const endpoints: Record<string, { profileName: string; baseUrl: string; apiKey: string }> = {
  slow: { profileName: "slow", baseUrl: "http://slow:8642", apiKey: "k" },
  fast: { profileName: "fast", baseUrl: "http://fast:8642", apiKey: "k" },
};

describe("HermesRuntime is gated per endpoint", () => {
  it("refuses with a 503 naming the gate once the endpoint's slots and queue are full", async () => {
    const { fetchImpl } = fetchHangingOn("http://slow:8642");
    const rt = new HermesRuntime({
      fetchImpl,
      resolve: (p) => endpoints[p ?? "slow"],
      gate: new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 }),
    });

    const stuck = rt.getRun("run_1", "slow");
    stuck.catch(() => {});
    await new Promise((r) => setTimeout(r, 0));

    let err: unknown;
    try { await rt.getRun("run_2", "slow"); } catch (e) { err = e; }

    expect(err).toBeInstanceOf(RuntimeRequestError);
    expect((err as RuntimeRequestError).status).toBe(503);
    expect((err as Error).message).toMatch(/gateway gate/i);
    expect((err as Error).message).toContain("http://slow:8642");
  });

  it("a healthy endpoint is still served while another is saturated", async () => {
    const { fetchImpl } = fetchHangingOn("http://slow:8642");
    const rt = new HermesRuntime({
      fetchImpl,
      resolve: (p) => endpoints[p ?? "slow"],
      gate: new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 }),
    });
    rt.getRun("run_1", "slow").catch(() => {});
    await new Promise((r) => setTimeout(r, 0));

    const r = await rt.getRun("run_2", "fast");

    expect(r.runId).toBe("run_1");
  });

  it("a stream is not gated: it opens even when the endpoint is saturated", async () => {
    const { fetchImpl, calls } = fetchHangingOn("http://slow:8642");
    const rt = new HermesRuntime({
      fetchImpl,
      resolve: (p) => endpoints[p ?? "slow"],
      gate: new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 }),
    });
    rt.getRun("run_1", "slow").catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    const before = calls.length;

    const it = rt.streamRunEvents("run_1", "slow")[Symbol.asyncIterator]();
    const next = it.next();
    next.catch(() => {});
    await new Promise((r) => setTimeout(r, 0));

    // The stream's fetch was attempted (it hangs by construction); the gate
    // did not refuse it.
    expect(calls.length).toBe(before + 1);
    expect(calls[calls.length - 1]).toContain("/events");
  });

  it("GREEN CONTROL: under the limit, calls pass through untouched", async () => {
    const { fetchImpl } = fetchHangingOn("http://nowhere");
    const rt = new HermesRuntime({ fetchImpl, resolve: (p) => endpoints[p ?? "fast"], gate: new GatewayGate({ maxInFlight: 2, maxQueue: 0, queueTimeoutMs: 1000 }) });

    const [a, b] = await Promise.all([rt.getRun("run_1", "fast"), rt.getRun("run_1", "fast")]);

    expect(a.runId).toBe("run_1");
    expect(b.runId).toBe("run_1");
  });
});

describe("the process-wide gate", () => {
  it("is one object, reads the environment, and is what a default runtime uses", () => {
    const g1 = getDefaultGatewayGate();
    const g2 = getDefaultGatewayGate();

    expect(g1).toBe(g2);
    expect(g1.snapshot().limits.maxInFlight).toBeGreaterThan(0);
    expect(new HermesRuntime().gateSnapshot()).toEqual(g1.snapshot());
  });
});
