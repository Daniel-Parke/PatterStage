// ═══════════════════════════════════════════════════════════════
// Shared Utility Functions
// ═══════════════════════════════════════════════════════════════

/** Capitalise the first letter of a string. */
export function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format an ISO timestamp as a relative time string ("5m ago", "2h ago", etc.)
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "never";
  const diff = Date.now() - ts;
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
 */
export function timeUntil(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "—";
  const diff = ts - Date.now();
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
 * Debounce a function call
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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

// ── Schedule Parsing ──────────────────────────────────────────

export type { ParsedSchedule } from "@/lib/schedule/types";

export { parseSchedule } from "@/lib/schedule/parse-schedule";

// ── Cron Job Types ────────────────────────────────────────────

export interface CronJobData {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  model: string;
  provider?: string;
  base_url?: string;
  profile?: string;
  timeout?: number;
  schedule: { kind: string; minutes?: number; expr?: string; run_at?: string; display?: string } | string;
  schedule_display?: string;
  repeat: { times: number | null; completed: number } | boolean;
  enabled: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  created_at?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  mission_id?: string;
  [key: string]: unknown;
}

// ── Model Defaults ───────────────────────────────────────────

import { TASK_TYPES, type TaskType } from "@/lib/hermes-providers";

/**
 * Empty task-defaults map — initialises all 12 slots to null.
 * Client-safe (no DB dependency), shared between server and UI.
 * Uses TASK_TYPES from hermes-providers as the single source of truth.
 */
export function emptyModelDefaults(): Record<TaskType, string | null> {
  return TASK_TYPES.reduce<Record<TaskType, string | null>>(
    (acc, slot) => { acc[slot] = null; return acc; },
    {} as Record<TaskType, string | null>
  );
}


