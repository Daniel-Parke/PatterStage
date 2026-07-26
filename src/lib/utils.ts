// ═══════════════════════════════════════════════════════════════
// Shared Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a JSON string safely, returning a fallback value on error.
 * Use for all JSON.parse calls where malformed data could exist (e.g. DB fields).
 */
export function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

/** Capitalise the first letter of a string. */
export function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format an ISO timestamp as a relative time string ("5m ago", "2h ago", etc.)
 *
 * @param now - Optional reference time (ms epoch). Defaults to `Date.now()`.
 *              Pass an explicit value in tests or in render loops that need
 *              a stable "now" across many calls.
 */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "never";
  const diff = now - ts;
  if (isNaN(diff) || diff < 0) return "never";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Format a future ISO timestamp as a relative duration ("5m", "2h 30m", etc.)
 *
 * @param now - Optional reference time (ms epoch). Defaults to `Date.now()`.
 *              Pass an explicit value in tests or in render loops that need
 *              a stable "now" across many calls.
 */
export function timeUntil(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "—";
  const diff = ts - now;
  if (isNaN(diff) || diff < 0) return "overdue";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainderMins = mins % 60;
  if (remainderMins === 0) return `${hours}h`;
  return `${hours}h ${remainderMins}m`;
}

/**
 * Format the elapsed time since a startedAt ISO timestamp as
 * "Xs / Xm Ys / Xh Ym" — used for active sessions where we want
 * a live, monotonically-increasing duration. Returns an empty
 * string when the timestamp can't be parsed.
 *
 * Distinct from timeAgo: timeAgo produces "5m ago" and rounds
 * down to coarse buckets (m/h/d). formatElapsed produces a
 * finer-grained "Xh Ym Zs" string suitable for the active-session
 * badge where every second counts.
 *
 * @param now - Optional reference time (ms epoch). Defaults to `Date.now()`.
 *              Pass an explicit value in tests or in render loops that need
 *              a stable "now" across many calls.
 */
export function formatElapsed(startedAt: string, now: number = Date.now()): string {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "";
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Format bytes as human-readable size string
 */
export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || isNaN(bytes)) return String(bytes) + " B";
  if (bytes === 0) return "0 B";
  if (bytes < 0) return String(bytes) + " B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Truncate a string to a max length with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * English noun pluralisation: appends `"s"` when `count !== 1`.
 *
 * This is the *suffix*-only variant — the canonical English rule for
 * "1 message / 2 messages" and the rule used at 6 sites across the
 * codebase (chat page session count, SkillSelector, MentalModelsTab,
 * DirectivesTab, ModelSyncButtons, useModelsPage). Returns `""` for
 * `count === 1` and `"s"` otherwise. Callers compose it into JSX as
 * `{count} thing{pluralise(count)}` or into template strings as
 * `` `${count} thing${pluralise(count)}` ``.
 *
 * The helper is intentionally minimal (no irregulars, no `y → ies`):
 * all 6 call sites use the simple `s`-suffix rule, and any future
 * irregular-plural site should adopt a domain-specific helper rather
 * than overloading this one. If a "child/children" or "person/people"
 * call site appears, promote that to a separate `pluraliseIrregular`
 * or to a per-domain helper at the call site.
 *
 * Byte-equivalent to the inline `${n} foo${n !== 1 ? "s" : ""}` form
 * for all 6 current call sites — see
 * `tests/unit/pluralise-helper.test.ts` for the truth-table coverage
 * and `tests/unit/pluralise-source-patterns.test.ts` for the
 * adoption locks.
 */
export function pluralise(count: number): "" | "s" {
  return count !== 1 ? "s" : "";
}

// ── Session Message Summary ────────────────────────────────────

/**
 * Generate a short summary preview of message content.
 * Returns the first meaningful line, truncated to 120 chars.
 */
export function messageSummary(content: string | undefined): string {
  if (!content) return "(no content)";
  const lines = content.split("\n");
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || "";
  const firstIndex = lines.findIndex((l) => l.trim().length > 0);
  const hasMoreContent = firstIndex >= 0 && firstIndex < lines.length - 1;
  const trimmed = firstNonEmpty.slice(0, 120);
  return trimmed + (firstNonEmpty.length > 120 || hasMoreContent ? "..." : "");
}

// ── Model Defaults ───────────────────────────────────────────

import { TASK_TYPES, type TaskType } from "@/lib/models/task-types";

/**
 * Empty task-defaults map — initialises all 12 slots to null.
 * Client-safe (no DB dependency), shared between server and UI.
 * Uses TASK_TYPES from `@/lib/models/task-types` as the single source of truth.
 */
export function emptyModelDefaults(): Record<TaskType, string | null> {
  return TASK_TYPES.reduce<Record<TaskType, string | null>>(
    (acc, slot) => { acc[slot] = null; return acc; },
    {} as Record<TaskType, string | null>
  );
}
