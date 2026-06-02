import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import {
  listLogFilesInDir,
  logFileUnderLogsDir,
  logValidationError,
  readLastLines,
  resolveLogFilePath,
} from "@/lib/log-files";
import { injectMissingTimestamps } from "@/lib/log-line-format";
import { requireAuth } from "@/lib/api-auth";
import { ApiResponse } from "@/types/hermes";
import type { LogFileMeta } from "@/lib/log-files";

// ── Shared log directory resolution ──────────────────────────

interface LogsDirResult {
  logsDir: string;
  resolvedLogsDir: string;
}

/**
 * Resolve the active Hermes logs directory and its resolved form.
 * Returns null when the directory doesn't exist (caller handles 404).
 */
function resolveLogsDir(): LogsDirResult | null {
  const logsDir = getActiveHermesPaths().logs;
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
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const parsedLines = parseInt(searchParams.get("lines") || "200", 10);
    const maxLines = Number.isFinite(parsedLines) ? Math.min(parsedLines, 1000) : 200;

    const dirResult = resolveLogsDir();
    if (!dirResult) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "No logs directory found" },
        { status: 404 },
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
      return NextResponse.json<ApiResponse<never>>(
        { error: logValidationError(resolved.reason) },
        { status: 400 },
      );
    }
    const { safeName, absolutePath: logPath } = resolved;

    if (!existsSync(logPath)) {
      return NextResponse.json<ApiResponse<never>>(
        { error: `Log file '${safeName}.log' not found` },
        { status: 404 },
      );
    }

    const { allLines, lines, mtime, size } = readLastLines(logPath, maxLines);

    // Fallback timestamp must match RE_SPACE_TS so parseLogLine() recognises it.
    const fileMtime = mtime.toISOString().replace("T", " ").slice(0, 19);
    const linesWithTimestamp = injectMissingTimestamps(lines, fileMtime);

    return NextResponse.json<ApiResponse<LogGetData>>({
      data: {
        name: safeName,
        totalLines: allLines,
        showingLines: lines.length,
        size: size,
        modified: mtime.toISOString(),
        lines: linesWithTimestamp,
        availableLogs,
      },
    });
  } catch (error) {
    logApiError("GET /api/logs", "reading logs", error);
    return NextResponse.json<ApiResponse<never>>(
      { error: "Failed to read logs" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const logName = searchParams.get("name");

  const dirResult = resolveLogsDir();
  if (!dirResult) {
    return NextResponse.json<ApiResponse<never>>(
      { error: "No logs directory found" },
      { status: 404 },
    );
  }
  const { logsDir, resolvedLogsDir } = dirResult;

  try {
    if (logName) {
      const resolved = resolveLogFilePath(logsDir, resolvedLogsDir, logName);
      if (!resolved.ok) {
        return NextResponse.json<ApiResponse<never>>(
          { error: logValidationError(resolved.reason) },
          { status: 400 },
        );
      }
      if (existsSync(resolved.absolutePath)) {
        writeFileSync(resolved.absolutePath, "");
      }
      return NextResponse.json<ApiResponse<{ deleted: string }>>({
        data: { deleted: resolved.safeName },
      });
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
    return NextResponse.json<ApiResponse<{ cleared: number }>>({
      data: { cleared },
    });
  } catch (error) {
    logApiError("DELETE /api/logs", "deleting log", error);
    return NextResponse.json<ApiResponse<never>>(
      { error: "Failed to delete logs" },
      { status: 500 },
    );
  }
}
