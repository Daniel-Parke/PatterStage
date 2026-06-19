// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/suites — client-safe benchmark suite catalogue
//
// Returns metadata only (key, name, version, description, item + per-domain
// counts). NEVER returns prompts or answer keys — suites stay private so the
// benchmark can't be gamed from the browser.
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listSuiteMeta } from "@/lib/benchmarks/suites";

export async function GET() {
  try {
    return ok({ suites: listSuiteMeta() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/suites", "list", error, "Failed to list suites");
  }
}
