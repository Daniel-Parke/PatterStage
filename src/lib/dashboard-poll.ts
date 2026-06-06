// ═══════════════════════════════════════════════════════════════
// Dashboard polling helpers
//
// The dashboard polls three endpoints on independent intervals. Each
// endpoint has a slightly different response shape:
//
//   /api/monitor    → { data: { data: MonitorData } }   (double-wrap)
//   /api/agents     → { data: { processes: [...] } }    (single-wrap)
//   /api/missions   → { data: { missions: [...] } }     (single-wrap)
//
// `safeApiCall` returns the raw envelope as `{ data: T }`, so each
// extractor has to know the wrap depth and the inner key it wants.
// This module exposes:
//   - `unwrapPollPath` — walk a path through the envelope
//   - `definePolls`    — typed config factory used by `usePolledUpdates`
//                       (companion hook in src/hooks/usePolledUpdates.ts)
//   - `PollSpec<T>`    — the typed config the hook consumes
// ═══════════════════════════════════════════════════════════════

/** Raw envelope returned by `safeApiCall`. The inner shape is endpoint-specific. */
export type Envelope = { data?: unknown };

/**
 * Walk `path` through `envelope.data` and return the resulting object,
 * or `null` if any segment is missing or non-object. The result is typed
 * as `T` but the caller is responsible for the type assertion — the
 * helper intentionally returns `unknown`-shaped objects.
 *
 * @example
 *   const inner = unwrapPollPath(raw, ["data"]);      // single-wrap
 *   const inner = unwrapPollPath(raw, ["data", "data"]); // double-wrap
 */
export function unwrapPollPath(
  envelope: Envelope,
  path: readonly string[],
): Record<string, unknown> | null {
  let cursor: unknown = envelope.data;
  for (const segment of path) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (cursor === null || cursor === undefined || typeof cursor !== "object") {
    return null;
  }
  return cursor as Record<string, unknown>;
}

// ── PollSpec — config consumed by usePolledUpdates ────────────────
//
// The dashboard declares its three polls as a typed data structure
// rather than as three near-duplicate `extract` closures. The hook
// (src/hooks/usePolledUpdates.ts) walks the envelope via `unwrapPollPath`,
// invokes the `extract` mapper on the inner payload, and pushes the
// returned update to the parent via the `apply` callback. Returning
// `null` from `extract` skips the tick (e.g. a transient empty payload
// that the parent doesn't want to merge).
//
// `paths` is the list of segments to walk through `envelope.data` to
// reach the inner payload — `[]` for endpoints whose inner payload is
// the top-level `envelope.data`, `["data"]` for double-wrap endpoints
// like `/api/monitor`. The two endpoint shapes we poll are:
//
//   /api/agents    → { data: { processes } }         → paths: []
//   /api/missions  → { data: { missions } }          → paths: []
//   /api/monitor   → { data: { data: MonitorData } } → paths: ["data"]
//
// (The `safeApiCall` response is `{ ok, data: <envelope> }`, so the
// envelope is the value the consumer already received — `paths` walks
// through `envelope.data` only, not the `safeApiCall` outer wrapper.)

export interface PollSpec<TUpdate> {
  /** Endpoint URL. */
  url: string;
  /** Poll cadence in milliseconds. */
  ms: number;
  /**
   * Path through the `safeApiCall` envelope's `data` field. `[]` for
   * single-wrap endpoints (`{ data: { ... } }`); `["data"]` for
   * double-wrap (`{ data: { data: ... } }`).
   */
  paths: readonly string[];
  /**
   * Map the inner payload (the object reached after walking `paths`)
   * to a partial update. Return `null` to skip this tick.
   */
  extract: (inner: Record<string, unknown>) => TUpdate | null;
}

/**
 * Identity helper for declaring a list of `PollSpec<T>` entries. The
 * generic parameter widens the array to `readonly PollSpec<T>[]` so
 * the `usePolledUpdates` hook can infer `T` from the input. Without
 * this helper, the dashboard's poll declaration would need an explicit
 * `as const` on the array or a hand-written `PollSpec<DashboardUpdate>[]`
 * cast.
 *
 * @example
 *   const polls = definePolls<DashboardUpdate>([
 *     { url: "/api/monitor", ms: 10000, paths: ["data"], extract: ... },
 *     { url: "/api/agents",  ms: 15000, paths: [],       extract: ... },
 *   ]);
 *   usePolledUpdates(setData, polls);
 */
export function definePolls<TUpdate>(
  polls: ReadonlyArray<PollSpec<TUpdate>>,
): ReadonlyArray<PollSpec<TUpdate>> {
  return polls;
}
