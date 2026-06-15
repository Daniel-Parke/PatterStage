// ═══════════════════════════════════════════════════════════════
// useLogs — TanStack Query data layer for the System Logs viewer
// ═══════════════════════════════════════════════════════════════
//
// Replaces the logs page's `useApiData(url, { refreshIntervalMs, refreshEnabled })`
// usage. The reactive log name + line count live in the query key (so a
// file/size change refetches), and the 5s auto-refresh maps to
// `refetchInterval` gated by the page's `autoRefresh` toggle.

"use client";

import { useQuery } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";
import type { LogGetData } from "@/app/api/logs/route";

async function fetchLog(name: string, lines: number): Promise<LogGetData> {
  const res = await safeApiCall<{ data?: LogGetData }>(
    `/api/logs?name=${encodeURIComponent(name)}&lines=${lines}`,
  );
  if (!res.ok || !res.data?.data) throw new Error(res.error ?? "Failed to load log");
  return res.data.data;
}

export function useLogs(name: string, lines: number, opts: { autoRefresh: boolean }) {
  const query = useQuery({
    queryKey: ["logs", name, lines],
    queryFn: () => fetchLog(name, lines),
    refetchInterval: opts.autoRefresh ? 5_000 : false,
  });
  return {
    data: query.data ?? null,
    // First-load spinner vs. background-refresh spinner: `isLoading` is
    // true only while there is no cached data yet; `isFetching` is true
    // during any fetch (used for the "Refresh" button affordance).
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}

export type { LogGetData };
