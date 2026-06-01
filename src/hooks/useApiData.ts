// ═══════════════════════════════════════════════════════════════
// useApiData — Shared hook for data fetching with loading/error states
// Eliminates duplicated fetch + loading + error boilerplate across pages.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiDataOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
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
 * Replaces the boilerplate pattern:
 *   const [loading, setLoading] = useState(true);
 *   const [data, setData] = useState<T | null>(null);
 *   const load = useCallback(async () => { ... }, []);
 *   useEffect(() => { load(); }, [load]);
 */
export function useApiData<T = unknown>(
  url: string,
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
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      if (mountedRef.current) {
        setData(json.data as T);
      }
    } catch (e: unknown) {
      // AbortError is expected from AbortController — not an error condition
      if (e instanceof Error && e.name === "AbortError") return;
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Request failed");
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

  return { data, loading, error, refetch: fetch_ };
}
