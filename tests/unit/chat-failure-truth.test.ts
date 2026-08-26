/**
 * @jest-environment node
 *
 * T-0040 acceptance oracle — a failed chat turn must say what actually happened.
 *
 * The operator's live QA pass with the gateway down: a message sat on
 * "Thinking…" for ~35s and resolved to the bare string "run failed", above two
 * tool rows reading "skill_view done" and "terminal done". Every part of that
 * sentence is a separate defect, and this file is the executable statement of
 * what each of them must do instead. Written before the implementation exists,
 * and RED against dev@841ebd9c.
 *
 * 1. THE EVENT-NAME COLLISION. "error" is a name EventSource owns. The browser
 *    fires a built-in event of that exact type when the transport dies, and that
 *    event is a plain Event: no `data`. So an SSE frame sent under the name
 *    "error" and a dropped socket are indistinguishable at the listener, which
 *    is why `JSON.parse(undefined)` threw, `extractRunError` fell through to its
 *    literal fallback, and the run-level handler latched `finalized` before the
 *    transport handler could reconcile. The run-level failure must therefore
 *    travel under a name the transport cannot forge: "run.error".
 *
 * 2. THE HIDDEN CAUSE. undici throws `TypeError: fetch failed` and puts the fact
 *    worth reading one level down, in `cause`. A message-only reading of the
 *    error discards the only sentence a user can act on.
 *
 * 3. THE TOOL ROWS. Status came from the event NAME alone, so a payload that
 *    reported its own error still rendered as "done"; and a run that ended
 *    failed persisted its rows untouched, so anything still "invoked" kept
 *    spinning for as long as the transcript was open.
 *
 * The hook-level halves of (1) and (3) live in chat-failure-truth-streams.test.tsx,
 * which needs a DOM.
 */

import { NextRequest } from "next/server";

import {
  classifyRunEvent,
  openRunEventStream,
  parseToolEvent,
  reframeToolsForFailedRun,
} from "@/lib/chat-utils";
import { API_FETCH_TIMEOUT_MS, apiFetch, errorChain, messageFromError } from "@/lib/api-fetch";
import type { ToolCall } from "@/types/chat";

// ── The run-event proxy ─────────────────────────────────────────

const streamRunEvents = jest.fn();
const getRun = jest.fn();

jest.mock("@/lib/runtime", () => ({
  runtime: { streamRunEvents: (...args: unknown[]) => streamRunEvents(...args) },
}));
jest.mock("@/lib/runs-repository", () => ({
  getRun: (...args: unknown[]) => getRun(...args),
}));

// ── The messages route ──────────────────────────────────────────

const dispatchChatTurn = jest.fn();

jest.mock("@/lib/chat-repository", () => ({
  getConversation: jest.fn(() => ({ id: "conv-1" })),
}));
jest.mock("@/lib/orchestration/chat-dispatch", () => ({
  dispatchChatTurn: (...args: unknown[]) => dispatchChatTurn(...args),
  appendFastTurn: jest.fn(),
}));

/** Exactly the shape undici produces when nothing is listening on the port. */
function gatewayDown(): TypeError {
  const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8642"), {
    code: "ECONNREFUSED",
  });
  return new TypeError("fetch failed", { cause });
}

async function eventStreamBody(): Promise<string> {
  const { GET } = await import("@/app/api/runs/[id]/events/route");
  const res = await GET(null as unknown as NextRequest, {
    params: Promise.resolve({ id: "ps-run-1" }),
  });
  return await res.text();
}

beforeEach(() => {
  streamRunEvents.mockReset();
  getRun.mockReset();
  dispatchChatTurn.mockReset();
  getRun.mockReturnValue({ id: "ps-run-1", runId: "backend-1", profileName: null });
});

