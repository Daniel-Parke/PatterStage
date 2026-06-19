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
// Auth: requires an authenticated session, like every other admin
// route. Read-only mode (CH_READ_ONLY=true) blocks the write path;
// dry-run is allowed in read-only mode for inspection.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  closeOrphanedActiveSessions,
  previewOrphanSweep,
} from "@/lib/session-sync";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { serviceUnavailable } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { logApiError } from "@/lib/api-logger";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  let body: { dryRun?: boolean } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  } catch {
    // empty body is fine — defaults to dryRun=false
  }
  const dryRun = body.dryRun !== false; // default to dry-run for safety

  if (dryRun === false && isChReadOnly()) {
    return serviceUnavailable(
      "Control Hub is in read-only mode (set CH_READ_ONLY=false to allow backfill writes)"
    );
  }

  try {
    const database = db();
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
