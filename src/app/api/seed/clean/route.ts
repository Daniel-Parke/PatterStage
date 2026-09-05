import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/seed/clean — preview (GET) + purge (POST) throwaway test data
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { snapshotDatabase } from "@/lib/db/backup";
import { cleanDevData, previewDevDataCleanup } from "@/lib/seed/clean-dev-data";

export async function GET(_request: NextRequest) {
  try {
    return ok({ preview: previewDevDataCleanup() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/seed/clean", "preview", error, "Failed to preview dev data");
  }
}

export async function POST(_request: NextRequest) {
  try {
    // Deletions with no undo, so the snapshot comes first and a snapshot that
    // fails stops the removal (T-0100, D113).
    let backup;
    try {
      backup = await snapshotDatabase("pre-clean");
    } catch (error) {
      return serverError(
        `Refused: could not take a backup before removing test data (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }

    const result = cleanDevData();
    appendAuditLine({ action: "seed.clean_dev_data", resource: `${result.counts.total} items`, ok: true });
    return ok({ ...result, backup });
  } catch (error) {
    return serverErrorFromCatch("POST /api/seed/clean", "clean", error, "Failed to clean dev data");
  }
}
