// ═══════════════════════════════════════════════════════════════
// /api/status/route.ts — System status (DB-centric)
//
// Reads from the meta table (synced by ConfigSync, SessionSync, MemorySync)
// instead of recursive filesystem walks.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { ensureSyncLayer } from "@/lib/sync";
import { getSystemStat, getSystemStatNumber } from "@/lib/system-repository";
import { logApiError } from "@/lib/api-logger";

export async function GET() {
  try {
    ensureSyncLayer();

    const soulPresent = getSystemStat("config.soul_present") === "true";
    const configPresent = getSystemStat("config.present") === "true";
    const skillsCount = getSystemStatNumber("skills.count", 0);
    const sessionsTotal = getSystemStatNumber("sessions.total", 0);
    const memoryDbSize = getSystemStat("memory.db_size") ?? "N/A";

    return NextResponse.json({
      data: {
        soulFile: soulPresent,
        configFile: configPresent,
        skillsCount,
        sessionsCount: sessionsTotal,
        memorySize: memoryDbSize,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logApiError("GET /api/status", "reading system status", error);
    return NextResponse.json(
      { error: "Failed to read system status" },
      { status: 500 }
    );
  }
}
