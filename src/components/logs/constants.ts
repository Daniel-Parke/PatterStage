// ═══════════════════════════════════════════════════════════════
// Logs Constants — Shared log viewer constants
// ═══════════════════════════════════════════════════════════════

import type { LogFileGroup } from "@/lib/fs/log-files";

/**
 * A log line's SEVERITY, which is deliberately not the status ladder (T-0120).
 *
 * `--color-status-*` says what an entity is DOING - queued, running, failed. A
 * log level says how loud one line is. They collide on error and warn and part
 * company immediately after: a line at `info` is not an entity that is idle,
 * and `debug` has no rung at all. Two of the five do take the status tokens,
 * because a line that reports a failure and a mission that failed should not be
 * two different reds.
 */
export const LEVEL_TEXT_CLASS: Record<string, string> = {
  error: "text-status-fail",
  warn: "text-status-warn",
  debug: "text-ps-text-muted",
  info: "text-ps-text-secondary",
  unknown: "text-ps-text-muted",
};

export const GROUP_ORDER: LogFileGroup[] = ["core", "system", "other"];

export const GROUP_LABELS: Record<LogFileGroup, string> = {
  core: "Core",
  system: "System",
  other: "Other",
};
