// ═══════════════════════════════════════════════════════════════
// POST /api/scripts/run — run a host script on demand ({ name }).
// Path-validated under PS_DATA_DIR/scripts; no shell, no user args.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { runScriptFile } from "@/lib/scripts-manager";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) return serviceUnavailable("PatterStage is in read-only mode");

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const name = typeof (bodyResult as { name?: unknown }).name === "string" ? (bodyResult as { name: string }).name : "";
  if (!name) return badRequest("name is required");

  try {
    const result = await runScriptFile(name);
    if (!result.ok && result.exitCode === null) return notFound(result.error ?? "Script not found");
    return ok({ name, exitCode: result.exitCode, ok: result.ok });
  } catch (error) {
    return serverErrorFromCatch("POST /api/scripts/run", name, error, "Failed to run script");
  }
}
