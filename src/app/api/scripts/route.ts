// ═══════════════════════════════════════════════════════════════
// GET /api/scripts — list host script files under PS_DATA_DIR/scripts
// with each file's schedule and last-run hint, plus whether this host has a
// scheduler of its own (T-0107, decision 10). A page that knows the answer can
// write the right kind of schedule and say which it wrote.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/api-response";
import { hostSchedulerAvailability } from "@/lib/host/host-scheduler";
import { listScriptFiles } from "@/lib/scripts/scripts-manager";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/scripts", "list", "Failed to list scripts", async (_request: NextRequest) => {
  const scripts = await listScriptFiles();
  return ok({ scripts, total: scripts.length, scheduler: hostSchedulerAvailability() });
});
