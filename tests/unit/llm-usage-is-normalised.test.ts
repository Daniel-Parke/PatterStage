/** @jest-environment node */

// T-0068 acceptance oracle — the provider's token counts must survive the trip
// into a research run.
//
// THE DEFECT, and it is the third of its family. Deep Research persists NULL for
// every token column on EVERY run. T-0030 added the columns and the plumbing at
// both ends; the two ends have never spoken the same key names.
//
//   llm.ts (gateway)        `usage: data.usage`  -> {prompt_tokens, ...}
//   llm.ts (openai direct)  `usage: data.usage`  -> {prompt_tokens, ...}
//   usage.ts accumulate     reads call.promptTokens -> undefined -> skipped
//
// Every call is skipped, `sawAny` stays false, the accumulator returns null, and
// the run is written as "never recorded".
//
// WHY THE COMPILER DID NOT CATCH IT. Every annotation in the chain is correct
// and correctly placed: LLMResponse.usage is declared camelCase, and both
// callers are annotated to return it. The laundering is one expression --
// `Response.json()` is typed `Promise<any>` in the DOM lib, so `data.usage` is
// `any` and assigns to anything. `strict: true` does not close that. The
// Anthropic branch fifteen lines above escapes precisely because an explicit
// cast forced its author to NAME the wire shape and build a new object.
//
// WHY THE TESTS WERE GREEN. tests/unit/research-usage-engine.test.ts is titled
// "defaultLlm stops discarding what callLLM reported" and mocks callLLM
// returning CAMELCASE -- which the real callLLM never produces. It encodes the
// intended contract as its fixture, so it is green by construction and could
// never have failed. This file therefore drives the REAL boundary, faking only
// the HTTP response, which is the shape tests/unit/composer-spend-is-counted.ts
// took for T-0058.
//
// THE HARM. spend-summary's foldResearch drops any run whose promptTokens is
// null, so 100% of Deep Research spend is excluded from budgetSpentUsd -- the
// number the optional hard stop is compared against. That is the exact harm
// T-0030 and T-0058 were both opened to remove.

const mockGetAgentGateway = jest.fn(() => ({ baseUrl: "http://127.0.0.1:9", apiKey: "" }));

jest.mock("@/lib/runtime/gateway", () => ({
  getAgentGateway: (...a: unknown[]) => mockGetAgentGateway(...(a as [])),
}));
jest.mock("@/lib/runtime/secrets", () => ({ getGatewayKey: () => "" }));
jest.mock("@/lib/models-repository", () => ({ getModelWithKey: () => null }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

/** An OpenAI-shaped completion, which is what every non-Anthropic provider sends. */
function openAiReply(usage: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: "m",
      choices: [{ message: { content: "hi" } }],
      usage,
    }),
    text: async () => "",
  };
}

const SNAKE = { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe("callLLM reports usage in the shape its own type declares", () => {
  it("normalises the gateway's snake_case into camelCase", async () => {
    // The gateway path. `usage: data.usage` handed the raw provider object
    // straight into a field declared camelCase, and `any` at the JSON boundary
    // meant nothing objected.
    global.fetch = jest.fn(async () => openAiReply(SNAKE)) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const res = await callLLM([{ role: "user", content: "q" }], {});

    expect(res.usage).toEqual({ promptTokens: 20, completionTokens: 30, totalTokens: 50 });
  });

  it("derives a missing total rather than leaving it undefined", async () => {
    global.fetch = jest.fn(async () =>
      openAiReply({ prompt_tokens: 7, completion_tokens: 5 }),
    ) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const res = await callLLM([{ role: "user", content: "q" }], {});

    expect(res.usage).toEqual({ promptTokens: 7, completionTokens: 5, totalTokens: 12 });
  });

  it("accepts the Anthropic wire shape too", async () => {
    // input_tokens/output_tokens. One normaliser has to cover both vocabularies,
    // because HermesRuntime's mapUsage already proves both reach this codebase.
    global.fetch = jest.fn(async () =>
      openAiReply({ input_tokens: 11, output_tokens: 4 }),
    ) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const res = await callLLM([{ role: "user", content: "q" }], {});

    expect(res.usage).toEqual({ promptTokens: 11, completionTokens: 4, totalTokens: 15 });
  });

  it("reports nothing for an object that carries no counts", async () => {
    // Found by mutation: the absent-usage control below passes `undefined`,
    // which the type check catches first, so it never exercised this branch.
    // A total with no input or output is not enough to price a run, and
    // reporting {0, 0, n} would be a fabrication dressed as a measurement.
    global.fetch = jest.fn(async () =>
      openAiReply({ total_tokens: 5 }),
    ) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    expect((await callLLM([{ role: "user", content: "q" }], {})).usage).toBeUndefined();
  });

  it("believes the provider's own total over the sum", async () => {
    // Also found by mutation: every other case here has total === sum, so
    // nothing pinned which one wins. It matters because some providers bill for
    // tokens neither counter covers, such as cached reads and reasoning tokens.
    global.fetch = jest.fn(async () =>
      openAiReply({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 99 }),
    ) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const res = await callLLM([{ role: "user", content: "q" }], {});

    expect(res.usage?.totalTokens).toBe(99);
  });

  it("reports nothing when the provider reported nothing", async () => {
    // GREEN CONTROL, and load-bearing: it stops the fix being "always emit
    // zeroes", which would turn an honest absence into a measured $0.00. That
    // distinction is the whole point of the unmeasured discipline.
    global.fetch = jest.fn(async () => openAiReply(undefined)) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const res = await callLLM([{ role: "user", content: "q" }], {});

    expect(res.usage).toBeUndefined();
  });
});

describe("a research run's tokens survive the whole trip", () => {
  it("accumulates what the provider actually sent", async () => {
    // The seam, end to end: a real callLLM response feeding the real
    // accumulator. Neither side is faked. This is what none of the three
    // existing research-usage tests do -- each stops one module short of the
    // strip between resp.json() and defaultLlm, which is the only code that has
    // ever been wrong.
    global.fetch = jest.fn(async () => openAiReply(SNAKE)) as unknown as typeof fetch;

    const { callLLM } = await import("@/lib/llm");
    const { accumulateUsage } = await import("@/lib/laboratory/deep-research/usage");

    const a = await callLLM([{ role: "user", content: "q" }], {});
    const b = await callLLM([{ role: "user", content: "q" }], {});

    expect(accumulateUsage([a.usage, b.usage])).toEqual({
      promptTokens: 40,
      completionTokens: 60,
      totalTokens: 100,
    });
  });

  it("still returns null when no call reported anything", async () => {
    const { accumulateUsage } = await import("@/lib/laboratory/deep-research/usage");
    expect(accumulateUsage([undefined, undefined])).toBeNull();
  });
});
