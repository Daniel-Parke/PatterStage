// ═══════════════════════════════════════════════════════════════
// GET /api/scripts — list host script files under CH_DATA_DIR/scripts
// with each file's schedule (host crontab) + last-run hint.
// Scheduling CRUD stays on /api/cron/hardware; running + logs are siblings here.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listScriptFiles } from "@/lib/scripts-manager";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const scripts = await listScriptFiles();
    return ok({ scripts, total: scripts.length });
  } catch (error) {
    return serverErrorFromCatch("GET /api/scripts", "list", error, "Failed to list scripts");
  }
}
