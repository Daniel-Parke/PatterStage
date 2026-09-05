// ═══════════════════════════════════════════════════════════════
// POST /api/scripts/run — run a host script on demand ({ name }).
// Path-validated under PS_DATA_DIR/scripts; no shell, no user args.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { isReadOnly, requireAuthenticatedHostWrites } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { readOnlyMessage } from "@/lib/read-only";
import { parseJsonBody } from "@/lib/parse-json-body";
import { runScriptFile } from "@/lib/scripts-manager";
import { recordEvent } from "@/lib/analytics/record-event";

export async function POST(request: NextRequest) {
  // This is the route that EXECUTES on the host. Its siblings that write the
  // script carried this guard from the start; the one that runs it did not
  // (T-0095, D42). The proxy refuses the same request first; this is the belt.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) return serviceUnavailable(readOnlyMessage("scripts cannot be run"));

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const name = typeof (bodyResult as { name?: unknown }).name === "string" ? (bodyResult as { name: string }).name : "";
  if (!name) return badRequest("name is required");

  try {
    const result = await runScriptFile(name);
    if (!result.ok && result.exitCode === null) return notFound(result.error ?? "Script not found");
    // The operator ran it; the exit code is what happened (T-0098).
    recordEvent("script.run", { entityType: "script", entityId: name, metadata: { exitCode: result.exitCode } });
    return ok({ name, exitCode: result.exitCode, ok: result.ok });
  } catch (error) {
    return serverErrorFromCatch("POST /api/scripts/run", name, error, "Failed to run script");
  }
}
