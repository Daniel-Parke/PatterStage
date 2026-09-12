// ═══════════════════════════════════════════════════════════════
// POST /api/scripts/run — run a host script on demand ({ name }).
// Path-validated under PS_DATA_DIR/scripts; no shell, no user args.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { isReadOnly, requireAuthenticatedHostWrites } from "@/lib/api/api-auth";
import { serverErrorFromCatch } from "@/lib/api/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api/api-response";
import { readOnlyMessage } from "@/lib/api/read-only";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { runScriptFile } from "@/lib/scripts/scripts-manager";
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
    if (result.outcome === "not-started") {
      // A script that is not there is a lookup that found nothing: a 404, and
      // nothing to record, because nobody ran anything.
      if (result.startFailure === "script-missing") return notFound(result.error ?? "Script not found");
      const reason = result.error ?? "the host could not start it";
      // Recorded under its own type, never as `script.run`: the ledger's
      // record of a run is a record of a script that ran.
      recordEvent("script.run_not_started", { entityType: "script", entityId: name, metadata: { reason } });
      // Not a 200 with a failure buried in the body. The host was asked to run
      // a script and could not, so a client that reads only the status must
      // not be told this worked.
      return serviceUnavailable(`${name} did not start: ${reason}`);
    }
    // The operator ran it; the exit code is what happened (T-0098), and the
    // outcome says whether that code is a success.
    recordEvent("script.run", {
      entityType: "script",
      entityId: name,
      metadata: { outcome: result.outcome, exitCode: result.exitCode },
    });
    return ok({ name, outcome: result.outcome, exitCode: result.exitCode, ok: result.ok });
  } catch (error) {
    return serverErrorFromCatch("POST /api/scripts/run", name, error, "Failed to run script");
  }
}
