// ═══════════════════════════════════════════════════════════════
// sync/sources/SessionSync.ts — Wrapper for existing sync
//
// Calls syncHermesSessionsToDb() on a schedule instead of inline
// in the GET /api/sessions route. The sessions API route now just
// reads from the DB.
// ═══════════════════════════════════════════════════════════════

import { syncHermesSessionsToDb } from "@/lib/session-sync";
import { logApiError } from "@/lib/api-logger";
import { db } from "@/lib/db";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class SessionSync implements SyncSource {
  readonly name = "sessions";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const result = syncHermesSessionsToDb();

      // Record sync status in sync_registry
      db().prepare(/* sql */ `
        INSERT OR REPLACE INTO sync_registry (source_name, last_synced_at, status, synced_count, error)
        VALUES (?, datetime('now'), 'ok', ?, NULL)
      `).run(this.name, result.synced);

      if (result.skipped > 0) {
        logApiError("SessionSync", `${result.skipped} sessions skipped (FK violations)`, new Error(`${result.skipped} skipped`));
      }

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
        db().prepare(/* sql */ `
          INSERT OR REPLACE INTO sync_registry (source_name, last_synced_at, status, synced_count, error)
          VALUES (?, datetime('now'), 'error', 0, ?)
        `).run(this.name, String(err));
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