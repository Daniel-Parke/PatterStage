// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/delete.ts - DELETE /api/cron/hardware?id=...
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromError } from "@/lib/api-logger";
import { badRequest, notFound, ok, serverErrorFromHelperResult } from "@/lib/api-response";

import {
  joinCrontabLines,
  parseCrontabLine,
  readCrontab,
  writeCrontab,
} from "./crontab-store";
import { applyDisabledChange, readDisabledIdsForWrite } from "./disabled-state";

export async function handleDeleteHardwareCron(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("id is required");
    }

    // HOISTED, deliberately. This read used to sit after writeCrontab, so a
    // refusal here would have left the crontab already rewritten and then
    // answered 409: a half-done delete. Refuse before anything is touched.
    const disabledIds = readDisabledIdsForWrite();
    if (disabledIds instanceof NextResponse) return disabledIds;

    const crontab = await readCrontab();
    const lines = crontab.split("\n");
    const newLines: string[] = [];
    let found = false;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === id) {
        found = true;
        // Skip this line (and preceding comment if any)
        continue;
      }
      // Skip comment lines that immediately precede a deleted entry
      const prev = newLines[newLines.length - 1];
      if (!parsed && prev?.startsWith("# ") && line.trim() === "") {
        newLines.pop();
        continue;
      }
      newLines.push(line);
    }

    if (!found) {
      return notFound(`Hardware cron job '${id}' not found`);
    }

    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    // Remove from disabled set if present (read hoisted above, before any write)
    applyDisabledChange(disabledIds, id, true);

    return ok({ id });
  } catch (e: unknown) {
    return serverErrorFromError("DELETE /api/cron/hardware", "delete hardware cron", e, "Failed to delete hardware cron job");
  }
}
