import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// GET /api/scripts — list host script files under PS_DATA_DIR/scripts
// with each file's schedule (host crontab) + last-run hint.
// Scheduling CRUD stays on /api/cron/hardware; running + logs are siblings here.
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listScriptFiles } from "@/lib/scripts-manager";

export async function GET(_request: NextRequest) {
  try {
    const scripts = await listScriptFiles();
    return ok({ scripts, total: scripts.length });
  } catch (error) {
    return serverErrorFromCatch("GET /api/scripts", "list", error, "Failed to list scripts");
  }
}