describe("the run-event proxy does not send anything under EventSource's own error name", () => {
  it("emits the run-level failure as run.error, never as error", async () => {
    streamRunEvents.mockImplementation(async function* () {
      throw gatewayDown();
    });

    const body = await eventStreamBody();

    expect(body).toMatch(/^event: run\.error$/m);
    // The collision itself: a frame named "error" is what the browser also
    // fires on a dropped socket, so this name must never leave the proxy.
    expect(body).not.toMatch(/^event: error$/m);
  });

  it("says what actually happened, cause and all, not just 'fetch failed'", async () => {
    streamRunEvents.mockImplementation(async function* () {
      throw gatewayDown();
    });

    const body = await eventStreamBody();

    expect(body).toContain("fetch failed");
    expect(body).toContain("connect ECONNREFUSED 127.0.0.1:8642");
  });

  it("renames a backend event that is itself called error, for the same reason", async () => {
    streamRunEvents.mockImplementation(async function* () {
      yield { type: "error", data: { message: "the backend rejected the run" } };
    });

    const body = await eventStreamBody();

    expect(body).not.toMatch(/^event: error$/m);
    expect(body).toMatch(/^event: run\.error$/m);
    expect(body).toContain("the backend rejected the run");
  });

  it("still passes ordinary events through under their own names", async () => {
    streamRunEvents.mockImplementation(async function* () {
      yield { type: "message.delta", data: { delta: "hi" } };
      yield { type: "run.completed", data: { output: "hi" } };
    });

    const body = await eventStreamBody();

    expect(body).toMatch(/^event: message\.delta$/m);
    expect(body).toMatch(/^event: run\.completed$/m);
    expect(body).toMatch(/^event: done$/m);
  });
});

describe("the chat client agrees with the proxy about the name", () => {
  it("classifies run.error as a run failure", () => {
    expect(classifyRunEvent("run.error")).toBe("failed");
  });

  it("no longer treats a bare 'error' as a run failure", () => {
    // This is the whole bug. EventSource fires "error" on transport failure, so
    // reading that name as "the run failed" turns every dropped socket into a
    // fabricated run failure AND latches the terminal state before the
    // transport handler can reconcile from the server.
    expect(classifyRunEvent("error")).toBe("ignore");
  });

  it("does not subscribe to 'error', which would shadow the transport event", () => {
    const listened: string[] = [];
    class ProbeEventSource {
      onerror: ((e: Event) => void) | null = null;
      constructor(readonly url: string) {}
      addEventListener(type: string) {
        listened.push(type);
      }
      close() {}
    }
    const original = (globalThis as unknown as { EventSource?: unknown }).EventSource;
    (globalThis as unknown as { EventSource: unknown }).EventSource = ProbeEventSource;
    try {
      openRunEventStream("ps-run-1", () => {});
    } finally {
      (globalThis as unknown as { EventSource?: unknown }).EventSource = original;
    }

    expect(listened).toContain("run.error");
    expect(listened).not.toContain("error");
  });
});

describe("an error's cause is part of what happened", () => {
  it("appends undici's hidden cause to the message", () => {
    expect(messageFromError(gatewayDown(), "Request failed")).toBe(
      "fetch failed: connect ECONNREFUSED 127.0.0.1:8642",
    );
  });

  it("does not repeat a cause the outer message already quotes", () => {
    const cause = new Error("ECONNREFUSED");
    const outer = new Error("Hindsight POST /v1/foo: ECONNREFUSED", { cause });
    expect(messageFromError(outer, "fallback")).toBe("Hindsight POST /v1/foo: ECONNREFUSED");
  });

  it("survives a self-referential cause", () => {
    const a = new Error("a");
    Object.assign(a, { cause: a });
    expect(messageFromError(a, "fallback")).toBe("a");
  });

  it("keeps every contract the message-only version had", () => {
    expect(messageFromError(new Error("boom"), "fallback")).toBe("boom");
    expect(messageFromError(new Error(""), "fallback")).toBe("fallback");
    expect(messageFromError("plain string", "fallback")).toBe("plain string");
    expect(messageFromError(42, "fallback")).toBe("42");
  });

  it("exposes ONE cause walker, and it ends at a non-Error the way Hindsight's does", () => {
    // Hindsight's isHindsightConnectionError is pinned on `("fetch failed")`
    // being false: a bare string is not an error chain. A shared helper has to
    // hold that line, or the two readings drift apart again.
    expect(errorChain("fetch failed")).toEqual([]);
    expect(errorChain(null)).toEqual([]);
    expect(errorChain(gatewayDown()).map((e) => e.message)).toEqual([
      "fetch failed",
      "connect ECONNREFUSED 127.0.0.1:8642",
    ]);
  });
});

