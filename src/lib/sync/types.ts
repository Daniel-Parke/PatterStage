// ═══════════════════════════════════════════════════════════════
// sync/types.ts — Sync layer type definitions
// ═══════════════════════════════════════════════════════════════

/** Result of a single sync source run. */
export interface SyncResult {
  sourceName: string;
  success: boolean;
  syncedCount: number;
  error?: string;
  durationMs: number;
}

/**
 * The two results a source returns, in one line each. Seven sources spelled
 * the failure in six identical lines (C2, T-0137); the duration is measured
 * from the `start` the source took when it began.
 */
export function syncSuccess(sourceName: string, syncedCount: number, start: number): SyncResult {
  return { sourceName, success: true, syncedCount, durationMs: Math.round(performance.now() - start) };
}

export function syncFailure(sourceName: string, err: unknown, start: number): SyncResult {
  return { sourceName, success: false, syncedCount: 0, error: String(err), durationMs: Math.round(performance.now() - start) };
}

/** A sync adapter that pulls data from an external source into the DB. */
export interface SyncSource {
  /** Unique name for this source (e.g. 'cron', 'sessions', 'env', 'logs'). */
  readonly name: string;
  /**
   * Run one sync cycle. Called by the SyncScheduler on its interval.
   * Must be idempotent — repeated calls should produce the same DB state.
   */
  sync(): Promise<SyncResult>;
}

/** Summary of a full sync cycle across all registered sources. */
export interface SyncCycleResult {
  startedAt: string;
  completedAt: string;
  results: SyncResult[];
  totalDurationMs: number;
  allSuccessful: boolean;
}
