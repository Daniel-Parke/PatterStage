/** @jest-environment node */

// T0194 independent Faraday oracle, 2026-10-04. All requests are synthetic.
import { getEventListeners } from "node:events";
import { callLLM, type LLMResponse } from "@/lib/models/llm";

jest.mock("@/lib/models/models-repository", () => ({ getModelWithKey: () => null }));
jest.mock("@/lib/runtime/gateway", () => ({ getAgentGateway: () => ({
  baseUrl: "http://oracle.invalid", chatCompletionsUrl: "http://oracle.invalid/v1/chat/completions",
}) }));
jest.mock("@/lib/runtime/secrets", () => ({ getGatewayKey: () => null }));
jest.mock("@/lib/runs/runs-repository", () => ({ createSpendRun: jest.fn() }));

const originalFetch = global.fetch;
const waits = [
  { kind: "429", first: 30_000, second: 60_000 },
  { kind: "empty", first: 5_000, second: 10_000 },
  { kind: "timeout", first: 3_000, second: 6_000 },
  { kind: "ordinary error", first: 3_000, second: 6_000 },
] as const;
type Kind = typeof waits[number]["kind"];

function response(content: string): Response {
  return { ok: true, status: 200, json: async () => ({
    choices: [{ message: { content } }], model: "oracle-model",
    usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  }) } as Response;
}
function provider(kind: Kind, recover = false) {
  const timeout = Object.assign(new Error("Synthetic provider timeout"), { name: "AbortError" });
  const chat = jest.fn(async (_url: string, init: RequestInit): Promise<Response> => {
    if (init.signal?.aborted) throw Object.assign(new Error("Synthetic transport aborted"), { name: "AbortError" });
    if (recover && chat.mock.calls.length === 3) return response("Recovered output");
    if (kind === "429") return { ok: false, status: 429 } as Response;
    if (kind === "empty") return response(" ");
    if (kind === "timeout") throw timeout;
    throw new Error("Synthetic ordinary transport failure");
  });
  global.fetch = jest.fn((url: string, init: RequestInit) => String(url).endsWith("/health")
    ? Promise.resolve({ ok: true, status: 200 } as Response) : chat(url, init)) as typeof fetch;
  return { chat, timeout };
}
function start(signal?: AbortSignal) {
  const state: { status: "pending" | "resolved" | "rejected"; value?: LLMResponse | Error } = { status: "pending" };
  const completion = callLLM([{ role: "user", content: "Synthetic held retry" }], { signal }).then(
    value => { state.status = "resolved"; state.value = value; },
    (error: Error) => { state.status = "rejected"; state.value = error; },
  );
  return { state, completion };
}

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  // Drain the original defective wait after a red matcher, never await it in
  // the Stop assertion. This retains real delay semantics without a test timeout.
  await jest.runAllTimersAsync();
  jest.useRealTimers();
  global.fetch = originalFetch;
});

describe("T0194 gateway retry Stop ownership", () => {
  it.each(waits)("Stop during held $kind wait rejects promptly without another provider attempt", async ({ kind, first }) => {
    const { chat } = provider(kind);
    const caller = new AbortController();
    const reason = new Error("Private synthetic caller reason");
    const { state, completion } = start(caller.signal);
    await jest.advanceTimersByTimeAsync(0);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("pending");
    await jest.advanceTimersByTimeAsync(first - 1);
    expect(chat).toHaveBeenCalledTimes(1);
    caller.abort(reason);
    await jest.advanceTimersByTimeAsync(0);
    expect(state.status).toBe("rejected");
    expect(state.value).toBeInstanceOf(Error);
    expect(state.value).toMatchObject({ name: "AbortError", message: expect.stringMatching(/stopp?ed/i) });
    expect(state.value).not.toBe(reason);
    expect((state.value as Error).message).not.toMatch(/Private synthetic|timed out/i);
    expect(jest.getTimerCount()).toBe(0);
    expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(600_000);
    await completion;
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it.each(waits)("CONTROL $kind preserves both held delays and exactly three attempts", async ({ kind, first, second }) => {
    const { chat, timeout } = provider(kind, kind !== "timeout");
    const { state, completion } = start();
    await jest.advanceTimersByTimeAsync(0);
    expect(chat).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(first - 1);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("pending");
    await jest.advanceTimersByTimeAsync(1);
    expect(chat).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(second - 1);
    expect(chat).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await completion;
    expect(chat).toHaveBeenCalledTimes(3);
    if (kind === "timeout") {
      expect(state.status).toBe("rejected");
      expect(state.value).toBe(timeout);
      expect((state.value as Error).message).toMatch(/provider timeout/i);
      expect((state.value as Error).message).not.toMatch(/stopped/i);
    } else {
      expect(state.status).toBe("resolved");
      expect(state.value).toMatchObject({ content: "Recovered output", model: "oracle-model",
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } });
    }
    expect(jest.getTimerCount()).toBe(0);
  });

  it("CONTROL ordinary gateway success retains output usage and clears its timers", async () => {
    const fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValueOnce(response("Ordinary output"));
    global.fetch = fetch as typeof global.fetch;
    const caller = new AbortController();
    await expect(callLLM([{ role: "user", content: "Synthetic success" }], { signal: caller.signal })).resolves.toMatchObject({
      content: "Ordinary output", model: "oracle-model", usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
    expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
  });

  it("Terminal gateway error retains failure classification and releases caller links after all attempts", async () => {
    const { chat } = provider("ordinary error");
    const caller = new AbortController();
    const { state, completion } = start(caller.signal);
    await jest.runAllTimersAsync();
    await completion;
    expect(chat).toHaveBeenCalledTimes(3);
    expect(state.status).toBe("rejected");
    expect(state.value).toMatchObject({ name: "Error", message: "Synthetic ordinary transport failure" });
    expect(caller.signal.aborted).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
  });
});
