/** @jest-environment node */

// T-0089: round 6, finding 6. Cancelling a mission, a composer run or a chat
// whose backend run had already finished logged the gateway's 404 as an
// ERROR at three sites. "Ensure it is not running" is the semantic of stop;
// a run the gateway no longer knows is not running. One fix site: the runtime.

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERR",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function runtimeAnswering(status: number, body: unknown) {
  const calls: string[] = [];
  const rt = new HermesRuntime({
    fetchImpl: (async (url: string | URL | Request) => {
      calls.push(String(url));
      return jsonResponse(status, body);
    }) as unknown as typeof fetch,
    resolve: () => ({ profileName: "default", baseUrl: "http://gw.test:8642", apiKey: "secret-key" }),
  });
  return { rt, calls };
}

describe("HermesRuntime.stopRun", () => {
  it("treats a 404 as already stopped and resolves", async () => {
    const { rt, calls } = runtimeAnswering(404, { error: "run not found" });

    await expect(rt.stopRun("run_gone")).resolves.toBeUndefined();
    expect(calls[0]).toContain("/v1/runs/run_gone/stop");
  });

  it("still rejects on a real failure", async () => {
    const { rt } = runtimeAnswering(500, { error: "boom" });

    await expect(rt.stopRun("run_1")).rejects.toThrow();
  });

  it("GREEN CONTROL: a 200 resolves", async () => {
    const { rt } = runtimeAnswering(200, { ok: true });

    await expect(rt.stopRun("run_1")).resolves.toBeUndefined();
  });
});
