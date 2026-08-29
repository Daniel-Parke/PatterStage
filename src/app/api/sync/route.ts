// ═══════════════════════════════════════════════════════════════
// /api/sync/route.ts — Sync status and control
//
// GET  /api/sync       — Status of all sync sources
// POST /api/sync       — Trigger a force sync ("Sync Now")
// POST /api/sync?source=cron — Trigger a single source
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { ensureSyncLayer, getSyncScheduler, runFullSync } from "@/lib/sync";
import { logApiError } from "@/lib/api-logger";

export async function GET(_request: NextRequest) {
  try {
    ensureSyncLayer();
    const scheduler = getSyncScheduler();

    if (!scheduler) {
      return NextResponse.json({
        data: {
          running: false,
          sources: [],
          lastCycle: null,
        },
      });
    }

    const lastCycle = scheduler.getLastCycleResult();
    return NextResponse.json({
      data: {
        running: scheduler.isRunning,
        sources: scheduler.getSourceNames(),
        // Per-source liveness: which sources are currently in-flight, and
        // which errored on their last run. The watchdog and the dashboard
        // can use these to detect a wedged scheduler without polling every
        // route. See SyncScheduler for the per-source timeout.
        inFlight: scheduler.getRunningSources(),
        lastErrorBySource: scheduler.getLastErrorBySource(),
        lastCycle: lastCycle
          ? {
              completedAt: lastCycle.completedAt,
              totalDurationMs: lastCycle.totalDurationMs,
              allSuccessful: lastCycle.allSuccessful,
              results: lastCycle.results.map((r) => ({
                sourceName: r.sourceName,
                success: r.success,
                syncedCount: r.syncedCount,
                error: r.error,
                durationMs: r.durationMs,
              })),
            }
          : null,
      },
    });
  } catch (error) {
    logApiError("GET /api/sync", "reading sync status", error);
    return NextResponse.json(
      { error: "Failed to read sync status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureSyncLayer();

    const source = request.nextUrl.searchParams.get("source");

    if (source) {
      const scheduler = getSyncScheduler();
      if (!scheduler) {
        return NextResponse.json(
          { error: "Sync scheduler not initialized" },
          { status: 500 }
        );
      }
      const result = await scheduler.runOne(source);
      return NextResponse.json({
        data: {
          sourceName: result.sourceName,
          success: result.success,
          syncedCount: result.syncedCount,
          error: result.error,
          durationMs: result.durationMs,
        },
      });
    }

    // Full sync cycle
    const result = await runFullSync();
    return NextResponse.json({
      data: {
        completedAt: result.completedAt,
        totalDurationMs: result.totalDurationMs,
        allSuccessful: result.allSuccessful,
        results: result.results.map((r) => ({
          sourceName: r.sourceName,
          success: r.success,
          syncedCount: r.syncedCount,
          error: r.error,
          durationMs: r.durationMs,
        })),
      },
    });
  } catch (error) {
    logApiError("POST /api/sync", "triggering sync", error);
    return NextResponse.json(
      { error: "Failed to trigger sync: " + String(error) },
      { status: 500 }
    );
  }
}
