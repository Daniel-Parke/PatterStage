// ═══════════════════════════════════════════════════════════════
// useApiData — Shared hook for data fetching with loading/error states
// Eliminates duplicated fetch + loading + error boilerplate across pages.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";

interface UseApiDataOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /**
   * Optional polling interval in milliseconds. When set to a positive
   * number, the hook re-fetches the URL on that cadence. When
   * `undefined` or `0`, no polling is registered.
   *
   * Used by the Logs page so the file viewer auto-refreshes every 5s
   * (and pauses via the `enabled: boolean` toggle) without the
   * 4-line `useInterval` + `setRefreshing` micro-state boilerplate.
   *
   * Pair with `useInterval` for non-`useApiData` polling cases. The
   * two helpers stay decoupled so each page picks the shape it needs.
   */
  refreshIntervalMs?: number;
  /**
   * Toggle for the auto-refresh loop. Default `true`. Set to `false`
   * to pause polling without unmounting the hook. The hook reads
   * `optionsRef.current.enabled` on every interval tick so a parent
   * state change takes effect on the next tick without a re-render.
   */
  refreshEnabled?: boolean;
  /**
   * Optional `RequestInit` options merged into every fetch. Used by
   * the Sessions page to thread the `URLSearchParams` body for
   * `limit`/`offset`/`source` filters through the same hook. The
   * extension stays generic — any future consumer that needs custom
   * headers, signal, etc. can pass them here.
   *
   * Note: when this is a `URLSearchParams` instance, fetch will send
   * it with `Content-Type: application/x-www-form-urlencoded`. For
   * GET requests, the params should be appended to the URL via
   * `toString()` so they show up in the query string. The helper
   * handles both shapes.
   *
   * The hook calls `apiFetch` under the hood, which merges a
   * `Content-Type: application/json` header into the caller's
   * `headers` (caller-supplied headers win on key collision). The
   * canonical Content-Type makes the request shape match every
   * other Control Hub API consumer — readers familiar with the
   * `apiFetch`/`safeApiCall` contract will recognise the merged
   * `RequestInit` shape immediately.
   */
  init?: RequestInit;
  /**
   * Optional URL builder. The hook calls this on every render to
   * resolve the current URL, so the parent can thread reactive
   * dependencies (page, filter, sort) through `useMemo` and the
   * hook will re-fetch on URL change. When omitted, `url` is used
   * directly. The builder signature is intentionally identical to
   * the `url` argument so either form is supported.
   */
  urlBuilder?: () => string;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data fetching hook for Control Hub pages.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApiData<ProfilesData>("/api/agent/profiles");
 *
 *   // Reactive URL with pagination / filters:
 *   const url = useCallback(() => `/api/sessions?page=${page}`, [page]);
 *   const { data, loading, error } = useApiData<SessionsResponse>(url, { urlBuilder: url });
 *
 * Replaces the boilerplate pattern:
 *   const [loading, setLoading] = useState(true);
 *   const [data, setData] = useState<T | null>(null);
 *   const load = useCallback(async () => { ... }, []);
 *   useEffect(() => { load(); }, [load]);
 */
export function useApiData<T = unknown>(
  url: string | (() => string),
  options?: UseApiDataOptions
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options?.autoFetch !== false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const optionsRef = useRef(options);

  // Keep options ref in sync without triggering re-renders
  useEffect(() => {
    optionsRef.current = options;
  });

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Resolve the URL lazily so a `urlBuilder` can read fresh
    // closure state on every fetch (e.g. the current page index).
    const resolvedUrl: string = optionsRef.current?.urlBuilder
      ? optionsRef.current.urlBuilder()
      : typeof url === "function"
        ? url()
        : url;
    try {
      // Use apiFetch instead of raw fetch so the hook benefits from
      // the canonical error-message shape (cronPushError enrichment,
      // invalid-JSON guard) shared by every other Control Hub API
      // consumer. The hook still pulls `data` out of the envelope so
      // the consumer-facing contract is unchanged: `data: T | null`.
      const envelope = await apiFetch<{ data?: T }>(
        resolvedUrl,
        optionsRef.current?.init,
      );
      if (mountedRef.current) {
        // The envelope's `data` is optional (`T | undefined`); the
        // hook contract is `T | null` (null is the "no data yet"
        // sentinel for `useState<T | null>(null)`). Coerce missing
        // → null so consumers can still do `data?.foo` without
        // TS complaining about `T | null | undefined`.
        setData(envelope.data ?? null);
      }
    } catch (e: unknown) {
      // AbortError is expected from AbortController — not an error condition
      if (e instanceof Error && e.name === "AbortError") return;
      if (mountedRef.current) {
        // `setErrorFromCaught` composes `messageFromError(e, "Request failed")`
        // — byte-equivalent to the previous inline form. The "Request
        // failed" fallback is the apiFetch default (see `apiFetch`'s
        // empty-string coalescing) and matches the pre-refactor
        // `Request failed (${res.status})` shape for non-2xx responses
        // that had no `json.error`. The helper preserves the empty-Error
        // trap (a thrown "" produces "" not "Error"), so the
        // apiFetch-defaulted fallback fires for empty messages.
        setErrorFromCaught(setError, e, "Request failed");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    if (optionsRef.current?.autoFetch !== false) {
      fetch_();
    }
    return () => { mountedRef.current = false; };
  }, [fetch_]);

  // Polling loop: re-fetch on the configured cadence while enabled.
  // We read the latest `refreshEnabled` flag from optionsRef on every
  // tick so a state change in the parent pauses/resumes the loop
  // without a hook re-mount. The interval clears on unmount, on
  // options change, or when paused — same lifecycle as the parent
  // page that owns the toggle.
  useEffect(() => {
    const ms = options?.refreshIntervalMs;
    if (!ms || ms <= 0) return;
    const id = setInterval(() => {
      if (optionsRef.current?.refreshEnabled === false) return;
      void fetch_();
    }, ms);
    return () => clearInterval(id);
  }, [options?.refreshIntervalMs, fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
