// ═══════════════════════════════════════════════════════════════
// /api/backup — list the database backups, and take one
//
// GET  → { dbPath, dir, backups, restoreCommand }. A read: it creates no
//        directory and takes no guard, because a read-only install that
//        cannot see its own backups cannot be read at all.
// POST → takes a `manual` snapshot and answers 201 { backup }.
//
// Neither handler reads a body or a path segment: the label is a server-side
// allow-list value and the directory is derived, so nothing a caller sends can
// steer the filesystem. Restoring is not here — it is a shell step with the
// server stopped, and the card shows the command rather than running it.
// ═══════════════════════════════════════════════════════════════

import { recordEvent } from "@/lib/analytics/record-event";
import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { created, ok } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { databaseBackupsDir, listDatabaseBackups, restoreCommand, snapshotDatabase } from "@/lib/db/backup";
import { getDbPath } from "@/lib/paths";
import { messageFromError } from "@/lib/api-fetch";

export async function GET(): Promise<Response> {
  try {
    const dbPath = getDbPath();
    return ok({
      dbPath,
      dir: databaseBackupsDir(),
      backups: listDatabaseBackups(),
      // A template, not a command for one file: the operator pastes the name
      // of the backup they picked in place of the placeholder.
      restoreCommand: restoreCommand(dbPath, "<backup file>"),
    });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/backup",
      "listing the database backups",
      error,
      "Failed to list the database backups",
    );
  }
}

export async function POST(): Promise<Response> {
  // Read-only mode. NOT authentication: src/proxy.ts authenticates every
  // request and already refuses unsafe methods under PS_READ_ONLY. This is the
  // belt, spelled with the resource's name so the refusal says what it refused.
  const readOnly = requireNotReadOnly("database backups");
  if (readOnly) return readOnly;

  try {
    const backup = await snapshotDatabase("manual");
    appendAuditLine({ action: "backup.create", resource: backup.name, ok: true });
    // After the file exists, never before it: an event is a claim that the
    // write happened.
    recordEvent("backup.taken", {
      entityType: "backup",
      entityId: backup.name,
      metadata: { bytes: backup.bytes, label: "manual" },
    });
    return created({ backup });
  } catch (error) {
    appendAuditLine({
      action: "backup.create",
      resource: "database",
      ok: false,
      detail: messageFromError(error, "unknown error"),
    });
    return serverErrorFromCatch(
      "POST /api/backup",
      "taking a database backup",
      error,
      "Failed to take a database backup",
    );
  }
}
