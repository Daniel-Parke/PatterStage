import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/seed/clean — preview (GET) + purge (POST) throwaway test data
// ═══════════════════════════════════════════════════════════════

import { ok, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { snapshotDatabase } from "@/lib/db/backup";
import { cleanDevData, previewDevDataCleanup } from "@/lib/seed/clean-dev-data";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/seed/clean", "preview", "Failed to preview dev data", async (_request: NextRequest) => {
  return ok({ preview: previewDevDataCleanup() });
});

export const POST = route("POST /api/seed/clean", "clean", "Failed to clean dev data", async (_request: NextRequest) => {
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
});
