/** @jest-environment node */

// Independent T0194 survivor controls, Faraday, 2026-10-04. Owned transport only.
import { buildPartialUpdateBody, MENTAL_MODEL_UPDATE_FIELDS } from "@/lib/memory/hindsight-route-helpers";
import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { GatewayGate } from "@/lib/runtime/gateway-gate";

jest.mock("@/lib/runtime/endpoint-registry", () => ({
  resolveEndpoint: () => { throw new Error("Owned injected endpoint required"); },
}));

it("the public mental-model field map sends literal query as source_query", () => {
  const query = "  owned <tag> `literal`\nsecond line  ";
  expect(buildPartialUpdateBody({ name: "Owned model", query }, MENTAL_MODEL_UPDATE_FIELDS))
    .toEqual({ name: "Owned model", source_query: query });
  expect(buildPartialUpdateBody({ query: "" }, MENTAL_MODEL_UPDATE_FIELDS)).toEqual({ source_query: "" });
});

it("private Stop rejects a rotated gateway receipt without handing off credentials", async () => {
  const endpoint = { profileName: "owned", baseUrl: "http://owned.invalid/first", apiKey: "owned-first-key" };
  const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 }));
  const runtime = new HermesRuntime({ fetchImpl, gate: new GatewayGate(), resolve: () => ({ ...endpoint }) });
  const receipt = await runtime.submitComposerRun({ input: "owned", idempotencyKey: "owned-stop" });
  const stop = {
    backendRunId: receipt.handle.runId, gatewayIdentity: receipt.gatewayIdentity,
    profileName: "owned", signal: new AbortController().signal,
  };
  // Positive control: the same real private method admits the original receipt.
  await runtime.stopComposerRun(stop);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(String(fetchImpl.mock.calls[1][0])).toBe("http://owned.invalid/first/v1/runs/owned/stop");
  expect(new Headers(fetchImpl.mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer owned-first-key");

  endpoint.baseUrl = "http://owned.invalid/second";
  endpoint.apiKey = "owned-second-key";
  fetchImpl.mockClear();
  // Settle both outcomes into data so mutation failures carry matcherResult.
  const outcome = await runtime.stopComposerRun(stop).then(
    () => ({ kind: "fulfilled" }),
    (error: unknown) => ({ kind: "rejected", error }),
  );
  expect(outcome).toMatchObject({ kind: "rejected", error: expect.any(Error) });
  expect(fetchImpl).not.toHaveBeenCalled();
});
