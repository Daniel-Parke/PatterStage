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

import { logApiError } from "@/lib/api-logger";
import { PS_DATA_DIR } from "@/lib/paths";

const DISABLED_STATE_FILE = join(PS_DATA_DIR, ".disabled_hardware_crons.json");

/** Load the set of disabled hardware cron job IDs */
export function loadDisabledIds(): Set<string> {
  try {
    const raw = fs.readFileSync(DISABLED_STATE_FILE, "utf-8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
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
