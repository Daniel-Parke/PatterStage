/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group spend-plumbing, part three: Story Weaver's money leaves a
// trace (D87, blocker), and a Stop reaches the provider (D88, blocker).
// Contract sections 2.2, 2.3, 2.6 and 3.3.
//
// THE DEFECT. `callLLM` is the whole of Story Weaver's inference, and it takes
// the gateway path with model "hermes" and no modelId (llm.ts:144-156). It
// creates no `runs` row, records no `usage_json`, and hands the caller no way
// to abort: the AbortController inside callDirectProvider/callGateway is the
// timeout's, and nothing else can reach it. So a chapter costs money nothing
// records, and once it is in flight it cannot be stopped.
//
// THE CONTRACT.
//   - `LLMOptions.spend` records the call's reported usage as a completed
//     `runs` row through `createSpendRun`, in the {inputTokens, outputTokens,
//     totalTokens} vocabulary the spend read parses.
//   - A provider that reported NO usage writes NO row. NULL is not zero.
//   - `LLMOptions.signal` is linked to the provider fetch, so the reader's
//     Stop aborts the call in flight rather than detaching from it.
//
// The callers' half of the bargain -- every story handler passing
// `spend: { source: "story", storyId }`, the chosen `modelId` and the
// request's `signal` -- is held by b14-story-handlers-pass-spend.test.ts.
//
// The doubles are the model registry, the runs repository and global fetch.
// The resolution logic and the usage normaliser are real.
// ═══════════════════════════════════════════════════════════════

const createSpendRun = jest.fn();
jest.mock("@/lib/runs-repository", () => ({
  createSpendRun: (...args: unknown[]) => createSpendRun(...args),
  createRun: jest.fn(),
  getRun: jest.fn(),
  updateRun: jest.fn(),
}));

const getModelWithKey = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  getModelWithKey: (id: string) => getModelWithKey(id),
}));

jest.mock("@/lib/runtime/gateway", () => ({
  getAgentGateway: () => ({ baseUrl: "http://gw.test", chatCompletionsUrl: "http://gw.test/v1/chat/completions" }),
}));
jest.mock("@/lib/runtime/secrets", () => ({ getGatewayKey: () => null }));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
}));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { callLLM, type LLMOptions } from "@/lib/llm";

// ── pre-B14 type shim: the two options the contract adds ────────
type B14Options = LLMOptions & {
  spend?: { source: string; storyId?: string | null };
  signal?: AbortSignal;
};
const opts = (o: B14Options): LLMOptions => o as LLMOptions;

// ── the provider double ─────────────────────────────────────────

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();

function answers(usage: Record<string, number> | null): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      model: "gpt-4o-mini",
      choices: [{ message: { content: "Once upon a time." } }],
      ...(usage ? { usage } : {}),
    }),
    text: async () => "",
  });
}

/** A registry model with a base URL and a key, so callLLM takes the direct path. */
function registryModel(): void {
  getModelWithKey.mockReturnValue({
    id: "m-1",
    name: "Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    baseUrl: "https://api.openai.test/v1",
    apiKey: "sk-test",
    apiStyle: "openai",
    contextLength: null,
    credentialsId: "c-1",
    createdAt: "",
    updatedAt: "",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  registryModel();
  answers({ prompt_tokens: 1200, completion_tokens: 800, total_tokens: 2000 });
});

// ═══════════════════════════════════════════════════════════════
// (A) callLLM records what it spent
// ═══════════════════════════════════════════════════════════════

describe("callLLM records a spend run when the caller names a source", () => {
  it("writes one completed run in the vocabulary the spend read parses", async () => {
    await callLLM([{ role: "user", content: "write" }], opts({
      modelId: "m-1",
      spend: { source: "story", storyId: "S-1" },
    }));

    expect(createSpendRun).toHaveBeenCalledTimes(1);
    expect(createSpendRun).toHaveBeenCalledWith({
      source: "story",
      storyId: "S-1",
      // inputTokens / outputTokens, NOT promptTokens: foldUsage and the guard
      // both JSON.parse `usage_json` and read those two names (T-0068's lesson).
      usage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 },
    });
  });

  it("records nothing when no source was named", async () => {
    await callLLM([{ role: "user", content: "write" }], { modelId: "m-1" });
    expect(createSpendRun).not.toHaveBeenCalled();
  });

  it("records nothing when the provider reported no usage: NULL is not zero", async () => {
    answers(null);
    await callLLM([{ role: "user", content: "write" }], opts({
      modelId: "m-1",
      spend: { source: "story", storyId: "S-1" },
    }));
    expect(createSpendRun).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the caller's Stop reaches the provider
// ═══════════════════════════════════════════════════════════════

describe("callLLM honours the caller's abort signal", () => {
  it("aborts the provider fetch when the caller's controller aborts", async () => {
    const controller = new AbortController();
    let passed: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_url, init) => {
      passed = init?.signal ?? undefined;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ choices: [{ message: { content: "x" } }] }),
        text: async () => "",
      };
    });

    await callLLM([{ role: "user", content: "write" }], opts({ modelId: "m-1", signal: controller.signal }));

    expect(passed).toBeDefined();
    expect(passed!.aborted).toBe(false);
    controller.abort();
    // The call's own signal follows the caller's, so a Stop cancels the request
    // in flight instead of leaving the provider to finish and bill for it.
    expect(passed!.aborted).toBe(true);
  });

  it("a signal already aborted stops the call before it is made", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      callLLM([{ role: "user", content: "write" }], opts({ modelId: "m-1", signal: controller.signal })),
    ).rejects.toBeDefined();
  });
});
