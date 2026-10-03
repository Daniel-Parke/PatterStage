/** @jest-environment jsdom */
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStats } from "@/hooks/useStats";
import { jsonResponse } from "../helpers/fetch-map";

it.each([0, 250])("staggered stats observers preserve the frozen request timeline [latency %i ms]", async latency => {
  jest.useFakeTimers(); jest.setSystemTime(0); focusManager.setFocused(true);
  const previousFetch = global.fetch;
  const trace: number[] = [];
  const settlements: number[] = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  global.fetch = jest.fn(async (url) => {
    expect(String(url)).toBe("/api/stats"); trace.push(Date.now());
    if (latency) await new Promise(resolve => setTimeout(resolve, latency));
    settlements.push(Date.now());
    return jsonResponse({ data: { stats: { quests: { total: 4, completed: 1 } } } });
  });
  function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const advance = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  let second: ReturnType<typeof renderHook<ReturnType<typeof useStats>, unknown>> | undefined;
  const first = renderHook(() => useStats(), { wrapper: Wrapper });
  try {
    await advance(0); await advance(5000);
    second = renderHook(() => useStats(), { wrapper: Wrapper });
    await advance(0); expect(trace).toEqual([0]);
    await advance(14000); act(() => focusManager.setFocused(false));
    await advance(2000); act(() => focusManager.setFocused(true)); await advance(0);
    await advance(24000);
    // Independently measured against the unchanged baseline before freeze.
    expect(trace).toEqual([0, 21000, 41000 + latency]);
    expect(settlements).toEqual([latency, 21000 + latency, 41000 + 2 * latency]);
    expect(first.result.current.stats).toEqual(second.result.current.stats);
    expect(first.result.current.error).toBeNull();
  } finally {
    first.unmount(); second?.unmount(); client.clear(); focusManager.setFocused(undefined);
    global.fetch = previousFetch; jest.useRealTimers();
  }
});
