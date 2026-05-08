import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";

import { HERMES_PATHS } from "@/lib/hermes";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import type { ApiResponse } from "@/types/hermes";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const logName = searchParams.get("name") || "agent";
    const parsedLines = parseInt(searchParams.get("lines") || "200", 10);
    const maxLines = Number.isFinite(parsedLines) ? Math.min(parsedLines, 1000) : 200;

    const logsDir = HERMES_PATHS.logs;
    if (!existsSync(logsDir)) {
      return NextResponse.json({ error: "No logs directory found" }, { status: 404 });
    }

    // List available log files
    const availableLogs: Array<{ name: string; size: number; modified: string }> = [];
    try {
      const files = readdirSync(logsDir);
      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = logsDir + "/" + file;
          const stats = statSync(filePath);
          availableLogs.push({
            name: file.replace(".log", ""),
            size: stats.size,
            modified: stats.mtime.toISOString(),
          });
        }
      }
    } catch (err) { logApiError("GET /api/logs", "listing available logs", err); }

    // Sort: agent first, errors second, gateway third, then alphabetical
    const LOG_PRIORITY: Record<string, number> = { agent: 0, errors: 1, gateway: 2 };
    availableLogs.sort((a, b) => {
      const pa = LOG_PRIORITY[a.name] ?? 10;
      const pb = LOG_PRIORITY[b.name] ?? 10;
      return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
    });

    // Read requested log file
    const safeName = logName.replace(/[^a-zA-Z_-]/g, "");
    const logPath = resolve(logsDir, safeName + ".log");
    const resolvedLogsDir = resolve(logsDir);

    // Prevent path traversal: ensure resolved path stays within logs directory
    if (!logPath.startsWith(resolvedLogsDir + "/") && logPath !== resolvedLogsDir) {
      return NextResponse.json(
        { error: "Invalid log path" },
        { status: 400 }
      );
    }

    if (!existsSync(logPath)) {
      return NextResponse.json(
        { error: `Log file '${safeName}.log' not found` },
        { status: 404 }
      );
    }

    const stats = statSync(logPath);
    const content = readFileSync(logPath, "utf-8");
    const allLines = content.split("\n").filter((line) => line.length > 0);
    // Newest first — take last N lines then reverse
    const lines = allLines.slice(-maxLines).reverse();

    return NextResponse.json({
      data: {
        name: safeName,
        totalLines: allLines.length,
        showingLines: lines.length,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        lines,
        availableLogs,
      },
    });
  } catch (error) {
    logApiError("GET /api/logs", "reading logs", error);
    return NextResponse.json(
      { error: "Failed to read logs" },
      { status: 500 }
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

  const logsDir = HERMES_PATHS.logs;
  if (!existsSync(logsDir)) {
    return NextResponse.json({ error: "No logs directory found" }, { status: 404 });
  }

  try {
    if (logName) {
      // Delete specific log file
      const safeName = logName.replace(/[^a-zA-Z_-]/g, "");
      const logPath = resolve(logsDir, safeName + ".log");
      const resolvedLogsDir = resolve(logsDir);
      if (!logPath.startsWith(resolvedLogsDir + "/") && logPath !== resolvedLogsDir) {
        return NextResponse.json({ error: "Invalid log path" }, { status: 400 });
      }
      if (existsSync(logPath)) {
        writeFileSync(logPath, "");
      }
      return NextResponse.json<ApiResponse<{ deleted: string }>>({
        data: { deleted: safeName },
      });
    } else {
      // Clear all log files
      const files = readdirSync(logsDir);
      let cleared = 0;
      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = resolve(logsDir, file);
          const resolvedLogsDir = resolve(logsDir);
          if (filePath.startsWith(resolvedLogsDir + "/") || filePath === resolvedLogsDir) {
            writeFileSync(filePath, "");
            cleared++;
          }
        }
      }
      return NextResponse.json<ApiResponse<{ cleared: number }>>({
        data: { cleared },
      });
    }
  } catch (error) {
    logApiError("DELETE /api/logs", `deleting log`, error);
    return NextResponse.json(
      { error: "Failed to delete logs" },
      { status: 500 }
    );
  }
}
