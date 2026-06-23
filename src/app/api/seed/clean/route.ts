// ═══════════════════════════════════════════════════════════════
// /api/seed/clean — preview (GET) + purge (POST) throwaway test data
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { cleanDevData, previewDevDataCleanup } from "@/lib/seed/clean-dev-data";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    return ok({ preview: previewDevDataCleanup() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/seed/clean", "preview", error, "Failed to preview dev data");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const result = cleanDevData();
    appendAuditLine({ action: "seed.clean_dev_data", resource: `${result.counts.total} items`, ok: true });
    return ok(result);
  } catch (error) {
    return serverErrorFromCatch("POST /api/seed/clean", "clean", error, "Failed to clean dev data");
  }
}
