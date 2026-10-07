// ═══════════════════════════════════════════════════════════════
// /api/admin/sessions/backfill-status — One-shot session sweep
//
// POST /api/admin/sessions/backfill-status
//   { "dryRun": true }   — returns counts that *would* change
//   { "dryRun": false }  — applies the sweep, returns actual counts
//
// Runs the same orphan-close logic the recurring 15s sync uses, but
// as an explicit operator action. Dry-run previews eligible counts by
// source and resulting status. Counts depend on the current data, and
// concurrent synchronisation can change them before a later apply.
// Both modes record an audit entry and return their aggregate counts.
//
// Auth: the proxy authenticates requests before this handler runs.
//
// Read-only mode refuses this endpoint outright, dry-run included, because
// src/proxy.ts rejects unsafe METHODS and this is a POST. The comment here used
// to promise that a dry run was still allowed for inspection; that has not been
// true since the proxy took over enforcement. The redundant inner guard was
// removed; response-settlement checks still protect in-flight requests.
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  closeOrphanedActiveSessions,
  previewOrphanSweep,
} from "@/lib/sessions/session-orphan-sweep";
import { methodNotAllowed } from "@/lib/api/api-response";
import { appendAuditLine } from "@/lib/api/audit-log";
import { logApiError } from "@/lib/api/api-logger";

async function POSTImpl(request: NextRequest) {
  let body: { dryRun?: boolean } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  } catch {
    // An empty body defaults to dryRun=true.
  }
  const dryRun = body.dryRun !== false; // default to dry-run for safety

  try {
    const database = getDb();
    const result = dryRun
      ? previewOrphanSweep(database)
      : closeOrphanedActiveSessions(database, { log: false });

    appendAuditLine({
      action: dryRun ? "sessions.backfill.dryRun" : "sessions.backfill.apply",
      resource: "sessions",
      ok: true,
      detail: `total=${result.total} bySource=${JSON.stringify(result.bySource)} byStatus=${JSON.stringify(result.byNewStatus)}`,
    });

    return NextResponse.json({
      data: {
        dryRun,
        ...result,
      },
    });
  } catch (error) {
    logApiError("POST /api/admin/sessions/backfill-status", "backfill", error);
    appendAuditLine({
      action: "sessions.backfill.error",
      resource: "sessions",
      ok: false,
      detail: String(error),
    });
    return NextResponse.json(
      { error: "Backfill failed" },
      { status: 500 },
    );
  }
}

// Named "status", so a GET is the natural guess — and it is a WRITE: it
// backfills. Saying so is the whole point of this stub.
async function GETImpl() {
  return methodNotAllowed(
    "GET is not supported here — this endpoint BACKFILLS session status and is POST-only", ["POST"]);
}

export const POST = guardRoute(POSTImpl);
export const GET = guardRoute(GETImpl);
