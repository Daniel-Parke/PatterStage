// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/create.ts - POST /api/cron/hardware
// ═══════════════════════════════════════════════════════════════
//
// Three actions share the POST verb: `pauseAll`, `sync` and the default
// create-or-replace. They are grouped here because all three read the
// crontab first and all three answer on the same body-parse.

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromError } from "@/lib/api-logger";
import { badRequest, ok, serverErrorFromHelperResult } from "@/lib/api-response";
import { getHostScheduler } from "@/lib/host-scheduler";
import { parseJsonBody } from "@/lib/parse-json-body";
import { recordEvent } from "@/lib/analytics/record-event";
import { SCRIPT_EXT_RE } from "@/lib/scripts/script-ext";

import {
  canonicaliseScriptsCommand,
  rejectIfBadSchedule,
  resolveCronLogFile,
  sanitiseCronName,
} from "./crontab-command";
import {
  joinCrontabLines,
  parseCrontabLine,
  readAndParseCrontab,
  readCrontab,
  serialiseLine,
  writeCrontab,
} from "./crontab-store";
import { readDisabledIdsForWrite, saveDisabledIds } from "./disabled-state";

export async function handleCreateHardwareCron(request: NextRequest): Promise<NextResponse> {
  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    // ── pauseAll action ────────────────────────────────────────────────
    if ((body as Record<string, unknown>).action === "pauseAll") {
      const disabledIds = readDisabledIdsForWrite();
      if (disabledIds instanceof NextResponse) return disabledIds;
      const crontab = await readCrontab();
      const lines = crontab.split("\n");
      const jobIds: string[] = [];

      for (const line of lines) {
        const parsed = parseCrontabLine(line);
        if (parsed) {
          jobIds.push(parsed.id);
          disabledIds.add(parsed.id);
          await getHostScheduler().setEnabled(parsed.id, false);
        }
      }

      saveDisabledIds(disabledIds);
      return ok({ success: true, pausedCount: jobIds.length });
    }

    // ── Sync action ───────────────────────────────────────────────────
    // Re-read crontab and return all detected hardware cron jobs.
    // This picks up any jobs added or modified outside PatterStage.
    if ((body as Record<string, unknown>).action === "sync") {
      const { jobs } = await readAndParseCrontab();
      return ok({ jobs, total: jobs.length });
    }

    // ── Create new hardware cron job ────────────────────────────────────
    const { schedule, command, name, logFile } = body as {
      schedule?: string;
      command?: string;
      name?: string;
      logFile?: string;
    };

    if (!schedule || !command) {
      return badRequest("schedule and command are required");
    }

    const badSchedule = rejectIfBadSchedule(schedule);
    if (badSchedule) return badSchedule;

    const canonical = canonicaliseScriptsCommand(command);
    if (!canonical.ok) return canonical.response;

    const crontab = await readCrontab();
    const lines = crontab.split("\n");

    // Check if this script already has an entry (replace if so)
    const entryId = canonical.scriptName.replace(SCRIPT_EXT_RE, "") || "hw";

    const resolvedLog = resolveCronLogFile(logFile, entryId);
    if (!resolvedLog) return badRequest("logFile must be a plain '*.log' filename.");
    const safeName = sanitiseCronName(name);
    const newLine = serialiseLine(schedule, canonical.command, resolvedLog);
    const newLines: string[] = [];
    let replaced = false;

    for (const line of lines) {
      const parsed = parseCrontabLine(line);
      if (parsed && parsed.id === entryId) {
        // Replace existing entry for this script
        if (safeName) {
          newLines.push(`# ${safeName}`);
        }
        newLines.push(newLine);
        replaced = true;
      } else {
        newLines.push(line);
      }
    }

    if (!replaced) {
      if (safeName) {
        newLines.push(`# ${safeName}`);
      }
      newLines.push(newLine);
    }

    // Write crontab synchronously (execSync is acceptable here — it is a
    // single blocking call with no async I/O available for crontab writes).
    const result = await writeCrontab(joinCrontabLines(newLines));
    if (!result.ok) {
      return serverErrorFromHelperResult(result, "unknown error");
    }

    recordEvent("script.scheduled", { entityType: "script", entityId: canonical.scriptName, metadata: { schedule } });

    // Echo what was actually installed, not what was asked for.
    return ok({ id: entryId, schedule, command: canonical.command, name: safeName, logFile: resolvedLog });
  } catch (e: unknown) {
    return serverErrorFromError("POST /api/cron/hardware", "create hardware cron", e, "Failed to create hardware cron job");
  }
}
