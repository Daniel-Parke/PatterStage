// ═══════════════════════════════════════════════════════════════
// list-bounds.ts: a limit and an offset that cannot hurt the database
//
// Ruling 4 of the round-6 remediation (T-0088): bound everything. Before this,
// the missions list had no LIMIT at all, and the sessions list bound whatever
// parseInt returned, so `?limit=-1` reached SQLite as LIMIT -1 (unlimited) and
// `?limit=abc` bound NaN and answered 500. One parser, one shape, every list.
// ═══════════════════════════════════════════════════════════════

export interface ListBoundsOptions {
  defaultLimit: number;
  maxLimit: number;
}

export interface ListBounds {
  limit: number;
  offset: number;
}

/** A finite integer from a query value, or null when it is not one. */
function intOrNull(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  if (!Number.isFinite(n)) {
    // "Infinity", "1e400": not a number a list can use, but "more than the
    // ceiling" is the honest reading, so the caller clamps rather than
    // defaults.
    return raw.trim().startsWith("-") ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  }
  return Math.floor(n);
}

/** Clamp a limit into [1, max]; a non-number becomes the default. */
export function clampLimit(value: unknown, opts: ListBoundsOptions): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;
  if (n === null) return opts.defaultLimit;
  return Math.max(1, Math.min(opts.maxLimit, n));
}

/** The bounds each list publishes. Here, not in the repositories, so a test
 * that mocks a repository module wholesale cannot strip them. */
export const MISSION_LIST_BOUNDS: ListBoundsOptions = { defaultLimit: 200, maxLimit: 500 };
export const MODEL_LIST_BOUNDS: ListBoundsOptions = { defaultLimit: 200, maxLimit: 500 };
export const SCHEDULE_LIST_BOUNDS: ListBoundsOptions = { defaultLimit: 200, maxLimit: 500 };

/**
 * Bounds from whatever the route was handed: a NextRequest (nextUrl), a plain
 * Request (url), or nothing at all, which several older tests still pass.
 */
export function boundsFrom(
  request: { nextUrl?: { searchParams: URLSearchParams }; url?: string } | undefined,
  opts: ListBoundsOptions,
): ListBounds {
  const sp =
    request?.nextUrl?.searchParams ??
    (request?.url ? new URL(request.url).searchParams : new URLSearchParams());
  return parseListBounds(sp, opts);
}

export function parseListBounds(sp: URLSearchParams, opts: ListBoundsOptions): ListBounds {
  const limitRaw = intOrNull(sp.get("limit"));
  const offsetRaw = intOrNull(sp.get("offset"));
  const limit = limitRaw === null ? opts.defaultLimit : Math.max(1, Math.min(opts.maxLimit, limitRaw));
  const offset = offsetRaw === null ? 0 : Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, offsetRaw));
  return { limit, offset };
}
