import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import {
  listLogFilesInDir,
  logFileUnderLogsDir,
  sanitizeLogBasename,
  readLastLines,
} from "@/lib/log-files";
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

    const rawName = searchParams.get("name");
    const safeName =
      rawName === null || rawName.trim() === ""
        ? "agent"
        : sanitizeLogBasename(rawName);
    if (safeName === null) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "Invalid log name" },
        { status: 400 },
      );
    }
    const logPath = resolve(logsDir, `${safeName}.log`);

    if (!logFileUnderLogsDir(resolvedLogsDir, logPath)) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "Invalid log path" },
        { status: 400 },
      );
    }

    if (!existsSync(logPath)) {
      return NextResponse.json<ApiResponse<never>>(
        { error: `Log file '${safeName}.log' not found` },
        { status: 404 },
      );
    }

    const { allLines, lines, mtime, size } = readLastLines(logPath, maxLines);

    // Fallback timestamp: use file mtime for lines that have no parseable timestamp.
    // Format must match RE_SPACE_TS so the frontend parseLogLine() recognizes it.
    const fileMtime = mtime.toISOString().replace("T", " ").slice(0, 19);
    const linesWithTimestamp = lines.map((line) => {
      // Only inject if line is non-empty and has no recognized timestamp pattern.
      if (!line.trim()) return line;
      // Quick check: if it starts with a known timestamp-like pattern, leave it.
      // Patterns: YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:MM:SS, or [YYYY-MM-DD
      if (
        /^\d{4}[-\/]/.test(line) ||
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line) ||
        /^\[\d{4}-\d{2}-\d{2}/.test(line)
      ) {
        return line;
      }
      // Inject mtime prefix: "YYYY-MM-DD HH:MM:SS <original line>"
      return `${fileMtime} ${line}`;
    });

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
      const safe = sanitizeLogBasename(logName);
      if (!safe) {
        return NextResponse.json<ApiResponse<never>>(
          { error: "Invalid log name" },
          { status: 400 },
        );
      }
      const logPath = resolve(logsDir, `${safe}.log`);
      if (!logFileUnderLogsDir(resolvedLogsDir, logPath)) {
        return NextResponse.json<ApiResponse<never>>(
          { error: "Invalid log path" },
          { status: 400 },
        );
      }
      if (existsSync(logPath)) {
        writeFileSync(logPath, "");
      }
      return NextResponse.json<ApiResponse<{ deleted: string }>>({
        data: { deleted: safe },
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
