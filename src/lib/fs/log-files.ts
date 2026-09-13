/**
 * Hermes log file basenames (no directory, no .log suffix in API `name` param).
 */

import { closeSync, existsSync, openSync, readFileSync, readdirSync, readSync, statSync } from "fs";
import { relative, resolve } from "path";

const MAX_LOG_BASENAME_LEN = 128;

export type LogFileGroup = "core" | "system" | "other";

export interface LogFileMeta {
  name: string;
  size: number;
  modified: string;
  group: LogFileGroup;
}

/** Allowed characters: letters, digits, dot, underscore, hyphen (no path segments). */
const BASENAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Validate and normalise a log basename for `name` query/body.
 * Returns null if invalid (rejects `..`, empty, oversize, bad chars).
 */
export function sanitizeLogBasename(raw: string): string | null {
  let s = raw.trim();
  if (s.toLowerCase().endsWith(".log")) {
    s = s.slice(0, -4).trim();
  }
  if (!s || s.includes("..") || s.includes("/") || s.includes("\\")) {
    return null;
  }
  if (s.length > MAX_LOG_BASENAME_LEN) {
    return null;
  }
  if (!BASENAME_RE.test(s)) {
    return null;
  }
  return s;
}

export function categorizeLogFileGroup(name: string): LogFileGroup {
  const lower = name.toLowerCase();
  if (lower === "agent" || lower === "errors" || lower === "gateway") {
    return "core";
  }
  if (lower.startsWith("ch-")) {
    return "system";
  }
  return "other";
}

const LOG_SORT_PRIORITY: Record<string, number> = {
  agent: 0,
  errors: 1,
  gateway: 2,
};

export function compareLogFileNames(a: string, b: string): number {
  const pa = LOG_SORT_PRIORITY[a] ?? 10;
  const pb = LOG_SORT_PRIORITY[b] ?? 10;
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b);
}

const CHUNK_SIZE = 64 * 1024; // 64KB — read from end of file in chunks

export interface ReadLastLinesResult {
  allLines: number;
  lines: string[];
  mtime: Date;
  size: number;
}

/**
 * Read the last `maxLines` lines from a file efficiently by reading
 * from the end in chunks. Avoids loading multi-MB log files entirely
 * into memory just to show the last 200 lines.
 * Returns the file's mtime and size alongside the lines so callers don't need
 * a redundant statSync call.
 */
export function readLastLines(filePath: string, maxLines: number): ReadLastLinesResult {
  const stats = statSync(filePath);
  const fileSize = stats.size;
  const mtime = stats.mtime;

  // Small file: read entirely via readFileSync (also supports test mocks)
  if (fileSize <= CHUNK_SIZE) {
    const content = readFileSync(filePath, "utf-8");
    const allLines = content.split("\n").filter(Boolean);
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

      // If this iteration already read from the start of the file, the entire
      // file has been collected and we still have fewer than maxLines lines.
      // Stop — otherwise the back-off below pins offset at 0 with a zero-width
      // read and the loop spins forever (file > CHUNK_SIZE but < maxLines lines).
      if (offset === 0) break;

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

    const allLines = collected.split("\n").filter(Boolean);
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

/**
 * Verify that a resolved log file path falls within the logs directory.
 * Prevents path traversal attacks via symlinks or .. components.
 */
export function logFileUnderLogsDir(logsDir: string, logPath: string): boolean {
  const R = resolve(logsDir);
  const C = resolve(logPath);
  if (C === R) return false;
  const rel = relative(R, C);
  return rel !== "" && !rel.startsWith("..") && !rel.includes("..");
}

/**
 * Resolve a user-supplied log basename to an absolute, validated path.
 *
 * Returns a discriminated union so callers can short-circuit on validation
 * failures with the right HTTP status (400 for invalid name/path, 404 for
 * missing file). The default basename is "agent" when `raw` is null or
 * empty so GET /api/logs has a sensible default target.
 *
 * Path safety: rejects traversal attempts via `sanitizeLogBasename` (no
 * slashes, no `..`, no bad chars) and double-checks the resolved absolute
 * path stays under `logsDir` via `logFileUnderLogsDir`.
 */
export type ResolvedLogFile =
  | { ok: true; safeName: string; absolutePath: string }
  | { ok: false; reason: "invalid-name" }
  | { ok: false; reason: "invalid-path" };

/**
 * Human-readable error message for a `ResolvedLogFile` failure reason.
 * Maps the union discriminant to the user-visible string used by
 * `GET /api/logs` and `DELETE /api/logs`. Add a new branch here when
 * `ResolvedLogFile` grows a new reason.
 */
export function logValidationError(reason: "invalid-name" | "invalid-path"): string {
  return reason === "invalid-name" ? "Invalid log name" : "Invalid log path";
}

export function resolveLogFilePath(
  logsDir: string,
  resolvedLogsDir: string,
  raw: string | null,
): ResolvedLogFile {
  const safeName =
    raw === null || raw.trim() === ""
      ? "agent"
      : sanitizeLogBasename(raw);
  if (safeName === null) {
    return { ok: false, reason: "invalid-name" };
  }
  const absolutePath = resolve(logsDir, `${safeName}.log`);
  if (!logFileUnderLogsDir(resolvedLogsDir, absolutePath)) {
    return { ok: false, reason: "invalid-path" };
  }
  return { ok: true, safeName, absolutePath };
}

/**
 * Collect available `.log` files from a directory.
 * Returns sorted by name priority (core first, then system, then other).
 */
export function listLogFilesInDir(logsDir: string): LogFileMeta[] {
  if (!existsSync(logsDir)) return [];

  const files = readdirSync(logsDir);
  const logs: LogFileMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".log")) continue;
    const base = file.slice(0, -4);
    if (sanitizeLogBasename(base) !== base) continue;
    const filePath = resolve(logsDir, file);
    const stats = statSync(filePath);
    logs.push({
      name: base,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      group: categorizeLogFileGroup(base),
    });
  }

  logs.sort((a, b) => compareLogFileNames(a.name, b.name));
  return logs;
}