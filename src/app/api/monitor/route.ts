// ═══════════════════════════════════════════════════════════════
// /api/monitor/route.ts — System monitor (DB-centric)
//
// Reads from SQLite tables (synced by the background SyncScheduler)
// instead of direct filesystem operations. Sub-millisecond reads.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { execSync } from "child_process";

import { ensureSyncLayer, getSyncScheduler } from "@/lib/sync";
import { getSystemStat, getSystemStatNumber } from "@/lib/system-repository";
import { logApiError } from "@/lib/api-logger";

// ── Types ───────────────────────────────────────────────────

interface MonitorData {
  cron: {
    total: number;
    active: number;
    paused: number;
  };
  sessions: {
    total: number;
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

function getUptime(): string {
  try {
    const output = execSync("uptime -p", { timeout: 3000, encoding: "utf-8" }).trim();
    return output.replace("up ", "").trim();
  } catch {
    return "N/A";
  }
}

// ── Route ───────────────────────────────────────────────────

export async function GET() {
  try {
    // Ensure sync layer is active (idempotent)
    ensureSyncLayer();

    // ── Cron Jobs (from meta table) ─────────────────────────
    const cronTotal = getSystemStatNumber("cron.total", 0);

    // ── Sessions (from meta table) ──────────────────────────
    const sessionsTotal = getSystemStatNumber("sessions.total", 0);

    // ── Gateway Platforms (from DB) ─────────────────────────
    const { db } = await import("@/lib/db");
    const platformsRaw = db()
      .prepare("SELECT platform, enabled, bot_token_present FROM gateway_platforms")
      .all() as Array<{ platform: string; enabled: number; bot_token_present: number }>;

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
        "SELECT source, message, timestamp FROM error_log_entries ORDER BY timestamp DESC LIMIT 10"
      )
      .all() as Array<{ source: string; message: string; timestamp: string }>;

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
        total: cronTotal,
        active: cronTotal, // Derived from sync status
        paused: 0,
      },
      sessions: {
        total: sessionsTotal,
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
        uptime: getUptime(),
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
