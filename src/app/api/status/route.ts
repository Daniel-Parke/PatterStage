// ═══════════════════════════════════════════════════════════════
// /api/status/route.ts — System status (DB-centric)
//
// Reads from the meta table (synced by ConfigSync, SessionSync, MemorySync)
// instead of recursive filesystem walks.
//
// EXCEPT the two counts, which are measured here (T-0081). They used to come
// from `skills.count` and `sessions.total`, and nothing in the product has ever
// written either key — so an install with forty skills reported zero, forever,
// and the dashboard presented a default as a measurement. Both are a single
// indexed COUNT against a table this process already has open; routing them
// through a synced key bought nothing and cost the truth.

import { NextResponse } from "next/server";

import { ensureSyncLayer } from "@/lib/sync";
import { getSystemStat } from "@/lib/system-repository";
import { countSkills } from "@/lib/skills-repository";
import { listSessions } from "@/lib/sessions/session-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";

export async function GET() {
  try {
    ensureSyncLayer();

    const soulPresent = getSystemStat("config.soul_present") === "true";
    const configPresent = getSystemStat("config.present") === "true";
    const skillsCount = countSkills();
    const sessionsTotal = listSessions({ limit: 0 }).total;
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
    return serverErrorFromCatch("GET /api/status", "reading system status", error, "Failed to read system status");
  }
}
