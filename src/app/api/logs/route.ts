import { NextRequest, NextResponse } from "next/server";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import {
  listLogFilesInDir,
  logFileUnderLogsDir,
  sanitizeLogBasename,
} from "@/lib/log-files";
import { requireAuth } from "@/lib/api-auth";
import { ApiResponse } from "@/types/hermes";
import type { LogFileMeta } from "@/lib/log-files";

const CHUNK_SIZE = 64 * 1024; // 64KB — read from end of file in chunks

export interface LogGetData {
  name: string;
  totalLines: number;
  showingLines: number;
  size: number;
  modified: string;
  lines: string[];
  availableLogs: LogFileMeta[];
}

interface ReadLastLinesResult {
  allLines: number;
  lines: string[];
  mtime: Date;
  size: number;
}

/**
 * Read the last `maxLines` lines from a file efficiently by reading
 * from the end in chunks. Avoids loading multi-MB log files entirely
 * into memory just to show the last 200 lines.
 * Returns the file's mtime alongside the lines so callers don't need
 * a redundant statSync call.
 */
function readLastLines(filePath: string, maxLines: number): ReadLastLinesResult {
  const stats = statSync(filePath);
  const fileSize = stats.size;
  const mtime = stats.mtime;

  // Small file: read entirely via readFileSync (also supports test mocks)
  if (fileSize <= CHUNK_SIZE) {
    const content = readFileSync(filePath, "utf-8");
    const allLines = content.split("\n").filter((l) => l.length > 0);
    return {
      allLines: allLines.length,
      lines: allLines.slice(-maxLines).reverse(),
      mtime,
      size: fileSize,
    };
  }

  // Large file: read chunks from the end
  const fd = openSync(filePath, "r");
  try {
    let collected = "";
    let bytesToRead = Math.min(CHUNK_SIZE, fileSize);
    let offset = fileSize - bytesToRead;
    let lineCount = 0;

    // Read chunks from the end until we have enough lines or hit the start
    while (offset >= 0 && lineCount < maxLines) {
      const buf = Buffer.alloc(bytesToRead);
      readSync(fd, buf, 0, bytesToRead, offset);
      const chunk = buf.toString("utf-8");
      collected = chunk + collected;

      // Count lines in what we've collected
      lineCount = 0;
      for (let i = 0; i < collected.length; i++) {
        if (collected[i] === "\n") lineCount++;
      }

      if (lineCount >= maxLines) break;

      // Move back and read the previous chunk
      offset -= CHUNK_SIZE;
      if (offset < 0) {
        // Read from start with adjusted size
        bytesToRead = CHUNK_SIZE + offset;
        offset = 0;
      } else {
        bytesToRead = CHUNK_SIZE;
      }
    }

    const allLines = collected.split("\n").filter((l) => l.length > 0);
    return {
      allLines: allLines.length,
      lines: allLines.slice(-maxLines).reverse(),
      mtime,
      size: fileSize,
    };
  } finally {
    closeSync(fd);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const parsedLines = parseInt(searchParams.get("lines") || "200", 10);
    const maxLines = Number.isFinite(parsedLines) ? Math.min(parsedLines, 1000) : 200;

    const logsDir = getActiveHermesPaths().logs;
    if (!existsSync(logsDir)) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "No logs directory found" },
        { status: 404 },
      );
    }

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
    const logPath = resolve(logsDir, safeName + ".log");
    const resolvedLogsDir = resolve(logsDir);

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

  const logsDir = getActiveHermesPaths().logs;
  if (!existsSync(logsDir)) {
    return NextResponse.json<ApiResponse<never>>(
      { error: "No logs directory found" },
      { status: 404 },
    );
  }
  const resolvedLogsDir = resolve(logsDir);

  try {
    if (logName) {
      const safe = sanitizeLogBasename(logName);
      if (!safe) {
        return NextResponse.json<ApiResponse<never>>(
          { error: "Invalid log name" },
          { status: 400 },
        );
      }
      const logPath = resolve(logsDir, safe + ".log");
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
      const filePath = resolve(logsDir, file.name + ".log");
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
