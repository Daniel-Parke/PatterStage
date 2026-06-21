// ══════════════════════════════════════════════════════════════════════════════
// fs-stats — safe statSync() helpers for fs metadata
// ══════════════════════════════════════════════════════════════════════════════
//
// statSync() throws if the file is missing or unreadable. Many PatterStage
// routes want a permissive read (e.g. "size + lastModified or zero/null")
// for optional-on-disk files (skill files that may not have been pushed
// to disk yet, profile files that may be missing, etc.). The same `try
// { statSync } catch {}` block was duplicated across 7+ API routes — this
// module consolidates it.
//
// Behaviour:
// - safeStat(path) → { size, mtime } | null    (returns null on any error)
//
// The helper swallows all errors (no logging) because every call site
// treats a missing file as a normal, expected case (e.g. fall back to
// in-DB metadata). If a call site needs the underlying error for
// debugging, it should call statSync directly with its own logging.

import { statSync } from "fs";

export interface FileStat {
  size: number;
  /** ISO-8601 mtime string. `null` if the file is missing or unreadable. */
  mtime: string;
}

/**
 * Permissive statSync — returns `{ size, mtime }` on success, `null`
 * if the file is missing or unreadable. Never throws.
 */
export function safeStat(path: string): FileStat | null {
  try {
    const stats = statSync(path);
    return { size: stats.size, mtime: stats.mtime.toISOString() };
  } catch {
    return null;
  }
}
