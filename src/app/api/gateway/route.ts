// ═══════════════════════════════════════════════════════════════
// /api/gateway/route.ts — Gateway platforms (DB-centric)
//
// Reads from the gateway_platforms table (synced by EnvSync)
// instead of parsing .env on every request.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { ensureSyncLayer } from "@/lib/sync";
import { logApiError } from "@/lib/api-logger";

export async function GET() {
  try {
    ensureSyncLayer();

    const { db } = await import("@/lib/db");

    const platforms = db()
      .prepare("SELECT platform, enabled, bot_token_present, last_synced_at FROM gateway_platforms")
      .all() as Array<{
      platform: string;
      enabled: number;
      bot_token_present: number;
      last_synced_at: string;
    }>;

    const platformStatus: Record<string, { enabled: boolean; tokenPresent: boolean }> = {};
    for (const p of platforms) {
      platformStatus[p.platform] = {
        enabled: p.enabled === 1,
        tokenPresent: p.bot_token_present === 1,
      };
    }

    return NextResponse.json({
      data: {
        platforms: platformStatus,
        connectedCount: platforms.filter((p) => p.enabled === 1 || p.bot_token_present === 1).length,
        lastSynced: platforms.length > 0 ? platforms[0].last_synced_at : null,
      },
    });
  } catch (error) {
    logApiError("GET /api/gateway", "reading gateway platforms", error);
    return NextResponse.json(
      { error: "Failed to read gateway platforms" },
      { status: 500 }
    );
  }
}
