/** @jest-environment jsdom */
/**
 * Regression: useEventStream kept the PREVIOUS subscription's payload until the
 * new stream pushed its first frame.
 *
 * The Composer page prefers the stream over its fetched copy
 * (`live?.run ?? detail?.run`), and the HIL Accept button posts to
 * `/api/composer/runs/${run.id}/nodes/${run.currentNodeId}/approve`. So in the
 * window after selecting a different run, clicking Accept approved a node on
 * the run you had just navigated away from.
 */
import { renderHook, act } from "@testing-library/react";

import { useEventStream } from "@/hooks/useEventStream";

type StateListener = (e: MessageEvent) => void;

let listener: StateListener | undefined;
let opened: string[] = [];
let closed = 0;

class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    opened.push(url);
  }
  addEventListener(type: string, fn: StateListener) {
    if (type === "state") listener = fn;
  }
  close() {
    closed += 1;
  }
}

beforeEach(() => {
  listener = undefined;
  opened = [];
  closed = 0;
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
});

function pushState(payload: unknown) {
  act(() => {
    listener?.({ data: JSON.stringify(payload) } as MessageEvent);
  });
}

describe("useEventStream", () => {
  it("clears the payload when the subscribed url changes", () => {
    const { result, rerender } = renderHook(({ url }) => useEventStream<{ id: string }>(url), {
      initialProps: { url: "/api/composer/runs/AAA/events" },
    });

    pushState({ id: "AAA" });
    expect(result.current.data).toEqual({ id: "AAA" });

    // Select a different run. Before the fix this still read { id: "AAA" }.
    rerender({ url: "/api/composer/runs/BBB/events" });
    expect(result.current.data).toBeNull();
    expect(opened).toEqual([
      "/api/composer/runs/AAA/events",
      "/api/composer/runs/BBB/events",
    ]);
    expect(closed).toBe(1);

    pushState({ id: "BBB" });
    expect(result.current.data).toEqual({ id: "BBB" });
  });

  it("clears the payload when the url becomes null", () => {
    const { result, rerender } = renderHook(
      ({ url }) => useEventStream<{ id: string }>(url),
      { initialProps: { url: "/api/composer/runs/AAA/events" as string | null } },
    );

    pushState({ id: "AAA" });
    expect(result.current.data).toEqual({ id: "AAA" });

    rerender({ url: null });
    expect(result.current.data).toBeNull();
    expect(result.current.connected).toBe(false);
  });
});
