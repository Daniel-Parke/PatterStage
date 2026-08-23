/** @jest-environment jsdom */
// renderHook coverage for useSpend, the console's /api/spend data layer.
//
// The assertion worth having here is the last one. Saving a budget re-reads the
// server's answer rather than patching a local cache, because the response
// carries the recomputed verdict and a locally guessed one could disagree with
// the server about whether a hard stop is engaged. That is not a disagreement
// worth having about money.

import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn() }));
import { safeApiCall } from "@/lib/api-fetch";
import { useSpend } from "@/hooks/useSpend";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

const mockSafeApiCall = safeApiCall as jest.Mock;

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const SUMMARY = { periods: [], policy: UNSET_SPEND_POLICY, unmeasured: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { spend: SUMMARY } } });
});

describe("useSpend", () => {
  it("reads the summary from /api/spend", async () => {
    const { result } = renderHook(() => useSpend(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.spend).toEqual(SUMMARY));
    expect(result.current.error).toBeNull();
    expect(mockSafeApiCall).toHaveBeenCalledWith("/api/spend");
  });

  it("surfaces a read failure rather than showing a confident zero", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "boom" });
    const { result } = renderHook(() => useSpend(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.spend).toBeUndefined();
  });

  it("PUTs the draft as an object and re-reads the server's answer", async () => {
    const { result } = renderHook(() => useSpend(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.spend).toEqual(SUMMARY));
    mockSafeApiCall.mockClear();

    let error: string | null = "unset";
    await act(async () => {
      error = await result.current.saveBudget({ limitUsd: 40, period: "week", hardStop: false });
    });

    expect(error).toBeNull();
    // The body is the object, not a JSON string: safeApiCall serialises it.
    expect(mockSafeApiCall).toHaveBeenCalledWith("/api/spend", {
      method: "PUT",
      body: { limitUsd: 40, period: "week", hardStop: false },
    });
    // PUT then re-read.
    expect(mockSafeApiCall).toHaveBeenCalledTimes(2);
  });

  it("returns the error string when the save is refused, and does not re-read", async () => {
    const { result } = renderHook(() => useSpend(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.spend).toEqual(SUMMARY));
    mockSafeApiCall.mockClear();
    mockSafeApiCall.mockResolvedValue({
      ok: false,
      error: "Set a budget figure before switching the hard stop on",
    });

    let error: string | null = null;
    await act(async () => {
      error = await result.current.saveBudget({ limitUsd: null, period: "month", hardStop: true });
    });

    expect(error).toBe("Set a budget figure before switching the hard stop on");
    expect(mockSafeApiCall).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });
});
