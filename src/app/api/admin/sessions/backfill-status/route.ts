// ═══════════════════════════════════════════════════════════════
// /api/admin/sessions/backfill-status — One-shot session sweep
//
// POST /api/admin/sessions/backfill-status
//   { "dryRun": true }   — returns counts that *would* change
//   { "dryRun": false }  — applies the sweep, returns actual counts
//
// Runs the same orphan-close logic the recurring 15s sync uses, but
// as an explicit operator action. The dry-run mode lets the operator
// see exactly which rows will close before committing. On a fresh
// deploy the "would close" count is in the hundreds (33 mission +
// 202 cron + 57 discord + 43 telegram sessions accumulated before
// the fix landed); the next sync tick would also clean them up, but
// running the backfill explicitly produces an audit-log entry and
// makes the change visible in the admin UI immediately.
//
// Auth: requires an authenticated session, like every other admin route.
//
// Read-only mode refuses this endpoint outright, dry-run included, because
// src/proxy.ts rejects unsafe METHODS and this is a POST. The comment here used
// to promise that a dry run was still allowed for inspection; that has not been
// true since the proxy took over enforcement, and the inner guard below was
// unreachable. Kept as defence-in-depth under the shared message (T-0048).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  closeOrphanedActiveSessions,
  previewOrphanSweep,
} from "@/lib/sessions/session-orphan-sweep";
import { isReadOnly } from "@/lib/api-auth";
import { serviceUnavailable, methodNotAllowed } from "@/lib/api-response";
import { readOnlyMessage } from "@/lib/read-only";
import { appendAuditLine } from "@/lib/audit-log";
import { logApiError } from "@/lib/api-logger";

export async function POST(request: NextRequest) {
  let body: { dryRun?: boolean } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  } catch {
    // empty body is fine — defaults to dryRun=false
  }
  const dryRun = body.dryRun !== false; // default to dry-run for safety

  if (dryRun === false && isReadOnly()) {
    return serviceUnavailable(
      readOnlyMessage("the orphan-session backfill cannot write")
    );
  }

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
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — this endpoint BACKFILLS session status and is POST-only", ["POST"]);
}
