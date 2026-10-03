// Unit tests for the HermesRuntime HTTP adapter. No live gateway or DB:
// fetch and endpoint resolution are injected. Covers header injection
// (bearer / idempotency / session), wire-shape mapping, the non-2xx path,
// model-list parsing, and the SSE reader.

import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import type { RuntimeEndpoint } from "@/lib/runtime/endpoint-registry";

const endpoint: RuntimeEndpoint = {
  profileName: "default",
  baseUrl: "http://gw.test:8642",
  apiKey: "secret-key",
};

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERR",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function sseResponse(chunks: string[]): Response {
  let i = 0;
  const enc = new TextEncoder();
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: enc.encode(chunks[i++]) }
            : { done: true, value: undefined },
      }),
    },
  } as unknown as Response;
}

describe("HermesRuntime", () => {
  it("submitRun posts /v1/runs with bearer, idempotency, and session headers", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse(200, { run_id: "run_1", status: "started", session_id: "sess_1" });
    }) as typeof fetch;

    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const handle = await rt.submitRun({
      input: "do it",
      idempotencyKey: "ch-run-1",
      sessionId: "sid",
      sessionKey: "skey",
    });

    expect(handle).toEqual({ runId: "run_1", status: "started", sessionId: "sess_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://gw.test:8642/v1/runs");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer secret-key");
    expect(headers["Idempotency-Key"]).toBe("ch-run-1");
    expect(headers["X-Hermes-Session-Id"]).toBe("sid");
    expect(headers["X-Hermes-Session-Key"]).toBe("skey");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ input: "do it", session_id: "sid" });
  });

  it("getRun maps status and usage to canonical DTO", async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, {
        run_id: "run_1",
        status: "completed",
        output: "done",
        usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
      })) as typeof fetch;

    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const r = await rt.getRun("run_1");
    expect(r.status).toBe("completed");
    expect(r.output).toBe("done");
    expect(r.usage).toEqual({ inputTokens: 5, outputTokens: 7, totalTokens: 12 });
  });

  it("throws RuntimeRequestError carrying the status on a non-2xx response", async () => {
    const fetchImpl = (async () => jsonResponse(401, { error: "unauthorized" })) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    await expect(rt.getRun("run_1")).rejects.toMatchObject({
      name: "RuntimeRequestError",
      status: 401,
    });
  });

  it("omits Authorization when no key is configured", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return jsonResponse(200, { status: "ok" });
    }) as typeof fetch;

    const rt = new HermesRuntime({ fetchImpl, resolve: () => ({ ...endpoint, apiKey: null }) });
    await rt.health();
    const headers = calls[0].headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("listModels accepts the OpenAI {data:[...]} shape", async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, { data: [{ id: "alice" }, { id: "bob", name: "Bob" }] })) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const models = await rt.listModels();
    expect(models).toEqual([
      { id: "alice", label: undefined },
      { id: "bob", label: "Bob" },
    ]);
  });

  it("streamRunEvents parses SSE event blocks", async () => {
    const chunks = [
      'event: response.created\ndata: {"type":"response.created"}\n\n',
      'data: {"type":"response.completed"}\n\n',
    ];
    const fetchImpl = (async () => sseResponse(chunks)) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });

    const types: string[] = [];
    for await (const e of rt.streamRunEvents("run_1")) types.push(e.type);
    expect(types).toEqual(["response.created", "response.completed"]);
  });

  // ── Real Hermes 0.16 contract shapes (validated against the live agent) ──

  it("streamRunEvents reads the event name from data.event (data-only lines)", async () => {
    const chunks = [
      'data: {"event":"message.delta","delta":"hi"}\n\n',
      'data: {"event":"run.completed","output":"hi"}\n\n',
    ];
    const fetchImpl = (async () => sseResponse(chunks)) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const types: string[] = [];
    for await (const e of rt.streamRunEvents("run_1")) types.push(e.type);
    expect(types).toEqual(["message.delta", "run.completed"]);
  });

  it("listSkills accepts the real { object:'list', data:[...] } shape", async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, { object: "list", data: [{ name: "dogfood", description: "QA" }] })) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const skills = await rt.listSkills();
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("dogfood");
  });

  it("listToolsets accepts the real { data:[...] } shape", async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, { object: "list", platform: "api_server", data: [{ name: "web", tools: ["web_search"] }] })) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const ts = await rt.listToolsets();
    expect(ts).toEqual([{ name: "web", tools: ["web_search"] }]);
  });

  it("createSession reads the nested { session:{ id } } shape", async () => {
    const fetchImpl = (async () =>
      jsonResponse(200, { object: "hermes.session", session: { id: "api_123", source: "api_server" } })) as typeof fetch;
    const rt = new HermesRuntime({ fetchImpl, resolve: () => endpoint });
    const s = await rt.createSession({ title: "t", source: "control-hub" });
    expect(s.id).toBe("api_123");
  });
});
