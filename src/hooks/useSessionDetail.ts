// ═══════════════════════════════════════════════════════════════
// useSessionDetail — TanStack Query data layer for a session transcript
// ═══════════════════════════════════════════════════════════════
//
// Replaces the session-detail page's single-fetch `useApiData` usage.
// The session id is the query key; `refetch` powers the manual
// "⟳ Refresh" button for still-running sessions (a background refetch,
// no full-page spinner flash).

"use client";

import { useApiResource } from "@/hooks/useApiResource";
import type { SessionData } from "@/components/session/MessageBubble";

export interface UseSessionDetailOptions {
  /** Poll while the session is running; false or omitted when it is not. */
  refetchIntervalMs?: number | false;
}

/**
 * One session, by id, through the one hook (T-0129). The HTTP status rides on
 * the hook's errorStatus, so the page can still tell a 404 from a failure.
 */
export function useSessionDetail(id: string, opts: UseSessionDetailOptions = {}) {
  const query = useApiResource<SessionData>(`/api/sessions/${encodeURIComponent(id)}`, {
    select: (p) => (p as SessionData | null) ?? undefined,
    errorMessage: "Failed to load session",
    enabled: !!id,
    ...(opts.refetchIntervalMs !== undefined ? { refetchInterval: opts.refetchIntervalMs } : {}),
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    errorStatus: query.errorStatus,
    refetch: query.refetch,
  };
}
