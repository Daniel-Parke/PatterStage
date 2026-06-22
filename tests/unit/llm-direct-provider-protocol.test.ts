/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Phase 1.5-A — the direct-provider path is protocol-aware. An Anthropic-style
 * model (e.g. MiniMax's `…/anthropic` base) POSTs to `/v1/messages` with
 * `x-api-key` and parses `content[]` — it no longer 404s on `/chat/completions`.
 */

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://gateway/v1/chat/completions",
    gatewayBase: "http://gateway",
  })),
}));

jest.mock("@/lib/models-repository", () => {
  const getModelWithKey = jest.fn();
  return { getModelWithKey, __getModelWithKey: getModelWithKey };
});

const fetchMock = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
  repo.__getModelWithKey.mockReset();
});

afterAll(() => {
  global.fetch = originalFetch;
});

function modelRow(over: Record<string, unknown>) {
  return {
    id: "mm",
    name: "MiniMax",
    provider: "minimax",
    modelId: "MiniMax-M3",
    baseUrl: "https://api.minimax.io/anthropic",
    contextLength: null,
    credentialsId: "c1",
    apiStyle: "anthropic",
    createdAt: "",
    updatedAt: "",
    apiKey: "mm-key",
    ...over,
  };
}

describe("callLLM direct-provider protocol", () => {
  it("uses the Anthropic protocol for an anthropic-style model", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(modelRow({}));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "hi from minimax" }], model: "MiniMax-M3" }),
      text: async () => "",
    });

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    const result = await callLLM([{ role: "user", content: "ping" }], { modelId: "mm" });

    expect(result.content).toBe("hi from minimax");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.minimax.io/anthropic/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("mm-key");
    expect(headers["anthropic-version"]).toBeDefined();
    expect(headers.Authorization).toBeUndefined();
  });

  it("infers anthropic when api_style is null (provider/base heuristic)", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(modelRow({ apiStyle: null }));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }] }),
      text: async () => "",
    });

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    await callLLM([{ role: "user", content: "ping" }], { modelId: "mm" });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.minimax.io/anthropic/v1/messages");
  });

  it("honors a custom timeoutMs in the fast-fail message (benchmark parity)", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(modelRow({}));
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortErr);

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    await expect(
      callLLM([{ role: "user", content: "ping" }], { modelId: "mm", timeoutMs: 120_000 }),
    ).rejects.toThrow(/timed out after 120s/);
  });

  it("defaults to the 45s fast-fail timeout when no override is given", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(modelRow({}));
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortErr);

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    await expect(
      callLLM([{ role: "user", content: "ping" }], { modelId: "mm" }),
    ).rejects.toThrow(/timed out after 45s/);
  });

  it("surfaces the provider's response body in the error on a non-ok status", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(modelRow({}));

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
      text: async () => "404 page not found",
    });

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    await expect(callLLM([{ role: "user", content: "ping" }], { modelId: "mm" })).rejects.toThrow(
      /LLM provider error 404: 404 page not found/,
    );
  });
});
