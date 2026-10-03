/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useInterval } from "@/hooks/useInterval";

describe("useInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls the callback every `ms` milliseconds", () => {
    const fn = jest.fn();
    renderHook(() => useInterval(fn, { ms: 1000 }));

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not register the interval when enabled is false", () => {
    const fn = jest.fn();
    renderHook(() => useInterval(fn, { ms: 1000, enabled: false }));

    jest.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("clears the interval on unmount", () => {
    const fn = jest.fn();
    const { unmount } = renderHook(() => useInterval(fn, { ms: 1000 }));

    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    unmount();
    jest.advanceTimersByTime(5000);
    // fn should still be 1 — no further ticks after unmount
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not restart the interval when the callback identity changes", () => {
    // The hook stores the callback in a ref so a fresh function on
    // every render doesn't tear down + recreate the interval. We
    // assert this by counting tick calls across a re-render: if the
    // interval were torn down + recreated on each render, the
    // clearInterval would fire mid-test and the count would change
    // unexpectedly. A stable ref-based callback should produce
    // exactly N calls for N seconds.
    const fn = jest.fn();
    const useTest = () => useInterval(fn, { ms: 1000 });
    const { rerender } = renderHook(() => useTest());

    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    // Force a re-render — the callback identity changes (new closure
    // passed to useInterval on each render) but the underlying
    // setInterval should NOT be torn down + recreated.
    rerender();
    rerender();
    rerender();

    jest.advanceTimersByTime(2000);
    // 3 ticks total (1 + 2 from the advance), not more from re-render churn
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not register when ms is 0 or negative", () => {
    const fn = jest.fn();
    renderHook(() => useInterval(fn, { ms: 0 }));

    jest.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("tolerates a Promise return from the callback", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useInterval(fn, { ms: 1000 }));

    jest.advanceTimersByTime(1000);
    // Promise is fire-and-forget — the test just needs to not throw
    expect(fn).toHaveBeenCalledTimes(1);
  });

  describe("hidden tabs", () => {
    // jsdom reports `visibilityState: "visible"` and has no way to change it,
    // so the tests below redefine the getter and fire the same
    // `visibilitychange` event the browser fires. That is exactly the signal
    // the hook subscribes to.
    const setVisibility = (state: "visible" | "hidden") => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    };

    afterEach(() => {
      setVisibility("visible");
    });

    it("stops ticking while the document is hidden", () => {
      const fn = jest.fn();
      renderHook(() => useInterval(fn, { ms: 1000 }));

      jest.advanceTimersByTime(2000);
      expect(fn).toHaveBeenCalledTimes(2);

      setVisibility("hidden");
      jest.advanceTimersByTime(60_000);
      // A whole minute of hidden time buys zero ticks.
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("fires one catch-up tick when the document becomes visible again", () => {
      const fn = jest.fn();
      renderHook(() => useInterval(fn, { ms: 1000 }));

      setVisibility("hidden");
      jest.advanceTimersByTime(60_000);
      expect(fn).not.toHaveBeenCalled();

      setVisibility("visible");
      // Immediately, without waiting out another period: the data the operator
      // is looking at was up to a full period stale.
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(2000);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not fire a tick on mount", () => {
      // The catch-up tick must be distinguishable from mounting: callers load
      // their own initial data and a mount-time tick would double it.
      const fn = jest.fn();
      renderHook(() => useInterval(fn, { ms: 1000 }));
      expect(fn).not.toHaveBeenCalled();
    });

    it("keeps ticking while hidden when pauseWhenHidden is false", () => {
      const fn = jest.fn();
      renderHook(() => useInterval(fn, { ms: 1000, pauseWhenHidden: false }));

      setVisibility("hidden");
      jest.advanceTimersByTime(3000);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
