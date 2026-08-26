/** @jest-environment jsdom */
/**
 * T-0046 acceptance oracle — the SAME collision T-0040 fixed, on the two
 * streams T-0040 did not reach.
 *
 * T-0040 renamed the chat run-failure event `error` -> `run.error` because
 * EventSource fires its own transport-failure event under the name `error`, so
 * a server frame sharing that name is indistinguishable from a dropped socket.
 * `src/lib/sse/event-stream.ts` still emits `event: error`, and its only
 * consumer collapses both meanings into `es.onerror = () => setConnected(false)`.
 *
 * That server frame is not noise. It is emitted when `snapshot()` THROWS —
 * the authoritative read failed — and it carries a diagnosis the operator never
 * sees. It reaches the composer run view and the laboratory research view.
 *
 * This is the CONSUMER half; the producer half is the node-environment
 * sibling stream-error-truth-producer.test.ts (jsdom has no ReadableStream).
 *
 * Red against dev@67c6b112 for the original reason: the hook has nowhere to
 * put a server diagnosis at all.
 */

import { act, renderHook } from "@testing-library/react";

import { useEventStream } from "@/hooks/useEventStream";

// ── consumer ────────────────────────────────────────────────────

type Listener = (e: MessageEvent) => void;

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onerror: ((e: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  closes = 0;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeEventSource.last = this;
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
  open() {
    act(() => this.onopen?.());
  }
  emit(type: string, data: unknown) {
    act(() => {
      for (const fn of this.listeners.get(type) ?? []) {
        fn({ data: JSON.stringify(data) } as MessageEvent);
      }
    });
  }
  /**
   * The transport dying. A real EventSource dispatches a plain Event of type
   * "error" with NO `data`, to both onerror and any listener under that name.
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
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
});

describe("useEventStream tells a failed read apart from a dropped socket", () => {
  it("surfaces the server's diagnosis when the snapshot read failed", () => {
    const { result } = renderHook(() => useEventStream<{ x: number }>("/api/x/events"));
    FakeEventSource.last!.open();
    FakeEventSource.last!.emit("stream.error", { error: "snapshot failed" });
    expect(result.current.error).toBe("snapshot failed");
  });

  it("reports a dropped socket as disconnected, with NO fabricated server message", () => {
    const { result } = renderHook(() => useEventStream<{ x: number }>("/api/x/events"));
    FakeEventSource.last!.open();
    expect(result.current.connected).toBe(true);
    FakeEventSource.last!.fail();
    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the last good snapshot on screen when the read later fails", () => {
    const { result } = renderHook(() => useEventStream<{ x: number }>("/api/x/events"));
    FakeEventSource.last!.open();
    FakeEventSource.last!.emit("state", { x: 7 });
    FakeEventSource.last!.emit("stream.error", { error: "db locked" });
    expect(result.current.data).toEqual({ x: 7 });
    expect(result.current.error).toBe("db locked");
  });

  it("clears a stale error when the url changes", () => {
    const { result, rerender } = renderHook(({ u }) => useEventStream<{ x: number }>(u), {
      initialProps: { u: "/api/a/events" },
    });
    FakeEventSource.last!.emit("stream.error", { error: "db locked" });
    expect(result.current.error).toBe("db locked");
    rerender({ u: "/api/b/events" });
    expect(result.current.error).toBeNull();
  });
});
