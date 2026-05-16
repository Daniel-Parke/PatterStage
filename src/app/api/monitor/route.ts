// ═══════════════════════════════════════════════════════════════
// /api/monitor/route.ts — System monitor (DB-centric)
//
// Reads from SQLite tables (synced by the background SyncScheduler)
// instead of direct filesystem operations. Sub-millisecond reads.
// Also includes cron job details and recent sessions for the
// dashboard's inline views.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { ensureSyncLayer, getSyncScheduler } from "@/lib/sync";
import { getSystemStat, getSystemStatNumber } from "@/lib/system-repository";
import { listCronJobs } from "@/lib/cron-repository";
import { listSessions } from "@/lib/session-repository";
import { logApiError } from "@/lib/api-logger";
import { getGatewayPlatforms, db } from "@/lib/db";

// ── Types ───────────────────────────────────────────────────

interface CronJobBrief {
  id: string;
  name: string;
  state: string;
  enabled: boolean;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  lastStatus: string | null;
}

interface SessionBrief {
  id: string;
  modified: string;
  size: number;
}

interface MonitorData {
  cron: {
    total: number;
    active: number;
    paused: number;
    jobs: CronJobBrief[];
  };
  sessions: {
    total: number;
    recent: SessionBrief[];
  };
  gateway: {
    platforms: Record<string, boolean>;
    connectedCount: number;
  };
  memory: {
    factCount: number;
    dbSize: string;
    provider: string;
  };
  errors: Array<{
    source: string;
    message: string;
    timestamp: string;
    severity: string;
  }>;
  system: {
    uptime: string;
    configPresent: boolean;
    soulPresent: boolean;
  };
  sync: {
    lastRun: string | null;
    allSuccessful: boolean;
    sourceStatuses: Record<string, string>;
  };
}

// ── Helpers ─────────────────────────────────────────────────

/** Convert a CronJobRecord to the brief shape the frontend expects. */
function toCronJobBrief(
  job: import("@/lib/cron-repository").CronJobRecord
): CronJobBrief {
  return {
    id: job.id,
    name: job.name,
    state: job.state,
    enabled: job.enabled,
    schedule: job.schedule_display || job.schedule,
    lastRun: job.last_run_at,
    nextRun: job.next_run_at,
    lastStatus: job.last_status,
  };
}

/** Convert a SessionRecord to the brief shape the frontend expects. */
function toSessionBrief(
  session: import("@/lib/session-repository").SessionRecord
): SessionBrief {
  return {
    id: session.id,
    modified: session.endedAt || session.startedAt,
    size: session.size,
  };
}

// ── Route ───────────────────────────────────────────────────

export async function GET() {
  try {
    // Ensure sync layer is active (idempotent)
    ensureSyncLayer();

    // ── Cron Jobs (from DB) ─────────────────────────────────
    const allJobs = listCronJobs();
    const activeJobs = allJobs.filter((j) => j.enabled && j.state !== "completed");
    const pausedJobs = allJobs.filter((j) => !j.enabled);

    // ── Sessions (from DB — recent 5) ───────────────────────
    const { sessions: recentSessions } = listSessions({ limit: 5 });

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
    const recentErrors = db()
      .prepare(
        "SELECT source, message, timestamp, severity FROM error_log_entries ORDER BY timestamp DESC LIMIT 10"
      )
      .all() as Array<{ source: string; message: string; timestamp: string; severity: string }>;

    // ── System Info (from meta table) ───────────────────────
    const configPresent = getSystemStat("config.present") === "true";
    const soulPresent = getSystemStat("config.soul_present") === "true";

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
      cron: {
        total: allJobs.length,
        active: activeJobs.length,
        paused: pausedJobs.length,
        jobs: allJobs.map(toCronJobBrief),
      },
      sessions: {
        total: getSystemStatNumber("sessions.total", 0),
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
      },
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
    logApiError("GET /api/monitor", "aggregating monitor data", error);
    return NextResponse.json(
      { error: "Failed to read system monitor data" },
      { status: 500 }
    );
  }
}
