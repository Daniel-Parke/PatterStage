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
// This module collapses that pattern into one helper so the polling
// table reads as a list of URL + ms + key, not a list of three
// near-duplicate extract functions.
// ═══════════════════════════════════════════════════════════════

/** Raw envelope returned by `safeApiCall`. The inner shape is endpoint-specific. */
type Envelope = { data?: unknown };

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
