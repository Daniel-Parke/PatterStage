import { NextRequest } from "next/server";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";

import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import {
  listLogFilesInDir,
  logFileUnderLogsDir,
  logValidationError,
  readLastLines,
  resolveLogFilePath,
} from "@/lib/fs/log-files";
import { injectMissingTimestamps } from "@/lib/log-line-format";

import { badRequest, notFound, notFoundWith, ok } from "@/lib/api-response";
import { recordEvent } from "@/lib/analytics/record-event";
import type { LogFileMeta } from "@/lib/fs/log-files";

// ── Shared log directory resolution ──────────────────────────

interface LogsDirResult {
  logsDir: string;
  resolvedLogsDir: string;
}

/**
 * Resolve the active agent's logs directory and its resolved form.
 * Returns null when the directory doesn't exist (caller handles 404).
 */
function resolveLogsDir(): LogsDirResult | null {
  const logsDir = getAgentWorkspace().logs;
  if (!existsSync(logsDir)) return null;
  return { logsDir, resolvedLogsDir: resolve(logsDir) };
}

export interface LogGetData {
  name: string;
  totalLines: number;
  showingLines: number;
  size: number;
  modified: string;
  lines: string[];
  availableLogs: LogFileMeta[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedLines = parseInt(searchParams.get("lines") || "200", 10);
    const maxLines = Number.isFinite(parsedLines) ? Math.min(parsedLines, 1000) : 200;

    const dirResult = resolveLogsDir();
    if (!dirResult) {
      // The DIRECTORY is missing, which is the normal state of a fresh install
      // that has not run the agent yet. T-0071 taught the sibling 404 -- the one
      // for a missing FILE -- to carry the available-log list so the page could
      // pick a different one, and never touched this branch. So the page got a
      // bare 404, showed "No matching log files", and rendered an ERROR as an
      // EMPTY STATE: the operator could not tell "you have no logs" from "I
      // could not look" (T-0079).
      return notFoundWith(
        "No logs directory found. The agent has not written any logs yet — this is normal " +
          "on a fresh install, and the directory appears the first time it runs.",
        { availableLogs: [] as LogFileMeta[], logsDirMissing: true, noLogsYet: true },
      );
    }
    const { logsDir, resolvedLogsDir } = dirResult;

    let availableLogs: LogFileMeta[] = [];
    try {
      availableLogs = listLogFilesInDir(logsDir);
    } catch (err) {
      logApiError("GET /api/logs", "listing available logs", err);
    }

    const resolved = resolveLogFilePath(
      logsDir,
      resolvedLogsDir,
      searchParams.get("name"),
    );
    if (!resolved.ok) {
      return badRequest(logValidationError(resolved.reason));
    }
    const { safeName, absolutePath: logPath } = resolved;

    if (!existsSync(logPath)) {
      // The directory exists but holds NO log files: the same fresh-install
      // state as a missing directory, and it got the same red banner. Driving
      // a clean instance found it (T-0087). `noLogsYet` is what the page reads
      // for its calm state; `logsDirMissing` stays for the directory case.
      if (availableLogs.length === 0) {
        return notFoundWith(
          "No log files yet. The agent has not written any logs - this is normal on a fresh install, " +
            "and they appear the first time it runs.",
          { availableLogs, noLogsYet: true },
        );
      }
      // The list is already in hand, and the page's "auto-select the first
      // available log" effect cannot fire without it. `activeLog` starts at a
      // hard-coded "agent", so an install whose logs directory has no agent.log
      // used to 404 on every poll with no way to correct itself (T-0071).
      return notFoundWith(`Log file '${safeName}.log' not found`, { availableLogs });
    }

    const { allLines, lines, mtime, size } = readLastLines(logPath, maxLines);

    // Fallback timestamp must match RE_SPACE_TS so parseLogLine() recognises it.
    const fileMtime = mtime.toISOString().replace("T", " ").slice(0, 19);
    const linesWithTimestamp = injectMissingTimestamps(lines, fileMtime);

    // The other read event (operator ruling, T-0111). Emitted only on the path
    // that actually hands back a file's lines: a 404 for a missing directory or
    // a rejected name is not somebody reading their logs.
    recordEvent("logs.opened", { entityType: "log", entityId: safeName });

    return ok({
      name: safeName,
      totalLines: allLines,
      showingLines: lines.length,
      size: size,
      modified: mtime.toISOString(),
      lines: linesWithTimestamp,
      availableLogs,
    });
  } catch (error) {
    return serverErrorFromCatch("GET /api/logs", "reading logs", error, "Failed to read logs");
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const logName = searchParams.get("name");

  const dirResult = resolveLogsDir();
  if (!dirResult) {
    return notFound("No logs directory found");
  }
  const { logsDir, resolvedLogsDir } = dirResult;

  try {
    if (logName) {
      const resolved = resolveLogFilePath(logsDir, resolvedLogsDir, logName);
      if (!resolved.ok) {
        return badRequest(logValidationError(resolved.reason));
      }
      if (existsSync(resolved.absolutePath)) {
        writeFileSync(resolved.absolutePath, "");
      }
      return ok({ deleted: resolved.safeName });
    }

    const files = listLogFilesInDir(logsDir);
    let cleared = 0;
    for (const file of files) {
      const filePath = resolve(logsDir, `${file.name}.log`);
      if (logFileUnderLogsDir(resolvedLogsDir, filePath)) {
        writeFileSync(filePath, "");
        cleared++;
      }
    }
    return ok({ cleared });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/logs", "deleting log", error, "Failed to delete logs");
  }
}
