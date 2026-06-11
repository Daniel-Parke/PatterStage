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
import { listCronJobs, ensureCronHermesSync } from "@/lib/cron-repository";
import { listSessions } from "@/lib/session-repository";
import { serverErrorFromCatch, logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { getGatewayPlatforms, db } from "@/lib/db";
import type { CronJobBrief, SessionBrief, MonitorData } from "@/types/hermes";

// ── Helpers ─────────────────────────────────────────────────

/** Convert a CronJobRecord to the brief shape the frontend expects. */
function toCronJobBrief(
  job: import("@/lib/cron-repository").CronJobRecord
): CronJobBrief {
  // `schedule` is the canonical machine form (raw 5-field cron, or the
  // legacy "every Nm/Nh/Nd" shorthand) that the schedule-canonicalisation
  // migration (PRs #168 and #170) guarantees lives in the DB column. The
  // human label lives in `schedule_display` and is a separate field on
  // the API response — never fall back to the display string in the
  // machine field. Returning `schedule_display` in `schedule` (the pre-fix
  // behaviour) caused the dashboard's SchedulePicker to read the label as
  // a cron expression and write the label back to the DB on save, making
  // the dashboard itself a corruption vector.
  return {
    id: job.id,
    name: job.name,
    state: job.state,
    enabled: job.enabled,
    schedule: job.schedule,
    schedule_display: job.schedule_display ?? null,
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

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    // Ensure sync layer is active (idempotent)
    ensureSyncLayer();

    // Fire-and-forget cron reconciliation (4th layer). Self-heals any
    // on-disk jobs.json artifact left over from prior broken push paths
    // (see references/cron-startup-reconciliation-2026-06-10.md). Cheap
    // on a healthy system (one disk read, N comparisons, zero pushes);
    // expensive only when the artifact is genuinely stale, which is
    // exactly the failure mode we want to surface. Errors are logged
    // via logApiError — never block the monitor response on the
    // reconciliation.
    void ensureCronHermesSync()
      .then((result) => {
        if (result.errors.length > 0) {
          logApiError(
            "GET /api/monitor",
            "ensureCronHermesSync errors",
            new Error(result.errors.join("; ")),
          );
        }
      })
      .catch((err: unknown) => {
        logApiError("GET /api/monitor", "ensureCronHermesSync threw", err);
      });

    // ── Cron Jobs (from DB) ─────────────────────────────────
    const allJobs = listCronJobs();
    const activeJobs = allJobs.filter((j) => j.enabled && j.state !== "completed");
    const pausedJobs = allJobs.filter((j) => !j.enabled);

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
    return serverErrorFromCatch("GET /api/monitor", "aggregating monitor data", error, "Failed to read system monitor data");
  }
}
