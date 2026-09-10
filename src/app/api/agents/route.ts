// ═══════════════════════════════════════════════════════════════
// /api/agents/route.ts — Hermes process list (DB-centric)
//
// Reads from the agent_processes table (synced by ProcessSync)
// instead of running execSync on every request.
// ═══════════════════════════════════════════════════════════════

import { readAgentProcesses } from "@/lib/sync/sync-repository";
import { ensureSyncLayer } from "@/lib/sync";
import { ok } from "@/lib/api/api-response";
import type { HermesProcess } from "@/types/console";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/agents", "querying Hermes processes", "Failed to query Hermes processes", async () => {
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
});
