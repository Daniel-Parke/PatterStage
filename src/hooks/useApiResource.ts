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

export interface UseApiResourceOptions<T, M = unknown> {
  /** Pick the payload from the unwrapped `ok()` body (i.e. `res.data?.data`). */
  select: (payload: unknown) => T | undefined;
  /**
   * Pick anything that rides BESIDE the payload, from the whole body.
   *
   * `ok()` can attach siblings to `data` — `/api/config` sends `configError`
   * there when the file did not parse. Selecting only `data.data` threw that
   * away, so an unparseable config.yaml reached the Settings index as `{}` and
   * rendered as a fresh install (T-0100, D75).
   */
  selectMeta?: (body: unknown) => M;
  /** Returned when the request succeeds but `select` yields undefined (empty list, etc.). */
  fallback?: T;
  errorMessage?: string;
  refetchInterval?: number | false;
  staleTime?: number;
  /** When false, the query is disabled (no fetch) and `data` stays null. */
  enabled?: boolean;
}

/** An Error that carries the failed response's parsed body. */
function failure(message: string, body: unknown): Error {
  const err = new Error(message) as Error & { responseBody?: unknown };
  err.responseBody = body;
  return err;
}

/** The `data` field of a failed response's body, when there is one. */
function bodyOf(error: unknown): unknown {
  const body = (error as { responseBody?: unknown } | null)?.responseBody;
  if (!body || typeof body !== "object") return null;
  return (body as { data?: unknown }).data ?? null;
}

export function useApiResource<T, M = unknown>(
  queryKey: QueryKey,
  endpoint: string,
  opts: UseApiResourceOptions<T, M>,
) {
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<{ value: T; meta: M | null }> => {
      const res = await safeApiCall<{ data?: unknown }>(endpoint);
      if (!res.ok) throw failure(res.error ?? opts.errorMessage ?? "Failed to load", res.body);
      // Read before the payload, and kept through the fallback: a body that
      // says why it is empty is exactly the body whose payload is empty.
      const meta = opts.selectMeta ? opts.selectMeta(res.data ?? null) : null;
      const value = opts.select(res.data?.data);
      if (value === undefined) {
        if (opts.fallback !== undefined) return { value: opts.fallback, meta };
        throw failure(res.error ?? opts.errorMessage ?? "Failed to load", res.body);
      }
      return { value, meta };
    },
    refetchInterval: opts.refetchInterval,
    staleTime: opts.staleTime,
    enabled: opts.enabled,
  });
  return {
    data: query.data?.value ?? null,
    /** Whatever `selectMeta` picked off the body; null when none was given. */
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? (query.error as Error).message : null,
    /**
     * The `data` field of a FAILED response, when the server sent one.
     *
     * A 4xx is not always a dead end: /logs answers a missing log file with the
     * list of files that do exist, which is the only thing that lets the page
     * pick a different one. Throwing the Error and dropping the body meant that
     * list was computed, serialised, received and discarded — a route saying
     * the right thing to a caller that was not listening (T-0071).
     *
     * `error` stays set. This is recovery DATA, not a success: a page that
     * rendered as though nothing were wrong would be a different lie.
     */
    errorBody: query.isError ? bodyOf(query.error) : null,
    refetch: query.refetch,
  };
}
