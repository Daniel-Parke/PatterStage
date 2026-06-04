/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { usePolledUpdates } from "@/hooks/usePolledUpdates";
import type { PollSpec } from "@/lib/dashboard-poll";

// Mock fetch for safeApiCall.
const mockFetch = jest.fn();
global.fetch = mockFetch;

/** Convenience: build a 200 + JSON response. */
function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  };
}

describe("usePolledUpdates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires the apply callback with the extract result on each tick", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(
      jsonResponse({ data: { processes: [{ id: "p1" }] } }),
    );
    const polls: PollSpec<{ processes: unknown[] }>[] = [
      {
        url: "/api/agents",
        ms: 1000,
        paths: [],
        extract: (inner) => ({
          processes: (inner.processes as unknown[]) ?? [],
        }),
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    // First tick: fetch fires, extract runs, apply is called.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ processes: [{ id: "p1" }] });

    // Second tick: same path, fresh fetch.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("supports independent cadences per poll", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/monitor") {
        return jsonResponse({ data: { data: { foo: "bar" } } });
      }
      return jsonResponse({ data: { processes: [] } });
    });
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/monitor",
        ms: 1000,
        paths: ["data"],
        extract: (inner) => ({ monitor: inner }),
      },
      {
        url: "/api/agents",
        ms: 3000,
        paths: [],
        extract: (inner) => ({ processes: (inner as { processes?: unknown[] }).processes ?? [] }),
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    // 1000ms: monitor fires, agents does not
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith({ monitor: { foo: "bar" } });

    // 2000ms more (3000 total): monitor @ 1, 2, 3; agents @ 3
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(apply).toHaveBeenCalledTimes(4); // monitor x3 + agents x1

    // Verify both URLs were hit
    const urls = mockFetch.mock.calls.map((c) => c[0]);
    expect(urls.filter((u) => u === "/api/monitor")).toHaveLength(3);
    expect(urls.filter((u) => u === "/api/agents")).toHaveLength(1);
  });

  it("does not call apply when extract returns null", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(jsonResponse({ data: { x: 1 } }));
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/agents",
        ms: 1000,
        paths: [],
        extract: () => null,
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(apply).not.toHaveBeenCalled();
  });

  it("skips the tick when the envelope is missing the inner payload", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(jsonResponse({}));
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/agents",
        ms: 1000,
        paths: [],
        extract: (inner) => ({ processes: (inner as { processes?: unknown[] }).processes ?? [] }),
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    // safeApiCall returned { ok: true, data: {} } — unwrapPollPath returns null
    expect(apply).not.toHaveBeenCalled();
  });

  it("walks a double-wrap envelope via paths: ['data']", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    // Mimics /api/monitor: { data: { data: MonitorData } }
    mockFetch.mockResolvedValue(
      jsonResponse({ data: { data: { foo: "bar" } } }),
    );
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/monitor",
        ms: 1000,
        paths: ["data"],
        extract: (inner) => ({ monitor: inner }),
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(apply).toHaveBeenCalledWith({ monitor: { foo: "bar" } });
  });

  it("passes the AbortSignal to fetch (so unmount cancels in-flight requests)", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(jsonResponse({ data: { x: 1 } }));
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/agents",
        ms: 1000,
        paths: [],
        extract: (inner) => inner as unknown,
      },
    ];

    renderHook(() => usePolledUpdates(apply, polls));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const initArg = mockFetch.mock.calls[0][1] as RequestInit;
    expect(initArg.signal).toBeInstanceOf(AbortSignal);
  });

  it("clears all intervals on unmount", async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(jsonResponse({ data: { x: 1 } }));
    const polls: PollSpec<unknown>[] = [
      {
        url: "/api/a",
        ms: 1000,
        paths: [],
        extract: () => ({}),
      },
      {
        url: "/api/b",
        ms: 2000,
        paths: [],
        extract: () => ({}),
      },
    ];

    const { unmount } = renderHook(() => usePolledUpdates(apply, polls));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(apply).toHaveBeenCalled();

    const callCountBeforeUnmount = apply.mock.calls.length;
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    // No further ticks after unmount.
    expect(apply).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });

  it("does not re-arm intervals when the polls array reference changes", async () => {
    // The hook stores `polls` and `apply` in refs (mirrors useInterval's
    // pattern) so a fresh array on every render doesn't tear down +
    // recreate the intervals. Without the ref-stash, the dashboard's
    // inline polls array (a new ref every render) would re-arm the
    // intervals on every parent re-render.
    jest.useFakeTimers();
    const apply = jest.fn();
    mockFetch.mockResolvedValue(jsonResponse({ data: { x: 1 } }));
    const { rerender } = renderHook(
      ({ _v }: { _v: number }) => {
        // Build a NEW polls array inside the hook callback so every
        // re-render produces a fresh ref. The hook must NOT tear down +
        // recreate the intervals in response to the new ref.
        const polls: PollSpec<unknown>[] = [
          { url: "/api/a", ms: 1000, paths: [], extract: () => ({}) },
        ];
        return usePolledUpdates(apply, polls);
      },
      { initialProps: { _v: 0 } },
    );

    // First tick: advance the timer and let the async fetch + apply run.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(apply).toHaveBeenCalledTimes(1);

    // Force several re-renders, each with a fresh polls array ref.
    rerender({ _v: 1 });
    rerender({ _v: 2 });
    rerender({ _v: 3 });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    // 3 ticks total (1 from before, 2 from the advance) — not more
    // from re-render churn.
    expect(apply).toHaveBeenCalledTimes(3);
  });
});
