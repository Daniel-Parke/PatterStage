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
