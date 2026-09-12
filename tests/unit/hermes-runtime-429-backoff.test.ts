/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// A 429 from the gateway means "come back", not "this failed".
//
// Only the benchmark runner retried it, and that is the one caller nobody has
// ever run. The three real dispatch paths treated it as failure:
// composer/dispatch wrote the node-run failed, which the engine routes as
// on_fail and which burns one of MAX_NODE_ATTEMPTS -- so a busy gateway was
// indistinguishable from a stage that produced a bad verdict. Moving the retry
// into submitRun means every caller inherits it.
// ═══════════════════════════════════════════════════════════════

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { RuntimeRequestError } from "@/lib/runtime/types";

function busyThen(okAfter: number) {
  let calls = 0;
  // Typed params, not `async ()`: the mock's call tuple has to carry the init
  // object for the Idempotency-Key assertion below to be able to read it.
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => {
    calls += 1;
    if (calls <= okAfter) {
      return new Response(JSON.stringify({ error: "at capacity" }), { status: 429 });
    }
    return new Response(JSON.stringify({ run_id: "r1", status: "queued" }), { status: 200 });
  });
  return { fetchImpl, calls: () => calls };
}

function runtime(fetchImpl: jest.Mock) {
  return new HermesRuntime({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    resolve: () => ({ profileName: "default", baseUrl: "http://127.0.0.1:8642", apiKey: null }),
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("submitRun retries a 429", () => {
  it("succeeds after two busy responses instead of failing the caller", async () => {
    const { fetchImpl, calls } = busyThen(2);
    const p = runtime(fetchImpl).submitRun({ input: "go", idempotencyKey: "run-1" });
    await jest.advanceTimersByTimeAsync(2000 + 4000);
    await expect(p).resolves.toMatchObject({ runId: "r1" });
    expect(calls()).toBe(3);
  });

  it("reuses the same Idempotency-Key on every retry, so a coalesced duplicate stays one run", async () => {
    const { fetchImpl } = busyThen(1);
    const p = runtime(fetchImpl).submitRun({ input: "go", idempotencyKey: "run-2" });
    await jest.advanceTimersByTimeAsync(2000);
    await p;
    const keys = fetchImpl.mock.calls.map(
      (c) => new Headers((c[1] as RequestInit | undefined)?.headers).get("Idempotency-Key"),
    );
    expect(keys).toEqual(["run-2", "run-2"]);
  });

  it("gives up after 4 attempts and surfaces the 429", async () => {
    const { fetchImpl, calls } = busyThen(99);
    const p = runtime(fetchImpl).submitRun({ input: "go", idempotencyKey: "run-3" });
    const assertion = expect(p).rejects.toMatchObject({ status: 429 });
    await jest.advanceTimersByTimeAsync(2000 + 4000 + 6000);
    await assertion;
    expect(calls()).toBe(4);
  });

  it("does not retry a non-429: a 400 will not become a 200 by asking again", async () => {
    const fetchImpl = jest.fn(
      async () => new Response(JSON.stringify({ error: "bad input" }), { status: 400 }),
    );
    await expect(
      runtime(fetchImpl).submitRun({ input: "go", idempotencyKey: "run-4" }),
    ).rejects.toBeInstanceOf(RuntimeRequestError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts mid-backoff rather than sitting out the remaining budget", async () => {
    const { fetchImpl, calls } = busyThen(99);
    const ac = new AbortController();
    const p = runtime(fetchImpl).submitRun({
      input: "go",
      idempotencyKey: "run-5",
      signal: ac.signal,
    });
    const assertion = expect(p).rejects.toBeDefined();
    await jest.advanceTimersByTimeAsync(500); // inside the first 2s sleep
    ac.abort(new Error("cancelled"));
    await assertion;
    // One submit attempted, then cancelled during the wait: no second attempt.
    expect(calls()).toBe(1);
  });
});
