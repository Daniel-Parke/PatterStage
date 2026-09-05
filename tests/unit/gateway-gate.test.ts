/** @jest-environment node */

// T-0090, ruling 2: the gateway gate. Round 6's architecture note asked for a
// circuit breaker on the LLM endpoint. What this product needs is narrower and
// provable: a bounded admission gate per gateway endpoint, so a stalled
// gateway cannot pile up unbounded in-flight requests in this process, cannot
// queue callers forever, and cannot starve a healthy endpoint. Saturation is
// a refusal that names the gate, not a hang.

import { GatewayGate, GatewayGateSaturatedError, gateLimitsFromEnv } from "@/lib/runtime/gateway-gate";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("admission", () => {
  it("admits up to maxInFlight, queues up to maxQueue, refuses beyond", async () => {
    const gate = new GatewayGate({ maxInFlight: 2, maxQueue: 1, queueTimeoutMs: 1000 });
    const a = deferred(); const b = deferred(); const c = deferred();
    const pa = gate.run("http://gw", () => a.promise);
    const pb = gate.run("http://gw", () => b.promise);
    const pc = gate.run("http://gw", () => c.promise);
    await flush();

    expect(gate.snapshot().endpoints["http://gw"]).toMatchObject({ inFlight: 2, queued: 1 });

    await expect(gate.run("http://gw", () => Promise.resolve("never"))).rejects.toBeInstanceOf(GatewayGateSaturatedError);
    a.resolve(); b.resolve(); c.resolve();
    await Promise.all([pa, pb, pc]);
  });

  it("the refusal is a 503 that names the gate and the endpoint", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 });
    const hold = deferred();
    const p = gate.run("http://gw:8642", () => hold.promise);
    await flush();

    let err: unknown;
    try { await gate.run("http://gw:8642", () => Promise.resolve()); } catch (e) { err = e; }

    expect(err).toBeInstanceOf(GatewayGateSaturatedError);
    expect((err as GatewayGateSaturatedError).status).toBe(503);
    expect((err as Error).message).toMatch(/gateway gate/i);
    expect((err as Error).message).toContain("http://gw:8642");
    expect((err as Error).message).toMatch(/1 in flight/);
    hold.resolve(); await p;
  });

  it("a queued call runs when a slot frees, first in first out", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 2, queueTimeoutMs: 1000 });
    const order: string[] = [];
    const first = deferred();
    const p1 = gate.run("http://gw", async () => { order.push("1"); await first.promise; });
    const p2 = gate.run("http://gw", async () => { order.push("2"); });
    const p3 = gate.run("http://gw", async () => { order.push("3"); });
    await flush();
    expect(order).toEqual(["1"]);

    first.resolve();
    await Promise.all([p1, p2, p3]);

    expect(order).toEqual(["1", "2", "3"]);
  });

  it("a slot is released when the call throws", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 });
    await expect(gate.run("http://gw", async () => { throw new Error("boom"); })).rejects.toThrow("boom");

    expect(gate.snapshot().endpoints["http://gw"]?.inFlight ?? 0).toBe(0);
    await expect(gate.run("http://gw", async () => "ok")).resolves.toBe("ok");
  });

  it("a queued call gives up after queueTimeoutMs with the same refusal", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 1, queueTimeoutMs: 30 });
    const hold = deferred();
    const p = gate.run("http://gw", () => hold.promise);
    await flush();

    await expect(gate.run("http://gw", () => Promise.resolve())).rejects.toBeInstanceOf(GatewayGateSaturatedError);
    hold.resolve(); await p;
  });
});

describe("degraded, not dead", () => {
  it("one saturated endpoint cannot starve another", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 });
    const stuck = deferred();
    const p = gate.run("http://slow", () => stuck.promise);
    await flush();

    await expect(gate.run("http://healthy", async () => "served")).resolves.toBe("served");
    stuck.resolve(); await p;
  });
});

describe("the snapshot Batch 6 reads", () => {
  it("counts admitted and refused, per endpoint and in total", async () => {
    const gate = new GatewayGate({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 });
    const hold = deferred();
    const p = gate.run("http://gw", () => hold.promise);
    await flush();
    try { await gate.run("http://gw", () => Promise.resolve()); } catch { /* refused */ }
    hold.resolve(); await p;

    const s = gate.snapshot();
    expect(s.limits).toEqual({ maxInFlight: 1, maxQueue: 0, queueTimeoutMs: 1000 });
    expect(s.admitted).toBe(1);
    expect(s.refused).toBe(1);
    expect(s.endpoints["http://gw"]).toMatchObject({ inFlight: 0, queued: 0, admitted: 1, refused: 1 });
  });

  it("reads its limits from the environment, with sane defaults", () => {
    expect(gateLimitsFromEnv({})).toEqual({ maxInFlight: 8, maxQueue: 32, queueTimeoutMs: 10_000 });
    expect(gateLimitsFromEnv({ PS_GATEWAY_MAX_INFLIGHT: "3", PS_GATEWAY_MAX_QUEUE: "0", PS_GATEWAY_QUEUE_TIMEOUT_MS: "250" }))
      .toEqual({ maxInFlight: 3, maxQueue: 0, queueTimeoutMs: 250 });
    // Junk never disables the gate.
    expect(gateLimitsFromEnv({ PS_GATEWAY_MAX_INFLIGHT: "abc", PS_GATEWAY_MAX_QUEUE: "-4" })).toEqual({ maxInFlight: 8, maxQueue: 0, queueTimeoutMs: 10_000 });
  });
});
