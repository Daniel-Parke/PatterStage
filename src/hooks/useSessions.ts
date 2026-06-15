// ═══════════════════════════════════════════════════════════════
// useSessions — TanStack Query data layer for the Session History list
// ═══════════════════════════════════════════════════════════════
//
// Replaces the sessions page's reactive `useApiData(urlBuilder)` usage.
// Pagination (page) + the source filter live in the query key, so a
// page click or filter change triggers exactly one fetch and cached
// pages re-display instantly.

"use client";

import { useQuery } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";
import type { SessionRecord, SessionSource } from "@/lib/session-repository";

export interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
}

async function fetchSessions(
  page: number,
  source: SessionSource | null,
  pageSize: number,
): Promise<SessionsResponse> {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (source) params.set("source", source);
  const res = await safeApiCall<{ data?: SessionsResponse }>(`/api/sessions?${params}`);
  if (!res.ok) throw new Error(res.error ?? "Failed to load sessions");
  return res.data?.data ?? { sessions: [], total: 0 };
}

export function useSessions(
  page: number,
  source: SessionSource | null,
  pageSize: number,
) {
  const query = useQuery({
    queryKey: ["sessions", page, source],
    queryFn: () => fetchSessions(page, source, pageSize),
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
