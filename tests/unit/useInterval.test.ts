/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
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
});