describe("tool rows tell the truth about the run they sit in", () => {
  it("reads the payload, not just the event name, when the payload reports an error", () => {
    expect(parseToolEvent("tool.completed", { name: "terminal", error: "exit status 1" }).status)
      .toBe("failed");
  });

  it("sees an error reported one level down, inside the result envelope", () => {
    expect(
      parseToolEvent("tool.completed", {
        name: "skill_view",
        result: { ok: false, error: "skill not found" },
      }).status,
    ).toBe("failed");
  });

  it("does not invent a failure where the payload reports success", () => {
    expect(parseToolEvent("tool.completed", { name: "search", result: { ok: true } }).status).toBe(
      "completed",
    );
    expect(parseToolEvent("tool.completed", { name: "search", result: "3 hits" }).status).toBe(
      "completed",
    );
    expect(parseToolEvent("tool.invoked", { name: "search" }).status).toBe("invoked");
    expect(parseToolEvent("tool.approval_required", { name: "rm" }).status).toBe(
      "approval_required",
    );
  });

  it("stops an unfinished row reading as in-flight once the run is dead", () => {
    const rows: ToolCall[] = [
      { name: "skill_view", status: "completed" },
      { name: "terminal", status: "invoked" },
      { name: "rm", status: "approval_required" },
    ];
    expect(reframeToolsForFailedRun(rows)).toEqual([
      { name: "skill_view", status: "completed" },
      { name: "terminal", status: "failed" },
      { name: "rm", status: "failed" },
    ]);
  });

  it("leaves a settled list exactly as it found it", () => {
    const settled: ToolCall[] = [
      { name: "a", status: "completed" },
      { name: "b", status: "failed" },
    ];
    expect(reframeToolsForFailedRun(settled)).toBe(settled);
    expect(reframeToolsForFailedRun([])).toEqual([]);
  });
});

describe("the browser stops waiting before the user does", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("waits longer than the server's own 30s runtime deadline, so the server's error wins", () => {
    // HermesRuntime.DEFAULT_TIMEOUT_MS is 30_000. A client deadline at or under
    // that races the server and replaces a real diagnosis with a timeout.
    expect(API_FETCH_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("passes a signal when the caller gave none", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("/api/chat/conv-1/messages", { method: "POST" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never overrides a signal the caller is already using to cancel", async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch("/api/monitor", { signal: controller.signal });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });
});

describe("POST /api/chat/[id]/messages keeps the promise its comment makes", () => {
  async function post(): Promise<{ status: number; body: Record<string, unknown> }> {
    const { POST } = await import("@/app/api/chat/[id]/messages/route");
    const request = {
      json: async () => ({ content: "hello" }),
    } as unknown as NextRequest;
    const res = await POST(request, { params: Promise.resolve({ id: "conv-1" }) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("surfaces the ids it says it surfaces on the failure branch", async () => {
    dispatchChatTurn.mockResolvedValue({
      ok: false,
      error: "fetch failed: connect ECONNREFUSED 127.0.0.1:8642",
      runId: "ps-run-1",
      userMessageId: "msg-user-1",
      assistantMessageId: "msg-assistant-1",
    });

    const { status, body } = await post();

    expect(status).toBe(503);
    expect(body.error).toBe("fetch failed: connect ECONNREFUSED 127.0.0.1:8642");
    expect(body.userMessageId).toBe("msg-user-1");
    expect(body.assistantMessageId).toBe("msg-assistant-1");
  });

  it("still returns the ids on the success branch", async () => {
    dispatchChatTurn.mockResolvedValue({
      ok: true,
      runId: "ps-run-1",
      userMessageId: "msg-user-1",
      assistantMessageId: "msg-assistant-1",
    });

    const { status, body } = await post();

    expect(status).toBe(200);
    expect(body.data).toEqual({
      runId: "ps-run-1",
      userMessageId: "msg-user-1",
      assistantMessageId: "msg-assistant-1",
    });
  });
});
