/** @jest-environment jsdom */
/**
 * T-0040 acceptance oracle, hook half — what the two run-event consumers do when
 * the socket dies as opposed to when the run does.
 *
 * These are different facts and the product already knows it: useAgentRunStream
 * carries a comment explaining that a dropped socket means the run may still be
 * completing, so it reconciles from the server rather than guessing; and
 * useRunProgress carries a comment explaining that "the stream dropped" must not
 * render as "the run failed". Both of those paths were DEAD CODE, because both
 * hooks also subscribed to an event named "error" — the same name EventSource
 * fires on transport failure — and that listener ran first and latched the
 * terminal state.
 *
 * FakeEventSource below models the browser faithfully on exactly that point:
 * `fail()` dispatches a plain Event of type "error" (no `data`) to any listener
 * registered under that name AND to `onerror`, which is what a real EventSource
 * does. If the collision is still there, the listener wins and these go red.
 */

import { act, renderHook } from "@testing-library/react";

import { useAgentRunStream } from "@/hooks/useAgentRunStream";
import { useRunProgress } from "@/hooks/useRunProgress";
import type { ChatMessage, ToolCall } from "@/types/chat";

const finalizeMessageApi = jest.fn(async () => {});

jest.mock("@/lib/chat-utils", () => ({
  ...jest.requireActual("@/lib/chat-utils"),
  finalizeMessageApi: (...args: unknown[]) => finalizeMessageApi(...(args as [])),
}));

type Listener = (e: MessageEvent) => void;

class FakeEventSource {
  static last: FakeEventSource | null = null;
  static opened: string[] = [];

  onerror: ((e: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  closes = 0;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeEventSource.last = this;
    FakeEventSource.opened.push(url);
  }

  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }

  close() {
    this.closes += 1;
  }

  /** A named frame from the server, framed the way the proxy frames it. */
  emit(type: string, data: unknown) {
    act(() => {
      for (const fn of this.listeners.get(type) ?? []) {
        fn({ data: JSON.stringify(data) } as MessageEvent);
      }
    });
  }

  /**
   * The transport dying. A real EventSource dispatches a plain Event of type
   * "error" here: no `data`, no server payload, and both `onerror` and any
   * addEventListener("error", …) handler see it.
   */
  fail() {
    act(() => {
      const e = { type: "error" } as unknown as MessageEvent;
      for (const fn of this.listeners.get("error") ?? []) fn(e);
      this.onerror?.(e as unknown as Event);
    });
  }
}

beforeEach(() => {
  FakeEventSource.last = null;
  FakeEventSource.opened = [];
  finalizeMessageApi.mockClear();
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
});

// ── useAgentRunStream ───────────────────────────────────────────

function mountAgentStream() {
  const updateLocalMessage = jest.fn<void, [string, Partial<ChatMessage>]>();
  const refreshActiveConversation = jest.fn(async () => {});
  const loadConversations = jest.fn(async () => {});
  const setIsStreaming = jest.fn();
  const setPendingApproval = jest.fn();
  const esRef = { current: null as EventSource | null };
  const streamGenRef = { current: 1 };

  const { result } = renderHook(() =>
    useAgentRunStream({
      esRef,
      streamGenRef,
      updateLocalMessage,
      setIsStreaming,
      setPendingApproval,
      loadConversations,
      refreshActiveConversation,
    }),
  );

  act(() => {
    result.current.streamAgentRun("conv-1", "ps-run-1", "msg-assistant-1", 1);
  });

  return {
    es: FakeEventSource.last as FakeEventSource,
    updateLocalMessage,
    refreshActiveConversation,
    setIsStreaming,
  };
}

/** The last patch this hook wrote onto the assistant message. */
function lastPatch(fn: jest.Mock): Partial<ChatMessage> | undefined {
  const calls = fn.mock.calls as [string, Partial<ChatMessage>][];
  return calls.length > 0 ? calls[calls.length - 1][1] : undefined;
}

describe("useAgentRunStream separates a dropped socket from a failed run", () => {
  it("does not fabricate 'run failed' when the transport dies", () => {
    jest.useFakeTimers();
    try {
      const { es, updateLocalMessage } = mountAgentStream();

      es.fail();

      const patches = (updateLocalMessage.mock.calls as [string, Partial<ChatMessage>][]).map(
        (c) => c[1],
      );
      expect(patches.some((p) => p.status === "failed")).toBe(false);
      expect(patches.some((p) => p.error === "run failed")).toBe(false);
      // Nothing was persisted either: there is no fact to persist yet.
      expect(finalizeMessageApi).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("reconciles from the server instead, which is what the comment promised", () => {
    jest.useFakeTimers();
    try {
      const { es, refreshActiveConversation, setIsStreaming } = mountAgentStream();

      es.fail();
      expect(setIsStreaming).toHaveBeenCalledWith(false);

      act(() => {
        jest.advanceTimersByTime(1600);
      });
      expect(refreshActiveConversation).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("finalizes on a real run.error, carrying the server's own words", () => {
    const { es, updateLocalMessage } = mountAgentStream();

    es.emit("run.error", {
      message: "fetch failed: connect ECONNREFUSED 127.0.0.1:8642",
    });

    expect(lastPatch(updateLocalMessage)).toMatchObject({
      status: "failed",
      error: "fetch failed: connect ECONNREFUSED 127.0.0.1:8642",
    });
  });

  it("stops the tool rows spinning when the run dies under them", () => {
    const { es, updateLocalMessage } = mountAgentStream();

    es.emit("tool.invoked", { name: "skill_view" });
    es.emit("tool.completed", { name: "skill_view", result: { ok: true } });
    es.emit("tool.invoked", { name: "terminal" });
    es.emit("run.error", { message: "backend unreachable" });

    const patch = lastPatch(updateLocalMessage);
    expect(patch?.status).toBe("failed");
    expect(patch?.toolCalls).toEqual([
      { name: "skill_view", status: "completed", result: { ok: true } },
      { name: "terminal", status: "failed" },
    ]);
    // And the same reframed rows are what gets persisted, not the raw accumulator.
    const persisted = finalizeMessageApi.mock.calls[0] as unknown as [
      string,
      string,
      { toolCalls?: ToolCall[]; status?: string },
    ];
    expect(persisted[2].toolCalls).toEqual([
      { name: "skill_view", status: "completed", result: { ok: true } },
      { name: "terminal", status: "failed" },
    ]);
  });
});

// ── useRunProgress ──────────────────────────────────────────────

describe("useRunProgress separates a dropped socket from a failed run", () => {
  it("says the stream dropped, not that the run failed", () => {
    const { result } = renderHook(() => useRunProgress("ps-run-1"));

    (FakeEventSource.last as FakeEventSource).fail();

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("event stream disconnected");
    expect(result.current.error).not.toBe("run failed");
  });

  it("reports a real run.error with the message the server sent", () => {
    const { result } = renderHook(() => useRunProgress("ps-run-1"));

    (FakeEventSource.last as FakeEventSource).emit("run.error", {
      message: "fetch failed: connect ECONNREFUSED 127.0.0.1:8642",
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("fetch failed: connect ECONNREFUSED 127.0.0.1:8642");
  });

  it("still streams deltas and settles on run.completed", () => {
    const { result } = renderHook(() => useRunProgress("ps-run-1"));
    const es = FakeEventSource.last as FakeEventSource;

    es.emit("message.delta", { delta: "par" });
    es.emit("message.delta", { delta: "tial" });
    es.emit("run.completed", { output: "ignored, deltas won" });

    expect(result.current.text).toBe("partial");
    expect(result.current.status).toBe("done");
  });
});
