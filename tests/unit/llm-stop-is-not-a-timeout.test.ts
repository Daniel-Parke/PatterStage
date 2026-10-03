/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// llm.ts: the operator's Stop and this file's own timeout are not the same
// event, and must stop being reported as if they were.
//
// THE DEFECT. Both paths link the caller's signal into the SAME AbortController
// as their own timeout, so fetch reports a Stop and a dead endpoint
// identically: AbortError. The direct-provider path then turns every AbortError
// into
//
//   "LLM provider timed out after 45s - check the model's base URL / API style"
//
// which generate.ts writes onto the chapter as its error (see
// story-stop-is-not-a-provider-timeout.test.ts for that half). A stopped
// operator was told to go and debug a configuration that is fine.
//
// The gateway path mislabels nothing, but retries: AbortError is treated as a
// retryable timeout, so a Stop bought two more attempts and about nine seconds
// of waiting on a call that could never succeed.
// ═══════════════════════════════════════════════════════════════

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetModules();
});

/** A fetch that only ever ends when its signal does, like a hung provider. */
function fetchThatHangsUntilAborted(): jest.Mock {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const fail = () => {
          const err = new Error("The operation was aborted.");
          err.name = "AbortError";
          reject(err);
        };
        // A real fetch rejects at once on a signal that is ALREADY aborted; a
        // listener alone would never fire and the call would hang forever.
        if (init.signal?.aborted) {
          fail();
          return;
        }
        init.signal?.addEventListener("abort", fail);
      }),
  );
}

/** Wait for the provider call itself to be away before stopping it. */
async function untilCalled(mock: jest.Mock): Promise<void> {
  for (let i = 0; i < 100 && mock.mock.calls.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("a caller abort is not a provider timeout", () => {
  it("reports a stopped direct-provider call as an abort, not a misconfigured base URL", async () => {
    jest.resetModules();
    jest.doMock("@/lib/models/models-repository", () => ({
      getModelWithKey: jest.fn(() => ({
        id: "m-99",
        name: "A model",
        provider: "openai",
        modelId: "gpt-4o-mini",
        baseUrl: "https://api.example.com/v1",
        contextLength: null,
        credentialsId: "c1",
        apiStyle: "openai",
        createdAt: "",
        updatedAt: "",
        apiKey: "sk-test",
      })),
    }));

    const hanging = fetchThatHangsUntilAborted();
    global.fetch = hanging as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { callLLM } = require("@/lib/models/llm") as typeof import("@/lib/models/llm");

    const controller = new AbortController();
    const settled = callLLM([{ role: "user", content: "write" }], {
      modelId: "m-99",
      signal: controller.signal,
    }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    await untilCalled(hanging);
    controller.abort();
    const err = await settled;

    expect(err).toBeInstanceOf(Error);
    // The name is how every caller tells a Stop from a failure.
    expect(err!.name).toBe("AbortError");
    // And the message must not accuse a configuration that is fine.
    expect(err!.message).not.toMatch(/timed out/i);
    expect(err!.message).not.toMatch(/base URL/i);
  }, 20_000);

  it("does not retry a gateway call the operator stopped", async () => {
    jest.resetModules();
    jest.doMock("@/lib/models/models-repository", () => ({
      getModelWithKey: jest.fn(() => {
        throw new Error("no such model");
      }),
    }));
    jest.doMock("@/lib/runtime/gateway", () => ({
      getAgentGateway: () => ({
        baseUrl: "http://gateway",
        chatCompletionsUrl: "http://gateway/v1/chat/completions",
      }),
    }));
    jest.doMock("@/lib/runtime/secrets", () => ({ getGatewayKey: () => null }));

    const hanging = fetchThatHangsUntilAborted();
    // The health probe answers; only the generation itself hangs.
    const fetchMock = jest.fn((url: string, init: RequestInit) => {
      if (String(url).endsWith("/health")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
      }
      return hanging(url, init) as Promise<Response>;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { callLLM } = require("@/lib/models/llm") as typeof import("@/lib/models/llm");

    const controller = new AbortController();
    const settled = callLLM([{ role: "user", content: "write" }], {
      signal: controller.signal,
    }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    await untilCalled(hanging);
    controller.abort();
    const err = await settled;

    expect(err!.name).toBe("AbortError");
    expect(hanging).toHaveBeenCalledTimes(1);
  }, 30_000);
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL: the timeout this path DOES own still says so
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL", () => {
  it("still blames the endpoint when the direct-provider timeout is what fired", async () => {
    jest.resetModules();
    jest.doMock("@/lib/models/models-repository", () => ({
      getModelWithKey: jest.fn(() => ({
        id: "m-99",
        name: "A model",
        provider: "openai",
        modelId: "gpt-4o-mini",
        baseUrl: "https://api.example.com/v1",
        contextLength: null,
        credentialsId: "c1",
        apiStyle: "openai",
        createdAt: "",
        updatedAt: "",
        apiKey: "sk-test",
      })),
    }));

    global.fetch = fetchThatHangsUntilAborted() as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { callLLM } = require("@/lib/models/llm") as typeof import("@/lib/models/llm");

    // No caller signal at all, and a timeout short enough to fire in a test.
    const err = await callLLM([{ role: "user", content: "write" }], {
      modelId: "m-99",
      timeoutMs: 20,
    }).then(
      () => null,
      (e: unknown) => e as Error,
    );

    expect(err!.message).toMatch(/timed out/i);
    expect(err!.message).toMatch(/base URL/i);
  }, 20_000);
});
