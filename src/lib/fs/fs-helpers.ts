// fs-helpers — small filesystem primitives, fs only. Heavier orchestration
// (atomic write + rollback) belongs in `modules/hermes/lib/hermes-config-write.ts`
// and `modules/hermes/lib/profile-sync-shared.ts`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

/** Create `dir` recursively if it does not exist. */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** ISO-8601 with `:` and `.` replaced by `-`, safe as a filename suffix on every
 * platform: `2026-06-03T12-34-56-789Z`. Same millisecond, same string. */
export function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Copy `originalPath` to `<backupsDir>/<basename>.<ts>.bak`, creating the dir.
 * Returns the backup path, or `null` when the source does not exist. */
export function backupFile(originalPath: string, backupsDir: string): string | null {
  if (!existsSync(originalPath)) return null;
  ensureDir(backupsDir);
  const base = originalPath.split(/[/\\]/).pop() ?? "file";
  const target = `${backupsDir}/${base}.${backupTimestamp()}.bak`;
  writeFileSync(target, readFileSync(originalPath, "utf-8"), { encoding: "utf-8" });
  return target;
}

/** SHA-256 hex of a UTF-8 string: the "is this the same content?" primitive the drift detectors use. */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** SHA-256 hex of a file's UTF-8 content, or `null` when missing or unreadable. */
export function fileHash(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return contentHash(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
