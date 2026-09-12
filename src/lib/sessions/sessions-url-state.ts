// ═══════════════════════════════════════════════════════════════
// sessions-url-state.ts — the sessions list view, as a query string
// ═══════════════════════════════════════════════════════════════
//
// The list forgot its filter, its search and its page the moment it was left,
// so a filtered view could not be linked to, bookmarked or come back after a
// reload (T-0105, D37). These two pure functions are the whole of it: the page
// reads once on mount and mirrors on every change.

export interface SessionsView {
  search: string;
  source: string | null;
  failedOnly: boolean;
  /** 0-based internally; 1-based in the URL, because a URL is for a person. */
  page: number;
  pageSize: number;
  /** Set by the mission panel's "View sessions" link (T-0104, D69). */
  missionId: string | null;
}

/** Read a view out of a query string. Junk clamps rather than throws. */
export function readSessionsViewFromUrl(queryString: string, defaultPageSize: number): SessionsView {
  const params = new URLSearchParams(queryString);
  const rawPage = Number.parseInt(params.get("page") ?? "", 10);
  const rawSize = Number.parseInt(params.get("size") ?? "", 10);
  return {
    search: params.get("search")?.trim() ?? "",
    source: params.get("source") || null,
    failedOnly: params.get("status") === "failed",
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage - 1 : 0,
    pageSize: Number.isFinite(rawSize) && rawSize > 0 ? rawSize : defaultPageSize,
    missionId: params.get("missionId") || null,
  };
}

/**
 * The query string for a view, with every default left out.
 *
 * A URL that carries `?page=1&size=50&search=` for the view everyone starts on
 * is noise, and it makes the plain link and the default view look different.
 */
export function writeSessionsViewToUrl(view: SessionsView, defaultPageSize: number): string {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.source) params.set("source", view.source);
  if (view.failedOnly) params.set("status", "failed");
  if (view.missionId) params.set("missionId", view.missionId);
  if (view.page > 0) params.set("page", String(view.page + 1));
  if (view.pageSize !== defaultPageSize) params.set("size", String(view.pageSize));
  const q = params.toString();
  return q ? `?${q}` : "";
}
