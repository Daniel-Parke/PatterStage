// ═══════════════════════════════════════════════════════════════
// useSessions — TanStack Query data layer for the Session History list
// ═══════════════════════════════════════════════════════════════
//
// Pagination (page) + the source filter live in the query key, so a page
// click or filter change triggers exactly one fetch and cached pages
// re-display instantly.

"use client";

import { useApiResource } from "./useApiResource";
import type {
  SessionRecord,
  SessionSource,
  SessionTotals,
} from "@/lib/sessions/session-repository";

export interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
  /**
   * Whole-table figures for the same filter, which the insight tiles render.
   * `totals.total` is `total`; both come from one aggregate in the repository,
   * so the tiles cannot contradict the header (T-0042).
   */
  totals: SessionTotals;
}

/** What the tiles show before the first response lands: nothing. */
const NO_TOTALS: SessionTotals = { total: 0, active: 0, messages: 0, bySource: {} };

export function useSessions(
  page: number,
  source: SessionSource | null,
  pageSize: number,
  search?: string,
  /**
   * Show only the sessions one mission produced. The route and the repository
   * have always accepted this; nothing ever sent it, so the mission panel had
   * no way to link to its own output (T-0104, D69).
   */
  missionId?: string | null,
) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (source) params.set("source", source);
  const trimmed = search?.trim();
  if (trimmed) params.set("search", trimmed);
  if (missionId) params.set("missionId", missionId);
  return useApiResource<SessionsResponse>(
    ["sessions", page, source, trimmed ?? "", missionId ?? ""],
    `/api/sessions?${params}`,
    {
      select: (p) => p as SessionsResponse | undefined,
      fallback: { sessions: [], total: 0, totals: NO_TOTALS },
      errorMessage: "Failed to load sessions",
    },
  );
}
