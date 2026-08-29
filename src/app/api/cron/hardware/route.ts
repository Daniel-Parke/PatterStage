import { NextRequest } from "next/server";

import { requireAuthenticatedHostWrites, isReadOnly } from "@/lib/api-auth";
import { serviceUnavailable } from "@/lib/api-response";
import { readOnlyMessage } from "@/lib/read-only";
import { handleCreateHardwareCron } from "@/lib/hardware-cron-handlers/create";
import { handleDeleteHardwareCron } from "@/lib/hardware-cron-handlers/delete";
import { handleListHardwareCrons } from "@/lib/hardware-cron-handlers/list";
import { handleUpdateHardwareCron } from "@/lib/hardware-cron-handlers/update";

/**
 * Hardware Cron API — System crontab management
 *
 * GET    /api/cron/hardware         — List all hardware cron jobs
 * POST   /api/cron/hardware         — Create a new hardware cron job (or { action: "pauseAll" } to disable all)
 * PUT    /api/cron/hardware         — Update an existing hardware cron job
 * DELETE /api/cron/hardware?id=...  — Delete a hardware cron job by ID
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
 * This file is a thin auth + gate + dispatch layer. The work lives under
 * src/lib/hardware-cron-handlers/:
 *
 *   crontab-command.ts  turn caller text into a safe crontab line
 *   crontab-store.ts    read/parse/serialise the crontab itself
 *   disabled-state.ts   the paused-job id sidecar
 *   list/create/update/delete.ts   one per HTTP verb
 *
 * Authentication is enforced once in src/proxy.ts, and so is read-only mode,
 * which refuses unsafe methods before any handler runs. No route in this
 * directory carries either check (T-0048).
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
