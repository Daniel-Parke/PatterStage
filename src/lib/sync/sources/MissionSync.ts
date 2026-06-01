// ═══════════════════════════════════════════════════════════════
// sync/sources/MissionSync.ts — Mission status sync from disk
//
// Pulls mission status.json files from the Hermes missions
// directory and updates the DB when a mission transitions to
// 'successful' or 'failed'. Runs on the background sync schedule
// instead of inline on every GET /api/missions request.
//
// Also detects orphaned dispatched missions whose process died
// before writing status.json and marks them as failed.
//
// All filesystem I/O uses fs.promises so the event loop is not
// blocked while iterating hundreds of missions (or touching a
// slow filesystem). The previous synchronous readFileSync loop
// was an event-loop block proportional to mission count + status
// file size. Combined with the SyncScheduler per-source timeout,
// this guarantees mission sync can never wedge the server.
// ═══════════════════════════════════════════════════════════════

import { access, constants, readFile, writeFile } from "fs/promises";
import { join } from "path";

import { listMissions, updateMission } from "@/lib/mission-repository";
import { PATHS } from "@/lib/paths";
import { logApiError } from "@/lib/api-logger";
import { db } from "@/lib/db";
import type { SyncSource, SyncResult } from "@/lib/sync/types";
import type { MissionStatus } from "@/lib/agent-backend/types";

interface DiskStatus {
  status: string;
  exit_code: number;
  completed_at: string;
  error?: string;
}

/** Check if a PID is alive. Returns false for invalid/missing PID. */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Async file existence check. */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Read PID from a mission's pid.json file, or null if missing/invalid. */
async function readMissionPid(missionId: string): Promise<number | null> {
  const pidPath = join(PATHS.missions, `${missionId}.pid.json`);
  if (!(await fileExists(pidPath))) return null;
  try {
    const data = JSON.parse(await readFile(pidPath, "utf-8")) as { pid?: number };
    return typeof data.pid === "number" && data.pid > 0 ? data.pid : null;
  } catch {
    return null;
  }
}

/**
 * Write a canonical failed status.json for a mission whose process
 * died without writing a completion status.
 */
async function writeFailedStatus(missionId: string): Promise<void> {
  const statusPath = join(PATHS.missions, `${missionId}.status.json`);
  if (await fileExists(statusPath)) return;
  const payload = {
    status: "failed",
    exit_code: null,
    completed_at: new Date().toISOString(),
    error: "Process terminated without completion",
  };
  try {
    await writeFile(statusPath, JSON.stringify(payload) + "\n");
  } catch {
    // best-effort
  }
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
        if (!(await fileExists(statusPath))) {
          // No status file yet. Check if the process died.
          const pid = await readMissionPid(mission.id);
          if (pid !== null && !isPidAlive(pid)) {
            await writeFailedStatus(mission.id);
            updateMission(mission.id, { status: "failed" });
            syncedCount++;
          }
          continue;
        }

        try {
          const disk = JSON.parse(await readFile(statusPath, "utf-8")) as DiskStatus;
          if (disk.status === "successful" || disk.status === "failed") {
            updateMission(mission.id, { status: disk.status as MissionStatus });
            syncedCount++;
          }
        } catch (e) {
          hasErrors = true;
          errors.push(`Failed to read status for ${mission.id}: ${e}`);
        }
      }

      // Record sync result in sync_registry
      try {
        db().prepare(/* sql */ `
          INSERT OR REPLACE INTO sync_registry (source_name, last_synced_at, status, synced_count, error)
          VALUES (?, datetime('now'), ?, ?, ?)
        `).run(this.name, hasErrors ? "error" : "ok", syncedCount, errors.length > 0 ? errors.join("; ") : null);
      } catch { /* best-effort */ }

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
