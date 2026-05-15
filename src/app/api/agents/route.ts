// ═══════════════════════════════════════════════════════════════
// /api/agents/route.ts — Hermes process list (DB-centric)
//
// Reads from the agent_processes table (synced by ProcessSync)
// instead of running execSync on every request.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { ensureSyncLayer } from "@/lib/sync";
import { logApiError } from "@/lib/api-logger";

interface HermesProcess {
  id: string;
  type: "cron" | "gateway" | "manual" | "subagent";
  name: string;
  status: "running" | "idle";
  startedAt: string | null;
  lastActivity: string | null;
  model: string;
  pid: number | null;
  turns: number;
}

export async function GET() {
  try {
    // Ensure sync layer is active so process data is fresh
    ensureSyncLayer();

    const { db } = await import("@/lib/db");

    // Read from the agent_processes table
    const rows = db()
      .prepare(
        "SELECT id, type, name, status, pid, model, turns, last_activity, last_seen_at FROM agent_processes ORDER BY type, name"
      )
      .all() as Array<{
      id: string;
      type: string;
      name: string;
      status: string;
      pid: number | null;
      model: string;
      turns: number;
      last_activity: string | null;
      last_seen_at: string;
    }>;

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

    return NextResponse.json({
      data: {
        processes,
        total: processes.length,
        running: runningCount,
        idle: idleCount,
      },
    });
  } catch (err) {
    logApiError("GET /api/agents", "querying Hermes processes", err);
    return NextResponse.json(
      { error: "Failed to query Hermes processes: " + String(err) },
      { status: 500 }
    );
  }
}
