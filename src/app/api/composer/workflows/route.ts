// ═══════════════════════════════════════════════════════════════
// GET /api/composer/workflows — list available Composer workflow definitions
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listWorkflows } from "@/lib/composer/composer-repository";

export async function GET() {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  try {
    ensureDb();
    return ok({ workflows: listWorkflows() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/composer/workflows", "list", error, "Failed to list workflows");
  }
}
