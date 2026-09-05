// ═══════════════════════════════════════════════════════════════
// useSessionDetail — TanStack Query data layer for a session transcript
// ═══════════════════════════════════════════════════════════════
//
// Replaces the session-detail page's single-fetch `useApiData` usage.
// The session id is the query key; `refetch` powers the manual
// "⟳ Refresh" button for still-running sessions (a background refetch,
// no full-page spinner flash).

"use client";

import { useQuery } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";
import type { SessionData } from "@/components/session/MessageBubble";

/** An Error that remembers which HTTP status it came from. */
class SessionLoadError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "SessionLoadError";
  }
}

async function fetchSessionDetail(id: string): Promise<SessionData> {
  const res = await safeApiCall<{ data?: SessionData }>(
    `/api/sessions/${encodeURIComponent(id)}`,
  );
  if (!res.ok || !res.data?.data) {
    // The status travels with the failure: a malformed id, a transcript over
    // the ceiling and a rate limit are three different answers, and the page
    // gave all of them the same heading (T-0105, D33).
    throw new SessionLoadError(res.error ?? "Failed to load session", res.status ?? null);
  }
  return res.data.data;
}

export interface UseSessionDetailOptions {
  /** Poll while the session is running; false or omitted when it is not. */
  refetchIntervalMs?: number | false;
}

export function useSessionDetail(id: string, opts: UseSessionDetailOptions = {}) {
  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => fetchSessionDetail(id),
    enabled: !!id,
    ...(opts.refetchIntervalMs !== undefined ? { refetchInterval: opts.refetchIntervalMs } : {}),
  });
  const err = query.isError ? (query.error as Error) : null;
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: err ? err.message : null,
    errorStatus: err instanceof SessionLoadError ? err.status : null,
    refetch: query.refetch,
  };
}
