/** @jest-environment jsdom */
// renderHook coverage for the generic useApiResource (TanStack Query layer).

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useApiResource } from "@/hooks/useApiResource";

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn() }));
import { safeApiCall } from "@/lib/api-fetch";
const mockSafeApiCall = safeApiCall as jest.Mock;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => jest.clearAllMocks());

interface Stats {
  total: number;
}

describe("useApiResource", () => {
  it("unwraps the { data: { data } } envelope and returns the selected payload", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { stats: { total: 7 } } } });

    const { result } = renderHook(
      () =>
        useApiResource<Stats>(["stats"], "/api/stats", {
          select: (p) => (p as { stats?: Stats } | null)?.stats,
        }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ total: 7 });
    expect(result.current.error).toBeNull();
    expect(mockSafeApiCall).toHaveBeenCalledWith("/api/stats");
  });

  it("surfaces the response error string when the request fails", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "boom" });

    const { result } = renderHook(
      () =>
        useApiResource<Stats>(["stats-err"], "/api/stats", {
          select: (p) => (p as { stats?: Stats } | null)?.stats,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.data).toBeNull();
  });

  it("returns the fallback when select yields undefined", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: {} } });

    const { result } = renderHook(
      () =>
        useApiResource<Stats[]>(["list"], "/api/list", {
          select: (p) => (p as { items?: Stats[] } | null)?.items,
          fallback: [],
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("errors when select yields undefined and no fallback is given", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: {} } });

    const { result } = renderHook(
      () =>
        useApiResource<Stats>(["missing"], "/api/stats", {
          select: (p) => (p as { stats?: Stats } | null)?.stats,
          errorMessage: "No stats",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBe("No stats"));
    expect(result.current.data).toBeNull();
  });
});
