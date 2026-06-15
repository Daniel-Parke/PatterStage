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

async function fetchSessionDetail(id: string): Promise<SessionData> {
  const res = await safeApiCall<{ data?: SessionData }>(
    `/api/sessions/${encodeURIComponent(id)}`,
  );
  if (!res.ok || !res.data?.data) throw new Error(res.error ?? "Failed to load session");
  return res.data.data;
}

export function useSessionDetail(id: string) {
  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => fetchSessionDetail(id),
    enabled: !!id,
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
