// ═══════════════════════════════════════════════════════════════
// GET /api/scripts — list host script files under PS_DATA_DIR/scripts
// with each file's schedule and last-run hint, plus whether this host has a
// scheduler of its own (T-0107, decision 10). A page that knows the answer can
// write the right kind of schedule and say which it wrote.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { hostSchedulerAvailability } from "@/lib/host-scheduler";
import { listScriptFiles } from "@/lib/scripts-manager";

export async function GET(_request: NextRequest) {
  try {
    const scripts = await listScriptFiles();
    return ok({ scripts, total: scripts.length, scheduler: hostSchedulerAvailability() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/scripts", "list", error, "Failed to list scripts");
  }
}
