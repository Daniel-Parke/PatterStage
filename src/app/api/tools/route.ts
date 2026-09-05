import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/tools — Hermes toolset catalog (read-only reference)
// ═══════════════════════════════════════════════════════════════
// Runtime tool access is configured per profile via platform_toolsets
// (Operations → Tools). This route does not control Hermes runtime.

import { requireNotReadOnly } from "@/lib/api-auth";
import { methodNotAllowed, ok } from "@/lib/api-response";
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
// It used to cite `api/agent/personality`'s GET handler as the matching shape.
// That handler does not exist and has not for some time -- the route is
// PUT-only, and T-0083 gave it a GET that answers 405. A comment naming a
// sibling that is not there sends the next reader looking for a precedent
// rather than at the code in front of them.
export async function GET() {
  return ok({
    platforms: HERMES_PLATFORMS,
    toolsets: HERMES_CONFIGURABLE_TOOLSETS,
  });
}

export async function POST(_request: NextRequest) {
  const ro = requireNotReadOnly("tool mutations are disabled");
  if (ro) return ro;

  return methodNotAllowed(
    "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Operations → Tools (profile-scoped platform_toolsets).", ["GET"]);
}
