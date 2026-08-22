// ═══════════════════════════════════════════════════════════════
// useSessions — TanStack Query data layer for the Session History list
// ═══════════════════════════════════════════════════════════════
//
// Pagination (page) + the source filter live in the query key, so a page
// click or filter change triggers exactly one fetch and cached pages
// re-display instantly.

"use client";

import { useApiResource } from "./useApiResource";
import type { SessionRecord, SessionSource } from "@/lib/sessions/session-repository";

export interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
}

export function useSessions(
  page: number,
  source: SessionSource | null,
  pageSize: number,
  search?: string,
) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (source) params.set("source", source);
  const trimmed = search?.trim();
  if (trimmed) params.set("search", trimmed);
  return useApiResource<SessionsResponse>(
    ["sessions", page, source, trimmed ?? ""],
    `/api/sessions?${params}`,
    {
      select: (p) => p as SessionsResponse | undefined,
      fallback: { sessions: [], total: 0 },
      errorMessage: "Failed to load sessions",
    },
  );
}
