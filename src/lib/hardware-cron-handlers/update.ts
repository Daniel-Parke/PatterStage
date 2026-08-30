// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/update.ts - PUT /api/cron/hardware
// ═══════════════════════════════════════════════════════════════
//
// Two shapes hide under one verb. A toggle-only PUT (enabled, nothing
// else) never touches the crontab: it moves the id in the disabled
// sidecar and, on Windows, flips the scheduled task. Any other PUT
// rewrites the managed line from scratch.

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromError } from "@/lib/api-logger";
import { badRequest, notFound, ok, serverErrorFromHelperResult } from "@/lib/api-response";
import { getHostScheduler } from "@/lib/host-scheduler";
import { parseJsonBody } from "@/lib/parse-json-body";

import {
  canonicaliseScriptsCommand,
  rejectIfBadSchedule,
  resolveCronLogFile,
  sanitiseCronName,
} from "./crontab-command";
import {
  joinCrontabLines,
  parseCrontabLine,
  readCrontab,
  serialiseLine,
  writeCrontab,
} from "./crontab-store";
import { applyDisabledChange, readDisabledIdsForWrite } from "./disabled-state";

export async function handleUpdateHardwareCron(request: NextRequest): Promise<NextResponse> {
  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    const { id, schedule, command, name, logFile, enabled } = body as {
      id?: string;
      schedule?: string;
      command?: string;
      name?: string;
      logFile?: string;
      enabled?: boolean;
    };

    if (!id) {
      return badRequest("id is required");
    }

    if (schedule !== undefined) {
      const badSchedule = rejectIfBadSchedule(schedule);
      if (badSchedule) return badSchedule;
    }

    const crontab = await readCrontab();
    // Refuse before setEnabled or writeCrontab: a refusal that has already
    // changed the machine is not a refusal.
    const disabledIds = readDisabledIdsForWrite();
    if (disabledIds instanceof NextResponse) return disabledIds;
    const lines = crontab.split("\n");
    const newLines: string[] = [];
    let found = false;
    let rewriteError: NextResponse | null = null;

    // Separate: only toggle changes JSON; schedule/command/name changes rewrite crontab
    const isToggleOnly =
      enabled !== undefined &&
      schedule === undefined &&
      command === undefined &&
      name === undefined &&
      logFile === undefined;

    const safeName = sanitiseCronName(name);

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === id) {
        found = true;

        // Only rewrite crontab for non-toggle changes
        if (!isToggleOnly) {
          const newSchedule = schedule || parsed.schedule;
          // Re-derive the command every time we rewrite, from the caller's input
          // or from what is already installed — never trust either verbatim.
          const canonical = canonicaliseScriptsCommand(command || parsed.command);
          if (!canonical.ok) {
            rewriteError = canonical.response;
            newLines.push(line);
            continue;
          }
          const newLogFile = resolveCronLogFile(logFile ?? parsed.logFile, id);
          if (!newLogFile) {
            rewriteError = badRequest("logFile must be a plain '*.log' filename.");
            newLines.push(line);
            continue;
          }
          // Remove preceding comment if it was for this entry
          if (newLines.length > 0 && newLines[newLines.length - 1].startsWith("# ")) {
            newLines.pop();
          }
          if (safeName) newLines.push(`# ${safeName}`);
          newLines.push(serialiseLine(newSchedule, canonical.command, newLogFile));
        }
      } else {
        newLines.push(line);
      }
    }

    if (!found) {
      return notFound(`Hardware cron job '${id}' not found`);
    }
    if (rewriteError) return rewriteError;

    // Toggle-only: update JSON state (UI). On Windows also enable/disable the
    // scheduled task; no-op on Unix where the JSON is the source of truth.
    if (isToggleOnly) {
      await getHostScheduler().setEnabled(id, enabled!);
      applyDisabledChange(disabledIds, id, enabled);
      return ok({ id, enabled });
    }

    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    // Sync disabled state to JSON for this job
    if (enabled !== undefined) {
      applyDisabledChange(disabledIds, id, enabled);
    }

    return ok({ id, schedule, command, name, logFile, enabled });
  } catch (e: unknown) {
    return serverErrorFromError("PUT /api/cron/hardware", "update hardware cron", e, "Failed to update hardware cron job");
  }
}
