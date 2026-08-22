// ═══════════════════════════════════════════════════════════════
// /api/monitor/route.ts — System monitor (DB-centric)
//
// Reads from SQLite tables (synced by the background SyncScheduler)
// instead of direct filesystem operations. Sub-millisecond reads.
// Also includes cron job details and recent sessions for the
// dashboard's inline views.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ensureSyncLayer, getSyncScheduler } from "@/lib/sync";
import { getSystemStat, getSystemStatNumber } from "@/lib/system-repository";
import { listSessions } from "@/lib/sessions/session-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { getGatewayPlatforms, getDb } from "@/lib/db";
import { getActiveFramework } from "@/lib/frameworks";
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

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    // Ensure sync layer is active (idempotent)
    ensureSyncLayer();

    // ── Sessions (from DB — recent 5) ───────────────────────
    const { sessions: recentSessions, total: totalSessions } = listSessions({ limit: 5 });

    // ── Gateway Platforms (from DB) ─────────────────────────
    const platformsRaw = getGatewayPlatforms();

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
    const recentErrors = getDb()
      .prepare(
        "SELECT source, message, timestamp, severity FROM error_log_entries ORDER BY timestamp DESC LIMIT 10"
      )
      .all() as Array<{ source: string; message: string; timestamp: string; severity: string }>;

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

    if (scheduler) {
      const lastCycle = scheduler.getLastCycleResult();
      if (lastCycle) {
        lastSync = lastCycle.completedAt;
        allSuccessful = lastCycle.allSuccessful;
        for (const r of lastCycle.results) {
          sourceStatuses[r.sourceName] = r.success ? "ok" : "error";
        }
      }
    }

    // Source names from the scheduler
    for (const name of scheduler?.getSourceNames() ?? []) {
      if (!sourceStatuses[name]) sourceStatuses[name] = "pending";
    }

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
      },
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
