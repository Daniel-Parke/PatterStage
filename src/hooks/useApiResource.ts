// ═══════════════════════════════════════════════════════════════
// useApiResource — the one way a component reads the API
//
// Folds the identical fetch+query+error shape every read-only hook repeated
// (safeApiCall → unwrap the `{ data: ... }` envelope → throw on error →
// `{ data, isLoading, isFetching, error, refetch }`). Each domain hook stays a
// thin wrapper that supplies its endpoint + a `select` to pick its payload and
// keeps its own public field name (stats / summary / sessions / …).
//
// THE KEY IS THE ENDPOINT (T-0129). It used to be the caller's: useDashboard
// cached /api/status/subsystems under ["dashboard","subsystems"] while
// useQuestHost cached the same endpoint under ["status-subsystems"], so the
// dashboard fetched it twice on every load and both polls ran side by side;
// four endpoints were fetched twice that way, and a second loader fetched
// three more a second time for a static bundle. Two readers of one endpoint
// are one cache entry now, whatever they select: the cache holds the raw
// envelope and each reader selects its own shape from it through react-query's
// own `select`, which structurally shares the result so a re-render does not
// hand a consumer a new object for the same data. A read that must POST (the
// story routes' action envelope) keys on endpoint AND body.
//
// react-query is reached only through this hook. No component or hook calls
// useQuery itself; u15-reads-go-through-the-hook holds that.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api/api-fetch";

export interface UseApiResourceOptions<T, M = unknown> {
  /** Pick the payload out of the envelope's `data`. `undefined` means "not there". */
  select: (payload: unknown) => T | undefined;
  /** Pick something off the whole response body (a `meta` block, say). */
  selectMeta?: (body: unknown) => M;
  /** What `data` is when `select` finds nothing, instead of an error. */
  fallback?: T;
  errorMessage?: string;
  /**
   * A fixed interval, or a function of the SELECTED value: a poll that stops
   * once it has what it was waiting for (a run id) asks for `false` then.
   */
  refetchInterval?: number | false | ((value: T | null) => number | false);
  staleTime?: number;
  enabled?: boolean;
  /**
   * A read that must POST. The story routes take `{ action: "list" }` in a
   * body rather than a GET, and a list is a read whatever verb carries it, so
   * it is cached and deduped like one. Part of the key.
   */
  body?: unknown;
}

/** The cache key for an endpoint, for whoever invalidates it after a write. */
export function apiQueryKey(endpoint: string, body?: unknown): QueryKey {
  return body === undefined ? [endpoint] : [endpoint, body];
}

/** What the cache holds: the envelope's `data`, and the whole body for `selectMeta`. */
interface Envelope {
  data: unknown;
  body: unknown;
}

/** An Error that carries the failed response's parsed body and status. */
function failure(message: string, body: unknown, status: number | null): Error {
  const err = new Error(message) as Error & { responseBody?: unknown; status?: number | null };
  err.responseBody = body;
  err.status = status;
  return err;
}

function bodyOf(error: unknown): unknown {
  const body = (error as { responseBody?: unknown } | null)?.responseBody;
  if (!body || typeof body !== "object") return null;
  return (body as { data?: unknown }).data ?? null;
}

function statusOf(error: unknown): number | null {
  return (error as { status?: number | null } | null)?.status ?? null;
}

export function useApiResource<T, M = unknown>(endpoint: string, opts: UseApiResourceOptions<T, M>) {
  const pick = (env: Envelope): { value: T; meta: M | null } => {
    const meta = opts.selectMeta ? opts.selectMeta(env.body) : null;
    const value = opts.select(env.data);
    if (value === undefined) {
      if (opts.fallback !== undefined) return { value: opts.fallback, meta };
      throw failure(opts.errorMessage ?? "Failed to load", env.body, null);
    }
    return { value, meta };
  };

  const interval = opts.refetchInterval;
  const query = useQuery({
    queryKey: apiQueryKey(endpoint, opts.body),
    queryFn: async (): Promise<Envelope> => {
      const res =
        opts.body === undefined
          ? await safeApiCall<{ data?: unknown }>(endpoint)
          : await safeApiCall<{ data?: unknown }>(endpoint, { method: "POST", body: opts.body });
      if (!res.ok) throw failure(res.error ?? opts.errorMessage ?? "Failed to load", res.body, res.status ?? null);
      return { data: res.data?.data, body: res.data ?? null };
    },
    // Errors thrown here land in the query's error state, so "the payload was
    // not there" reads the same as "the request failed".
    select: pick,
    refetchInterval:
      typeof interval === "function"
        ? (q) => {
            let value: T | null = null;
            try {
              value = q.state.data ? pick(q.state.data).value : null;
            } catch {
              value = null;
            }
            return interval(value);
          }
        : interval,
    staleTime: opts.staleTime,
    enabled: opts.enabled,
  });

  return {
    data: query.data?.value ?? null,
    /** Whatever `selectMeta` picked off the body; null when none was given. */
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    /** True once the first read has answered, well or badly: "not yet" and "failed" are different answers. */
    settled: query.isFetched,
    error: query.isError ? (query.error as Error).message : null,
    /** The failed response's `data`, when the server sent one beside its error. */
    errorBody: query.isError ? bodyOf(query.error) : null,
    /** The failed response's HTTP status, when there was one. */
    errorStatus: query.isError ? statusOf(query.error) : null,
    refetch: query.refetch,
  };
}
