// ═══════════════════════════════════════════════════════════════
// useApiResource — generic TanStack Query layer for read-only `{ data: T }` routes
//
// Folds the identical fetch+query+error shape the read-only hooks repeated
// (safeApiCall → unwrap the `{ data: ... }` envelope → throw on error →
// `{ data, isLoading, isFetching, error, refetch }`). Each domain hook stays a
// thin wrapper that supplies its endpoint + a `select` to pick its payload and
// keeps its own public field name (stats / summary / sessions / …). Hooks with
// mutations (useSchedules), callback grids (useMissionsApi), or multi-query
// bundles (useDashboard) are intentionally NOT folded here.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";

export interface UseApiResourceOptions<T> {
  /** Pick the payload from the unwrapped `ok()` body (i.e. `res.data?.data`). */
  select: (payload: unknown) => T | undefined;
  /** Returned when the request succeeds but `select` yields undefined (empty list, etc.). */
  fallback?: T;
  errorMessage?: string;
  refetchInterval?: number | false;
  staleTime?: number;
}

export function useApiResource<T>(
  queryKey: QueryKey,
  endpoint: string,
  opts: UseApiResourceOptions<T>,
) {
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<T> => {
      const res = await safeApiCall<{ data?: unknown }>(endpoint);
      if (!res.ok) throw new Error(res.error ?? opts.errorMessage ?? "Failed to load");
      const value = opts.select(res.data?.data);
      if (value === undefined) {
        if (opts.fallback !== undefined) return opts.fallback;
        throw new Error(res.error ?? opts.errorMessage ?? "Failed to load");
      }
      return value;
    },
    refetchInterval: opts.refetchInterval,
    staleTime: opts.staleTime,
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
