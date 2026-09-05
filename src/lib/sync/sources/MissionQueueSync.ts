// ═══════════════════════════════════════════════════════════════
// sync/sources/MissionQueueSync.ts — Background dispatch for queued missions
// ═══════════════════════════════════════════════════════════════

import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { logApiError } from "@/lib/api-logger";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

export class MissionQueueSync implements SyncSource {
  readonly name = "mission-queue";

  async sync(): Promise<SyncResult> {
    const start = performance.now();

    try {
      const tick = await runMissionQueueTick();
      if (!tick.ran) {
        // `blocked` is the operator's hard spend stop refusing an unattended
        // dispatch. That is a deliberate refusal, not a failure, so success
        // stays true and the reason rides along for the monitor surface.
        return {
          sourceName: this.name,
          success: true,
          syncedCount: 0,
          error: tick.blocked,
          durationMs: Math.round(performance.now() - start),
        };
      }

      return {
        sourceName: this.name,
        success: tick.ok === true,
        syncedCount: tick.ok ? 1 : 0,
        error: tick.ok ? undefined : `dispatch failed for ${tick.missionId}`,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("MissionQueueSync", "sync", err);
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
