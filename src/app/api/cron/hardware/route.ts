import { NextRequest } from "next/server";

import { requireAuthenticatedHostWrites, isReadOnly } from "@/lib/api/api-auth";
import { serviceUnavailable } from "@/lib/api/api-response";
import { readOnlyMessage } from "@/lib/api/read-only";
import { handleCreateHardwareCron } from "@/lib/hardware-cron-handlers/create";
import { handleDeleteHardwareCron } from "@/lib/hardware-cron-handlers/delete";
import { handleListHardwareCrons } from "@/lib/hardware-cron-handlers/list";
import { handleUpdateHardwareCron } from "@/lib/hardware-cron-handlers/update";

/**
 * Hardware Cron API — system crontab management. A thin auth + gate +
 * dispatch layer; the work lives under src/lib/hardware-cron-handlers/.
 *
 * Hardware cron jobs are system cron entries managed via crontab(1).
 * They survive agent restarts and run independently of any agent install.
 *
 * Entry format in crontab:
 *   {min} {hour} {dom} {mon} {dow} HOME={homedir} {cmd} >> {log} 2>&1
 *
 * We identify our managed entries by their script path prefix:
 *   PS_SCRIPTS_DIR (default: PS_DATA_DIR/scripts)
 *
 * Authentication is enforced once in src/proxy.ts, and so is read-only mode,
 * which refuses unsafe methods before any handler runs.
 *
 * The three handlers below nonetheless carry an isReadOnly() check of their
 * own, beside requireAuthenticatedHostWrites, and both doublings are
 * deliberate. A crontab line this route writes is executed later by cron, so
 * this is one of the three host-side surfaces proxy.ts:58-63 names: a harness
 * that calls a handler directly, without the proxy, must still be refused.
 * app-06 (ruled 2026-09-12) deleted the eleven route-level read-only checks
 * that were NOT host-side and kept these.
 */

export async function GET(_request: NextRequest) {
  return handleListHardwareCrons();
}

export async function POST(request: NextRequest) {
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable(readOnlyMessage("hardware cron jobs cannot be changed"));
  }

  return handleCreateHardwareCron(request);
}

export async function PUT(request: NextRequest) {
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable(readOnlyMessage("hardware cron jobs cannot be changed"));
  }

  return handleUpdateHardwareCron(request);
}

export async function DELETE(request: NextRequest) {
  // Installing a crontab line makes the host execute code on a timer.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) {
    return serviceUnavailable(readOnlyMessage("hardware cron jobs cannot be changed"));
  }

  return handleDeleteHardwareCron(request);
}
