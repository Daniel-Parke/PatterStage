import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { getChHardwareLogDir, getChScriptsDir } from "@/lib/paths";

/**
 * GET /api/cron/hardware/meta — scriptsDir + logDir for UI (single source of truth).
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    return NextResponse.json({
      data: {
        scriptsDir: getChScriptsDir(),
        logDir: getChHardwareLogDir(),
      },
    });
  } catch (e: unknown) {
    logApiError("GET /api/cron/hardware/meta", "paths", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
