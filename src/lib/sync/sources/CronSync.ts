// ═══════════════════════════════════════════════════════════════
// sync/sources/CronSync.ts — Wrapper for existing importHermesJobs()
//
// Cron and session sync functions already exist in the repository
// layer. These wrappers give them a SyncSource interface so the
// SyncScheduler can call them on its interval.
// ═══════════════════════════════════════════════════════════════

import { importHermesJobs } from "@/lib/cron-repository";
import { logApiError } from "@/lib/api-logger";
import { setMultipleStats } from "@/lib/system-repository";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class CronSync implements SyncSource {
  readonly name = "cron";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    try {
      const result = importHermesJobs();
      const totalSynced = result.imported.length;
      const hasErrors = result.errors.length > 0;

      setMultipleStats({
        "cron.total": String(totalSynced),
        "cron.last_sync_status": hasErrors ? "errors" : "ok",
        "cron.last_sync_time": new Date().toISOString(),
      });

      return {
        sourceName: this.name,
        success: !hasErrors,
        syncedCount: totalSynced,
        error: hasErrors ? result.errors.join("; ") : undefined,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("CronSync", "syncing cron jobs", err);
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