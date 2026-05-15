// ═══════════════════════════════════════════════════════════════
// sync/sources/SessionSync.ts — Wrapper for existing sync
//
// Calls syncHermesSessionsToDb() on a schedule instead of inline
// in the GET /api/sessions route. The sessions API route now just
// reads from the DB.
// ═══════════════════════════════════════════════════════════════

import { syncHermesSessionsToDb } from "@/lib/session-repository";
import { logApiError } from "@/lib/api-logger";
import { setMultipleStats } from "@/lib/system-repository";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class SessionSync implements SyncSource {
  readonly name = "sessions";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const result = syncHermesSessionsToDb();

      setMultipleStats({
        "sessions.total": String(result.synced),
        "sessions.last_sync_time": new Date().toISOString(),
      });

      return {
        sourceName: this.name,
        success: true,
        syncedCount: result.synced,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("SessionSync", "syncing sessions", err);
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