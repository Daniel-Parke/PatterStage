// ══════════════════════════════════════════════════════════════════════════════
// fs-helpers — small reusable filesystem primitives
// ══════════════════════════════════════════════════════════════════════════════
//
// Three primitives that were previously duplicated (or hoisted as
// private helpers in `modules/hermes/lib/config-sync.ts`):
//
//   - `ensureDir(dir)`         — `mkdir -p` without throwing on existing dir
//   - `backupTimestamp()`      — filesystem-safe ISO-8601 timestamp suffix
//   - `backupFile(src, dir)`   — copy `src` to `dir/<basename>.<ts>.bak`,
//                                creating the dir first. Returns the new
//                                path or null when `src` doesn't exist.
//
// Before this module: the inline `if (!existsSync(dir)) mkdirSync(dir,
// { recursive: true })` block appeared in 12+ files. The
// `new Date().toISOString().replace(/[:.]/g, "-")` timestamp appeared
// 3+ times. The "copy-to-timestamped-backup" pattern appeared in 3+
// places (2 in lib + 1 in app/api/agent/files).
//
// Promoted from `modules/hermes/lib/config-sync.ts` (where `ensureDir`,
// `backupTimestamp`, and `backupFile` were private module-local
// helpers) in session 85 (List 4 refactor) so every PatterStage
// module can reach for the canonical versions.
//
// Keep this module tiny and dependency-free (fs only). Heavier
// file-orchestration (e.g. atomic write + rollback) belongs in
// `modules/hermes/lib/hermes-config-write.ts` / `modules/hermes/lib/profile-sync-shared.ts`.
// ══════════════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

/**
 * Create `dir` (recursively) if it doesn't exist. No-op when the
 * directory is already present. Matches the pre-refactor inline
 * `if (!existsSync(dir)) mkdirSync(dir, { recursive: true })` pattern
 * byte-for-byte (and the private `ensureDir` in `modules/hermes/lib/config-sync.ts`
 * that this helper replaces).
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Return an ISO-8601 timestamp with `:` and `.` replaced by `-` so
 * the result is safe to use as a filename suffix on every supported
 * platform. Format: `2026-06-03T12-34-56-789Z`.
 *
 * The 3 pre-refactor inline call sites (`config/route.ts`,
 * `agent/files/[key]/route.ts`, `modules/hermes/lib/profile-sync-shared.ts`) and a
 * private `backupTimestamp()` that used to live in
 * `modules/hermes/lib/config-sync.ts` all used the
 * same `new Date().toISOString().replace(/[:.]/g, "-")` expression —
 * this helper preserves that exact behaviour (including the millisecond
 * precision trailing-Z). Two calls within the same millisecond return
 * the same string (matching the pre-refactor inline form).
 */
export function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Copy `originalPath` to `<backupsDir>/<basename>.<ts>.bak`, creating
 * the backups dir first. Returns the new backup path, or `null` when
 * the source file doesn't exist (so callers can distinguish "no
 * backup needed" from "backup failed").
 *
 * Mirrors the pre-refactor private `backupFile()` in
 * `modules/hermes/lib/config-sync.ts` byte-for-byte: same `<basename>.<ts>.bak`
 * naming, same UTF-8 read+write, same null-on-missing-source.
 */
export function backupFile(originalPath: string, backupsDir: string): string | null {
  if (!existsSync(originalPath)) return null;
  ensureDir(backupsDir);
  const base = originalPath.split(/[/\\]/).pop() ?? "file";
  const target = `${backupsDir}/${base}.${backupTimestamp()}.bak`;
  writeFileSync(target, readFileSync(originalPath, "utf-8"), { encoding: "utf-8" });
  return target;
}

/**
 * SHA-256 hex digest of a UTF-8 string. The canonical "is this content
 * the same as what we have?" primitive used by the profile/root/skill
 * drift detectors (`modules/hermes/lib/profile-drift.ts`). Promoted here so the hash
 * is unit-testable and a future second drift consumer can share it.
 */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * SHA-256 hex digest of a file's UTF-8 content, or `null` when the file
 * is missing or unreadable (so callers can distinguish "no file" from a
 * real hash). Byte-equivalent to the pre-extraction private `fileHash`
 * in `modules/hermes/lib/profile-drift.ts`.
 */
export function fileHash(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return contentHash(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
