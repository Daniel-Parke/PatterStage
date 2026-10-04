import { guardRoute } from "@/lib/api/response-route";
import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/tools — Hermes toolset catalog (read-only reference)
// ═══════════════════════════════════════════════════════════════
// Runtime tool access is configured per profile via platform_toolsets
// (Agent → Tools). This route does not control Hermes runtime.

import { methodNotAllowed, ok } from "@/lib/api/api-response";
import {
  HERMES_CONFIGURABLE_TOOLSETS,
  HERMES_PLATFORMS,
} from "@/modules/hermes/lib/toolset-catalog";

// The GET handler is a pure constant read — `ok()` cannot throw and
// the two catalog constants are statically imported. The 7-line
// try/catch + `serverErrorFromCatch` that used to wrap the call site
// was dead code: there is no I/O, no JSON parse, no DB query, and no
// file read. Migrated from the List 3 dead-code sweep.
//
async function GETImpl() {
  return ok({
    platforms: HERMES_PLATFORMS,
    toolsets: HERMES_CONFIGURABLE_TOOLSETS,
  });
}

async function POSTImpl(_request: NextRequest) {
  return methodNotAllowed(
    "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Agent → Tools (profile-scoped platform_toolsets).", ["GET"]);
}

export const GET = guardRoute(GETImpl);
export const POST = guardRoute(POSTImpl);
