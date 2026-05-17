/**
 * Hermes log file basenames (no directory, no .log suffix in API `name` param).
 */

export const MAX_LOG_BASENAME_LEN = 128;

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
