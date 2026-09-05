/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * PR 7 — callLLM resolves an `opts.modelId` against the registry:
 *   - direct provider path when baseUrl + apiKey are set
 *   - gateway path when the registry row lacks baseUrl
 *   - gateway fallback when modelId is unknown
 */

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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

function jsonOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("callLLM with modelId", () => {
  it("calls the provider directly when registry row has baseUrl + apiKey", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue({
      id: "m1",
      name: "OpenAI GPT-5",
      provider: "openai",
      modelId: "gpt-5.5-medium",
      baseUrl: "https://api.openai.com/v1",
      contextLength: 200000,
      credentialsId: "cred-openai",
      defaults: {},
      createdAt: "",
      updatedAt: "",
      apiKey: "sk-real-key",
    });

    fetchMock.mockResolvedValueOnce(
      jsonOk({
        choices: [{ message: { content: "hi from openai" } }],
        model: "gpt-5.5-medium",
        usage: {},
      })
    );

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    const result = await callLLM([{ role: "user", content: "ping" }], { modelId: "m1" });

    expect(result.content).toBe("hi from openai");
    // fetch called once, on the provider URL with Bearer token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.openai.com/v1/chat/completions");
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-real-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-5.5-medium");
  });

  it("falls through to the gateway when registry row has no baseUrl", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue({
      id: "m2",
      name: "Sonnet via gateway",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: null,
      contextLength: null,
      credentialsId: null,
      defaults: {},
      createdAt: "",
      updatedAt: "",
      apiKey: null,
    });

    // health probe + chat call
    fetchMock.mockResolvedValueOnce(jsonOk({}));
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        choices: [{ message: { content: "from gateway" } }],
        model: "anthropic/claude-sonnet-4",
      })
    );

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    const result = await callLLM([{ role: "user", content: "ping" }], { modelId: "m2" });

    expect(result.content).toBe("from gateway");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const probe = fetchMock.mock.calls[0][0];
    expect(probe).toBe("http://gateway/health");
    const chat = fetchMock.mock.calls[1];
    expect(chat[0]).toBe("http://gateway/v1/chat/completions");
    const body = JSON.parse((chat[1] as RequestInit).body as string);
    expect(body.model).toBe("anthropic/claude-sonnet-4");
  });

  it("uses opts.model when modelId is unknown / unresolved", async () => {
    const repo = require("@/lib/models-repository") as { __getModelWithKey: jest.Mock };
    repo.__getModelWithKey.mockReturnValue(null);

    fetchMock.mockResolvedValueOnce(jsonOk({}));
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        choices: [{ message: { content: "fallback" } }],
        model: "hermes",
      })
    );

    const { callLLM } = require("@/lib/llm") as typeof import("@/lib/llm");
    const result = await callLLM([{ role: "user", content: "ping" }], {
      modelId: "missing",
      model: "hermes",
    });

    expect(result.content).toBe("fallback");
    const chat = fetchMock.mock.calls[1];
    const body = JSON.parse((chat[1] as RequestInit).body as string);
    expect(body.model).toBe("hermes");
  });
});
