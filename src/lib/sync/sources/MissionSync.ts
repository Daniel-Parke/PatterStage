// ═══════════════════════════════════════════════════════════════
// sync/sources/MissionSync.ts — Mission status sync from disk
//
// Pulls mission status.json files from the Hermes missions
// directory and updates the DB when a mission transitions to
// 'successful' or 'failed'. Runs on the background sync schedule
// instead of inline on every GET /api/missions request.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { listMissions, updateMission } from "@/lib/mission-repository";
import { PATHS } from "@/lib/paths";
import { logApiError } from "@/lib/api-logger";
import { setMultipleStats } from "@/lib/system-repository";
import type { SyncSource, SyncResult } from "@/lib/sync/types";
import type { MissionStatus } from "@/lib/agent-backend/types";

interface DiskStatus {
  status: string;
  exit_code: number;
  completed_at: string;
  error?: string;
}

export class MissionSync implements SyncSource {
  readonly name = "missions";

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    let syncedCount = 0;
    let hasErrors = false;
    const errors: string[] = [];

    try {
      const missions = listMissions();

      for (const mission of missions) {
        if (mission.status !== "dispatched") continue;

        const statusPath = join(PATHS.missions, `${mission.id}.status.json`);
        if (!existsSync(statusPath)) continue;

        try {
          const disk = JSON.parse(readFileSync(statusPath, "utf-8")) as DiskStatus;
          if (disk.status === "successful" || disk.status === "failed") {
            updateMission(mission.id, { status: disk.status as MissionStatus });
            syncedCount++;
          }
        } catch (e) {
          hasErrors = true;
          errors.push(`Failed to read status for ${mission.id}: ${e}`);
        }
      }

      setMultipleStats({
        "missions.last_sync_status": hasErrors ? "errors" : "ok",
        "missions.last_sync_time": new Date().toISOString(),
      });

      return {
        sourceName: this.name,
        success: !hasErrors,
        syncedCount,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      logApiError("MissionSync", "syncing mission status", err);
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
