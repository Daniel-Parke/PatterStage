import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { relative, resolve } from "path";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import {
  categorizeLogFileGroup,
  compareLogFileNames,
  sanitizeLogBasename,
} from "@/lib/log-files";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import type { ApiResponse } from "@/types/hermes";

function logFileUnderLogsDir(logsDir: string, logPath: string): boolean {
  const R = resolve(logsDir);
  const C = resolve(logPath);
  if (C === R) return false;
  const rel = relative(R, C);
  return rel !== "" && !rel.startsWith("..") && !rel.includes("..");
}

export interface LogFileMeta {
  name: string;
  size: number;
  modified: string;
  group: ReturnType<typeof categorizeLogFileGroup>;
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

export async function GET(request: Request) {
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

    const availableLogs: LogFileMeta[] = [];
    try {
      const files = readdirSync(logsDir);
      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        const base = file.slice(0, -4);
        if (sanitizeLogBasename(base) !== base) continue;
        const filePath = logsDir + "/" + file;
        const stats = statSync(filePath);
        availableLogs.push({
          name: base,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          group: categorizeLogFileGroup(base),
        });
      }
    } catch (err) {
      logApiError("GET /api/logs", "listing available logs", err);
    }

    availableLogs.sort((a, b) => compareLogFileNames(a.name, b.name));

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

    const stats = statSync(logPath);
    const content = readFileSync(logPath, "utf-8");
    const allLines = content.split("\n").filter((line) => line.length > 0);
    const lines = allLines.slice(-maxLines).reverse();

    // Fallback timestamp: use file mtime for lines that have no parseable timestamp.
    // Format must match RE_SPACE_TS so the frontend parseLogLine() recognizes it.
    const fileMtime = stats.mtime.toISOString().replace("T", " ").slice(0, 19);
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
        totalLines: allLines.length,
        showingLines: lines.length,
        size: stats.size,
        modified: stats.mtime.toISOString(),
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
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
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
      const resolvedLogsDir = resolve(logsDir);
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

    const files = readdirSync(logsDir);
    let cleared = 0;
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      const base = file.slice(0, -4);
      if (sanitizeLogBasename(base) !== base) continue;
      const filePath = resolve(logsDir, file);
      const resolvedLogsDir = resolve(logsDir);
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
