// ═══════════════════════════════════════════════════════════════
// /api/monitor/route.ts — System monitor (DB-centric)
//
// Reads from SQLite tables (synced by the background SyncScheduler)
// instead of direct filesystem operations. Sub-millisecond reads.
// Also includes cron job details and recent sessions for the
// dashboard's inline views.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ensureSyncLayer, getSyncScheduler } from "@/lib/sync";
import { getSystemStat, getSystemStatNumber } from "@/lib/system-repository";
import { listSessions } from "@/lib/sessions/session-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";

import { readGatewayPlatforms, readRecentErrorLogEntries } from "@/lib/sync/sync-repository";
import { getActiveFramework } from "@/lib/frameworks";
import { readSchedulerHealth } from "@/lib/orchestration/scheduler/health";
import type { SessionBrief, MonitorData } from "@/types/console";

// ── Helpers ─────────────────────────────────────────────────

/** Convert a SessionRecord to the brief shape the frontend expects. */
function toSessionBrief(
  session: import("@/lib/sessions/session-repository").SessionRecord
): SessionBrief {
  return {
    id: session.id,
    modified: session.endedAt || session.startedAt,
    size: session.size,
  };
}

// ── Route ───────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    // Ensure sync layer is active (idempotent)
    ensureSyncLayer();

    // ── Sessions (from DB — recent 5) ───────────────────────
    const { sessions: recentSessions, total: totalSessions } = listSessions({ limit: 5 });

    // ── Gateway Platforms (from DB) ─────────────────────────
    const platformsRaw = readGatewayPlatforms();

    const platforms: Record<string, boolean> = {};
    let connectedCount = 0;
    for (const p of platformsRaw) {
      const isEnabled = p.enabled === 1 || p.bot_token_present === 1;
      platforms[p.platform] = isEnabled;
      if (isEnabled) connectedCount++;
    }

    // ── Memory (from meta table) ────────────────────────────
    const memoryFactCount = getSystemStatNumber("memory.fact_count", 0);
    const memoryDbSize = getSystemStat("memory.db_size") ?? "N/A";
    const memoryProvider = getSystemStat("memory.provider") ?? "Not Installed";

    // ── Recent Errors (from DB) ─────────────────────────────
    const recentErrors = readRecentErrorLogEntries();

    // ── System Info (from meta table) ───────────────────────
    const configPresent = getSystemStat("config.present") === "true";
    const soulPresent = getSystemStat("config.soul_present") === "true";
    // Non-empty when ConfigSync last failed to parse config.yaml (the file is
    // malformed). Surfaced as a single dashboard alert instead of log spam.
    const configYamlError = getSystemStat("config.yaml_error") || null;

    // ── Active agent framework (DB-owned registry) ──────────
    let framework: MonitorData["framework"];
    try {
      const fw = getActiveFramework().info();
      framework = { type: fw.type, name: fw.name, available: fw.available };
    } catch {
      framework = undefined;
    }

    // ── Sync Status ─────────────────────────────────────────
    const scheduler = getSyncScheduler();
    let lastSync: string | null = null;
    let allSuccessful = true;
    const sourceStatuses: Record<string, string> = {};
    const sourceErrors: Record<string, string> = {};

    if (scheduler) {
      const lastCycle = scheduler.getLastCycleResult();
      if (lastCycle) {
        lastSync = lastCycle.completedAt;
        allSuccessful = lastCycle.allSuccessful;
        for (const r of lastCycle.results) {
          sourceStatuses[r.sourceName] = r.success ? "ok" : "error";
        }
      }
      // The REASON, not just the cross. The scheduler has kept the last failure
      // message per source since it was written and /api/sync serves it, but the
      // dashboard reads this route: it drew a red tick-mark with no text while
      // the text sat in memory one call away (T-0034). Only sources that
      // actually have a message get a key; see MonitorData.sync.sourceErrors.
      for (const [name, message] of Object.entries(scheduler.getLastErrorBySource())) {
        if (message) sourceErrors[name] = message;
      }
    }

    // Source names from the scheduler
    for (const name of scheduler?.getSourceNames() ?? []) {
      if (!sourceStatuses[name]) sourceStatuses[name] = "pending";
    }

    // ── Background scheduler lease (from meta) ──────────────
    // Read from the DB, not from this process's in-memory scheduler: the
    // heartbeat is cross-process by design, and a follower process serving
    // this request must still report the real owner's liveness.
    const schedulerHealth = readSchedulerHealth();

    const data: MonitorData = {
      sessions: {
        total: totalSessions,
        recent: recentSessions.map(toSessionBrief),
      },
      gateway: {
        platforms,
        connectedCount,
      },
      memory: {
        factCount: memoryFactCount,
        dbSize: memoryDbSize,
        provider: memoryProvider,
      },
      errors: recentErrors,
      system: {
        uptime: getSystemStat("system.uptime") ?? "N/A", // Synced by ProcessSync from /proc/uptime
        configPresent,
        soulPresent,
        configYamlError,
      },
      framework,
      sync: {
        lastRun: lastSync,
        allSuccessful,
        sourceStatuses,
        sourceErrors,
      },
      scheduler: schedulerHealth,
    };

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, max-age=10, stale-while-revalidate=15",
        },
      }
    );
  } catch (error) {
    return serverErrorFromCatch("GET /api/monitor", "aggregating monitor data", error, "Failed to read system monitor data");
  }
}
