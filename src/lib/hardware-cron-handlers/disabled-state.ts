// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/disabled-state.ts - the disabled-id sidecar
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/cron/hardware route god-file. Crontab has no
// "disabled" concept, so PatterStage keeps the set of paused job ids in a
// JSON sidecar next to the data dir. This module owns that file and
// nothing else: read it, write it, and apply a tri-state enable flag.

import * as fs from "fs";
import { join } from "path";

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { conflict } from "@/lib/api-response";
import { PS_DATA_DIR } from "@/lib/paths";

const DISABLED_STATE_FILE = join(PS_DATA_DIR, ".disabled_hardware_crons.json");

/**
 * Read the sidecar honestly: absent, corrupt, or the ids.
 *
 * The three-way split is the whole point, and a blanket catch collapsed it.
 * ABSENT is not a failure: nothing has ever been paused, which is an ordinary
 * state. PRESENT BUT UNREADABLE is, because this file IS the record of which
 * jobs the operator paused, and every mutating handler does load-mutate-save.
 * Degrading a failed read to an empty Set therefore writes that emptiness back
 * and un-pauses every job the operator had paused (T-0060).
 *
 * Module-private on purpose: the two exported readers below carry the decision
 * about what to DO with a corrupt file, and that decision differs by caller.
 */
function readDisabledIds(): { ok: true; ids: Set<string> } | { ok: false; error: string } {
  let raw: string;
  try {
    raw = fs.readFileSync(DISABLED_STATE_FILE, "utf-8");
  } catch (err) {
    // ENOENT is the ABSENT case and is not a failure: nothing has ever been
    // paused. Told apart by the error code rather than a preceding existsSync,
    // which would be a second syscall and a TOCTOU gap for the same answer.
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ok: true, ids: new Set() };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "expected a JSON array of job ids" };
  }
  return { ok: true, ids: new Set(parsed.map(String)) };
}

/**
 * The READ-path degrade. Contract unchanged: GET /api/cron/hardware must still
 * list jobs when the sidecar is unreadable, because a read that refuses to read
 * strands the operator on the one page that would let them fix it. The jobs
 * simply all show as enabled, which is what the crontab itself says.
 *
 * NEVER call this on a path that goes on to SAVE. Use readDisabledIdsForWrite.
 */
export function loadDisabledIds(): Set<string> {
  const result = readDisabledIds();
  return result.ok ? result.ids : new Set();
}

/**
 * The WRITE-path read: the ids, or the response to return instead.
 *
 * Three handlers need the identical refusal and it has to name the file, so the
 * `Set | NextResponse` shape plus an `instanceof` check at the call site is the
 * idiom `parseJsonBody` already uses in these same handlers.
 */
export function readDisabledIdsForWrite(): Set<string> | NextResponse {
  const result = readDisabledIds();
  if (result.ok) return result.ids;
  logApiError("cron/hardware", "readDisabledIdsForWrite", new Error(result.error));
  return conflict(
    `The paused-jobs list at ${DISABLED_STATE_FILE} could not be read (${result.error}), ` +
      `so this change was refused rather than written over it. ` +
      `Repair or delete that file and retry. Deleting it means "no jobs are paused".`,
  );
}

/** Persist the set of disabled hardware cron job IDs */
export function saveDisabledIds(ids: Set<string>): void {
  try {
    fs.writeFileSync(DISABLED_STATE_FILE, JSON.stringify(Array.from(ids), null, 2), { mode: 0o600 });
  } catch (err) {
    logApiError("cron/hardware", "saveDisabledIds", err);
  }
}

/**
 * Apply an enable/disable flag to the disabledIds set:
 *   enabled === false → add
 *   enabled === true  → delete
 *   enabled === undefined → no-op (skip)
 *
 * Shared by PUT (toggle-only branch) and PUT (non-toggle branch's
 * post-write sync), so the "if (enabled === false) add else delete"
 * tri-state lives in exactly one place.
 */
function setDisabled(disabledIds: Set<string>, id: string, enabled: boolean | undefined): void {
  if (enabled === undefined) return;
  if (enabled === false) {
    disabledIds.add(id);
  } else {
    disabledIds.delete(id);
  }
}

/**
 * Compose `setDisabled` (mutate the in-memory set) with `saveDisabledIds`
 * (persist to disk) so PUT's two call sites collapse to a single call.
 * Byte-equivalent to the inline pair — `setDisabled` is a no-op when
 * `enabled` is undefined, matching the original call sites.
 */
export function applyDisabledChange(
  disabledIds: Set<string>,
  id: string,
  enabled: boolean | undefined,
): void {
  setDisabled(disabledIds, id, enabled);
  saveDisabledIds(disabledIds);
}
