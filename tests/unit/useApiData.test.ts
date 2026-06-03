/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiData } from "@/hooks/useApiData";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useApiData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("starts in loading state", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApiData("/api/test"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches data on mount", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { items: [1, 2, 3] } }),
    });

    const { result } = renderHook(() => useApiData("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    const { result } = renderHook(() => useApiData("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Server error");
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useApiData("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network failure");
  });

  it("supports refetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: "first" }),
    });

    const { result } = renderHook(() => useApiData("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: "second" }),
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBe("second");
    });
  });

  it("does not fetch when autoFetch is false", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useApiData("/api/test", { autoFetch: false }));

    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("polls on refreshIntervalMs and pauses via refreshEnabled", async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tick: 1 } }),
    });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useApiData("/api/test", { refreshIntervalMs: 1000, refreshEnabled: enabled }),
      { initialProps: { enabled: true } },
    );

    // First fetch is the auto-fetch on mount
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance timer: should re-fetch once
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Disable polling: next tick should NOT fetch
    rerender({ enabled: false });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Re-enable: should fetch again
    rerender({ enabled: true });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  it("passes init options to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: "ok" }),
    });

    const init: RequestInit = { headers: { "X-Test": "1" } };
    const { result } = renderHook(() =>
      useApiData("/api/test", { init }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledWith("/api/test", init);
  });

  it("resolves URL via urlBuilder on every fetch (lazy)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: "ok" }),
    });

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useApiData("/api/test", { urlBuilder: () => `/api/test?p=${page}` }),
      { initialProps: { page: 0 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenLastCalledWith("/api/test?p=0", undefined);

    // Change the page prop. Because the parent URL string is unchanged,
    // the auto-fetch effect doesn't re-fire, but a manual `refetch()`
    // should read the freshest `urlBuilder` closure on the next tick.
    rerender({ page: 2 });
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetch).toHaveBeenLastCalledWith("/api/test?p=2", undefined);
  });
});
