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
      return notFound("No logs directory found");
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
