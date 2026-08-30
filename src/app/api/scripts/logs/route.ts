// ═══════════════════════════════════════════════════════════════
// GET /api/scripts/logs?name=<file.sh>&lines=N — tail a script's log.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest } from "@/lib/api-response";
import { tailScriptLog } from "@/lib/scripts-manager";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  if (!name) return badRequest("name is required");
  const linesParam = Number(searchParams.get("lines"));
  const lines = Number.isFinite(linesParam) && linesParam > 0 ? Math.min(linesParam, 2000) : 200;

  try {
    const log = tailScriptLog(name, lines);
    return ok({ name, log: log ?? "", hasLog: log !== null });
  } catch (error) {
    return serverErrorFromCatch("GET /api/scripts/logs", name, error, "Failed to read script log");
  }
}
