// fs-helpers — small filesystem primitives, fs only. Heavier orchestration
// (atomic write + rollback) belongs in `modules/hermes/lib/hermes-config-write.ts`
// and `modules/hermes/lib/profile-sync-shared.ts`.

import { chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync, writeSync } from "fs";
import { createHash } from "crypto";

/** Owner read/write. The mode for anything holding an operator's data. */
export const OWNER_ONLY_FILE = 0o600;
/** Owner read/write/traverse. A readable directory leaks every name in it. */
export const OWNER_ONLY_DIR = 0o700;

/**
 * Narrow an existing path to its owner.
 *
 * A `mode` passed to open() or writeFileSync() applies only when the file is
 * created, and truncating a file keeps the mode it already had. Every path this
 * is called on — the data directory, the database, the deploy logs, the token —
 * already exists on an upgraded install, so the fix has to be a chmod.
 *
 * No-op on Windows, where chmod cannot express this and a thrown error would be
 * a startup failure over a permission tidy-up. Missing paths are ignored for the
 * same reason: boot calls this before some of them exist.
 */
export function restrictToOwner(path: string, mode: number): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(path, mode);
  } catch {
    /* best effort */
  }
}

/** Copy a sensitive file with owner-only mode from the first byte. */
export function copyOwnerOnly(source: string, destination: string): void {
  const input = openSync(source, "r");
  let output: number | undefined;
  let complete = false;
  try {
    output = openSync(destination, "wx", OWNER_ONLY_FILE);
    const block = Buffer.allocUnsafe(64 * 1024);
    for (let count = readSync(input, block, 0, block.length, null); count > 0; count = readSync(input, block, 0, block.length, null)) {
      for (let offset = 0; offset < count;) {
        const written = writeSync(output, block, offset, count - offset);
        if (written === 0) throw new Error("Database backup write made no progress");
        offset += written;
      }
    }
    if (process.platform !== "win32" && (fstatSync(output).mode & 0o777) !== OWNER_ONLY_FILE) {
      throw new Error("Database backup was not created owner-only");
    }
    complete = true;
  } finally {
    try { if (output !== undefined) closeSync(output); } finally { closeSync(input); }
    if (!complete && output !== undefined) rmSync(destination, { force: true });
  }
}

/** Create `dir` recursively if it does not exist. */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Secure a directory that contains credential names, including upgraded installs. */
export function ensureOwnerOnlyDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: OWNER_ONLY_DIR });
  if (process.platform === "win32") return;
  chmodSync(dir, OWNER_ONLY_DIR);
  if ((statSync(dir).mode & 0o777) !== OWNER_ONLY_DIR) {
    throw new Error(`Could not secure credential directory: ${dir}`);
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
  const base = originalPath.split(/[/\\]/).pop() ?? "file";
  if (base === ".env") ensureOwnerOnlyDir(backupsDir);
  else ensureDir(backupsDir);
  const stamp = backupTimestamp();
  const content = readFileSync(originalPath, "utf-8");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `~${String(attempt).padStart(4, "0")}`;
    const target = `${backupsDir}/${base}.${stamp}${suffix}.bak`;
    try {
      writeFileSync(target, content, { encoding: "utf-8", flag: "wx", mode: OWNER_ONLY_FILE });
      return target;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not allocate a unique backup path in ${backupsDir}`);
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
