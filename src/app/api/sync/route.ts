// ═══════════════════════════════════════════════════════════════
// /api/sync/route.ts — Sync status and control
//
// GET  /api/sync       — Status of all sync sources
// POST /api/sync       — Trigger a force sync ("Sync Now")
// POST /api/sync?source=cron — Trigger a single source
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api/api-response";
import { route } from "@/lib/api/api-route";

import { ensureSyncLayer, getSyncScheduler, runFullSync } from "@/lib/sync";
import { logApiError } from "@/lib/api/api-logger";

async function GETImpl(_request: NextRequest) {
  return route("GET /api/sync", "reading sync status", "Failed to read sync status", async () => {
    ensureSyncLayer();
    const scheduler = getSyncScheduler();

    if (!scheduler) {
      return ok({
        running: false,
        sources: [],
        lastCycle: null,
      });
    }

    const lastCycle = scheduler.getLastCycleResult();
    return ok({
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
    });
  })();
}

async function POSTImpl(request: NextRequest) {
  try {
    ensureSyncLayer();

    const source = request.nextUrl.searchParams.get("source");

    if (source) {
      const scheduler = getSyncScheduler();
      if (!scheduler) {
        return serverError("Sync scheduler not initialized");
      }
      const result = await scheduler.runOne(source);
      return ok({
        sourceName: result.sourceName,
        success: result.success,
        syncedCount: result.syncedCount,
        error: result.error,
        durationMs: result.durationMs,
      });
    }

    // Full sync cycle
    const result = await runFullSync();
    return ok({
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
    });
  } catch (error) {
    logApiError("POST /api/sync", "triggering sync", error);
    return serverError("Failed to trigger sync: " + String(error));
  }
}

export const GET = guardRoute(GETImpl);
export const POST = guardRoute(POSTImpl);
