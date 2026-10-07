// ═══════════════════════════════════════════════════════════════
// GET /api/scripts/logs?name=<file.sh>&lines=N — tail a script's log.
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { route } from "@/lib/api/api-route";
import { NextRequest } from "next/server";

import { ok, badRequest } from "@/lib/api/api-response";
import { tailScriptLog } from "@/lib/scripts/scripts-manager";

async function GETImpl(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  if (!name) return badRequest("name is required");
  const linesParam = Number(searchParams.get("lines"));
  const lines = Number.isFinite(linesParam) && linesParam > 0 ? Math.min(linesParam, 2000) : 200;

  return route("GET /api/scripts/logs", name, "Failed to read script log", async () => {
    const log = tailScriptLog(name, lines);
    return ok({ name, log: log ?? "", hasLog: log !== null });
  })();
}

export const GET = guardRoute(GETImpl);
