// ═══════════════════════════════════════════════════════════════
// dashboard-error-dedup.ts — Pure helper for the dashboard errors panel
// ═══════════════════════════════════════════════════════════════
//
// The dashboard's "Errors" panel can be dominated by repeated
// gateway-reconnect errors that log the same line every few minutes.
// The panel renders consecutive identical (source, message) pairs as
// a single row with a "(×N)" suffix so users see e.g.
// `Api_Server: Refusing to start (×5)` instead of 5 separate rows.
//
// The dedup logic was inline in src/app/page.tsx (a 12-line
// `for...of` over `monitor.errors`, building a `Map` keyed by
// `${source}::${message}`). Extracted to a pure helper so the
// algorithm can be unit-tested without rendering the dashboard, and
// so the page JSX stays a pure render of the precomputed array.

/**
 * Subset of the error item shape the dedup helper needs. The
 * dashboard's `MonitorData.errors` is `Array<MonitorError>` (defined
 * in `@/types/console`); we accept any object with the two fields
 * the algorithm reads, and pass the original record through (so
 * extra fields like `timestamp` survive the merge).
 */
export interface DedupableError {
  source: string;
  message: string;
}

/**
 * Collapse consecutive identical (source, message) pairs into a
 * single row with a "(×N)" suffix on the message. The input array
 * order is preserved (first-occurrence wins for the merged row).
 *
 * Pure function. The input is not mutated. The returned array
 * contains the original error objects — the only field that may be
 * modified is `message` (when count > 1, the message is suffixed
 * with `  (×N)`).
 *
 * @example
 *   dedupErrors([
 *     { source: "Api_Server", message: "Refusing to start" },
 *     { source: "Api_Server", message: "Refusing to start" },
 *     { source: "Cron",       message: "Job missed" },
 *   ])
 *   // => [
 *   //   { source: "Api_Server", message: "Refusing to start  (×2)" },
 *   //   { source: "Cron",       message: "Job missed" },
 *   // ]
 *
 * The "(×N)" suffix uses two spaces before the parenthetical to
 * match the pre-extraction inline shape byte-for-byte (a render
 * regression would surface as a snapshot diff).
 */
export function dedupErrors<T extends DedupableError>(errors: readonly T[]): T[] {
  const seen = new Map<string, { err: T; count: number }>();
  for (const e of errors) {
    const key = `${e.source}::${e.message}`;
    const existing = seen.get(key);
    if (existing) existing.count += 1;
    else seen.set(key, { err: e, count: 1 });
  }
  return Array.from(seen.values()).map(({ err, count }) =>
    count > 1 ? ({ ...err, message: `${err.message}  (×${count})` } as T) : err,
  );
}
