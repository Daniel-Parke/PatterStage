import type { NextRequest } from "next/server";


import { logApiError } from "@/lib/api-logger";
import { ok, serverError } from "@/lib/api-response";
import { getPsHardwareLogDir, getPsScriptsDir } from "@/lib/paths";
import { toError } from "@/lib/api-fetch";

/**
 * GET /api/cron/hardware/meta — scriptsDir + logDir for UI (single source of truth).
 */
export async function GET(_request: NextRequest) {
  try {
    return ok({
      scriptsDir: getPsScriptsDir(),
      logDir: getPsHardwareLogDir(),
    });
  } catch (e: unknown) {
    logApiError("GET /api/cron/hardware/meta", "paths", e);
    return serverError(toError(e).message);
  }
}
