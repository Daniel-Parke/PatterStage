// ═══════════════════════════════════════════════════════════════
// /api/agents/route.ts — Hermes process list (DB-centric)
//
// Reads from the agent_processes table (synced by ProcessSync)
// instead of running execSync on every request.
// ═══════════════════════════════════════════════════════════════

import { readAgentProcesses } from "@/lib/sync/sync-repository";
import { ensureSyncLayer } from "@/lib/sync";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import type { HermesProcess } from "@/types/console";

export async function GET() {
  try {
    // Ensure sync layer is active so process data is fresh
    ensureSyncLayer();

    // Read from the agent_processes table
    const rows = readAgentProcesses();

    const processes: HermesProcess[] = rows.map((r) => ({
      id: r.id,
      type: r.type as HermesProcess["type"],
      name: r.name,
      status: r.status as HermesProcess["status"],
      startedAt: r.last_activity, // best approximation
      lastActivity: r.last_activity,
      model: r.model,
      pid: r.pid,
      turns: r.turns,
    }));

    const runningCount = processes.filter((p) => p.status === "running").length;
    const idleCount = processes.filter((p) => p.status === "idle").length;

    return ok({
      processes,
      total: processes.length,
      running: runningCount,
      idle: idleCount,
    });
  } catch (err) {
    // serverErrorFromCatch wraps `logApiError(...) + NextResponse.json({error}, {status:500})`
    // — same wire shape (the helper's body is literally that composition).
    // Migrated from the inline form in session 172 to match every other
    // List 3 API route's catch-block convention (sessions 70, 72, 76, 80).
    return serverErrorFromCatch(
      "GET /api/agents",
      "querying Hermes processes",
      err,
      "Failed to query Hermes processes",
    );
  }
}
