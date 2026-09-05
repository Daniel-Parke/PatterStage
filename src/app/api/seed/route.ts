// ═══════════════════════════════════════════════════════════════
// /api/seed — what the app ships, and putting any of it back
// ═══════════════════════════════════════════════════════════════
//
// A replace overwrites rows the operator may have edited, so it takes a
// database snapshot first and refuses outright if it cannot (T-0100, D113). A
// merge only fills gaps, so it takes none.
import { existsSync } from "fs";

import { NextRequest, NextResponse } from "next/server";

import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { snapshotDatabase } from "@/lib/db/backup";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { seedPostSchema } from "@/lib/api-schemas";
import { runCatalogSeed, getSeedState, readShippedPackCounts } from "@/lib/seed/catalog-seed";
import { importHermesStateFromDisk } from "@/modules/hermes/lib/state-import";
import { getHermesHome } from "@/modules/hermes/lib/home";

export async function GET() {
  try {
    const state = getSeedState();
    // The pack is what the page counts against. Read from disk, so a fresh
    // install says "0 of 7 agents" rather than "0 professional agents".
    return ok({ state, pack: readShippedPackCounts() });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/seed",
      "state",
      error,
      "Failed to read seed state",
    );
  }
}

export async function POST(request: NextRequest) {
  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseAndValidateJsonBody → parseJsonBody) rather than 500.
  // seedPostSchema validates target/mode against the canonical enums and
  // folds the legacy `id` alias back to `templateId` via .transform() —
  // previously the route did `body.target as SeedTarget["target"]` with
  // no validation, so a foreign value would silently reach runCatalogSeed.
  const refusal = requireNotReadOnly("restore");
  if (refusal) return refusal;

  const parsed = await parseAndValidateJsonBody(request, seedPostSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { target = "all", mode = "merge", slug, templateId } = parsed;

  try {
    // A replace overwrites rows the operator may have edited. The snapshot is
    // taken before anything runs, and a snapshot that fails stops the restore:
    // an overwrite with no way back is the one outcome this page must not have.
    let backup = null;
    if (mode === "replace") {
      try {
        backup = await snapshotDatabase("pre-restore");
      } catch (error) {
        return serverError(
          `Refused: could not take a backup before restoring (${
            error instanceof Error ? error.message : String(error)
          })`,
        );
      }
    }

    const hermesHome = getHermesHome();
    const imported = existsSync(hermesHome + "/config.yaml")
      ? importHermesStateFromDisk()
      : null;
    const result = runCatalogSeed({ target, mode, slug, templateId });
    appendAuditLine({
      action: "seed.restore",
      resource: `${target}/${mode}${slug ? `/${slug}` : templateId ? `/${templateId}` : ""}`,
      ok: true,
    });
    return ok({ ...result, imported, backup });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/seed",
      "seed",
      error,
      "Failed to run seed",
    );
  }
}
