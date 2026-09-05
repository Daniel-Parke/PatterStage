// ═══════════════════════════════════════════════════════════════
// useSessions — TanStack Query data layer for the sessions list
// ═══════════════════════════════════════════════════════════════
//
// Every filter lives in the query key, so a page click or a filter change
// triggers exactly one fetch and a cached page re-displays instantly.
//
// The parameter list is an object rather than six positionals: it was already
// five when B10 added missionId, and a call site reading
// `useSessions(page, source, 50, search, null, true, false)` is a call site
// nobody can check.

"use client";

import { useApiResource } from "./useApiResource";
import type {
  SessionRecord,
  SessionStatus,
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
  /**
   * Every source this filter can still reach, from the same table. The page
   * built its filter buttons from a fixed four-name map, so a session from any
   * other source could not be found by what started it (T-0105, D29).
   */
  sources: string[];
}

/** How often the list re-reads itself while something is running. */
export const SESSIONS_LIVE_POLL_MS = 10_000;

/** What the tiles show before the first response lands: nothing. */
const NO_TOTALS: SessionTotals = { total: 0, active: 0, messages: 0, bySource: {} };

export interface UseSessionsParams {
  page: number;
  source: string | null;
  pageSize: number;
  search?: string;
  status?: SessionStatus | null;
  hideApiNoise?: boolean;
  /** Show only the sessions one mission produced (T-0104, D69). */
  missionId?: string | null;
  /** Poll while something is live; false when nothing is (T-0105, D36). */
  refetchIntervalMs?: number | false;
  /** False until the page has read its view out of the URL. */
  enabled?: boolean;
}

export function useSessions({
  page,
  source,
  pageSize,
  search,
  status,
  hideApiNoise,
  missionId,
  refetchIntervalMs,
  enabled,
}: UseSessionsParams) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  if (source) params.set("source", source);
  const trimmed = search?.trim();
  if (trimmed) params.set("search", trimmed);
  if (status) params.set("status", status);
  if (hideApiNoise) params.set("hideApiNoise", "1");
  if (missionId) params.set("missionId", missionId);
  return useApiResource<SessionsResponse>(
    [
      "sessions",
      page,
      source,
      pageSize,
      trimmed ?? "",
      status ?? "",
      hideApiNoise ? 1 : 0,
      missionId ?? "",
    ],
    `/api/sessions?${params}`,
    {
      select: (p) => p as SessionsResponse | undefined,
      fallback: { sessions: [], total: 0, totals: NO_TOTALS, sources: [] },
      ...(refetchIntervalMs !== undefined ? { refetchInterval: refetchIntervalMs } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  );
}
