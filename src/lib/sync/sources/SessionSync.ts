// ═══════════════════════════════════════════════════════════════
// sync/sources/SessionSync.ts — Wrapper for existing sync
//
// Calls syncHermesSessionsToDb() on a schedule instead of inline
// in the GET /api/sessions route. The sessions API route now just
// reads from the DB.
// ═══════════════════════════════════════════════════════════════

import { syncHermesSessionsToDb } from "@/lib/sessions/session-sync";
import { logApiError } from "@/lib/api-logger";
import { recordSyncFailure, recordSyncSuccess } from "@/lib/sync/sync-repository";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class SessionSync implements SyncSource {
  readonly name = "sessions";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const result = syncHermesSessionsToDb();

      // Record sync status in sync_registry
      recordSyncSuccess(this.name, result.synced);

      // No second line here. syncHermesSessionsToDb already reports skips, with
      // the actual causes and a signature gate. This used to log the same fact
      // through logApiError, at ERROR level, having SYNTHESISED an Error from
      // the count, so the only thing it could print was the number already in
      // its own context string. Two lines per tick, four times a minute, for a
      // stable non-actionable condition, and an ERROR for a sync that succeeded.
      return {
        sourceName: this.name,
        success: true,
        syncedCount: result.synced,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("SessionSync", "syncing sessions", err);

      // Record failure in sync_registry
      try {
        recordSyncFailure(this.name, String(err));
      } catch { /* best-effort */ }

      return {
        sourceName: this.name,
        success: false,
        syncedCount: 0,
        error: String(err),
        durationMs: Math.round(performance.now() - start),
      };
    }
  }
}