// ═══════════════════════════════════════════════════════════════
// db/backup.ts — take a database backup, and list the ones that exist
//
// The two irreversible buttons on the Restore page (restore-everything and
// remove-test-data) fired straight into the database with nothing to go back
// to, and the deploy path's own `.bak` files were invisible to the product
// that made them (T-0100, D113).
//
// The snapshot is SQLite's online backup, not a file copy: `getDb()` opens the
// database in WAL mode, so committed pages can still be sitting in `<db>-wal`
// and a naive copy would miss them. `db.backup()` writes one self-contained
// file that needs no `-wal`/`-shm` beside it, while the app keeps serving.
//
// Restoring is deliberately NOT here. It is a shell step the operator takes
// with the server stopped; the product shows the command and runs nothing.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readdirSync, statSync } from "fs";
import { basename, dirname, join } from "path";

import type Database from "better-sqlite3";

import { backupTimestamp, ensureDir } from "@/lib/fs/fs-helpers";
import { PS_DATA_DIR, getDbPath, readEnv } from "@/lib/paths";

import { getDb } from "./index";
import type { BackupLabel, DatabaseBackup } from "./backup-types";

// BackupList is deliberately not re-exported: the Settings page takes it from
// ./backup-types, which is dependency-free, so a client component never reaches
// a module that opens the database.
export type { BackupLabel, DatabaseBackup } from "./backup-types";

/**
 * Where snapshots live: `PS_DATA_DIR/backups/db`, which is already the
 * directory `scripts/hardware/ps-db-backup.mjs` writes to and the one
 * `ops/runbooks/deploy.md` restores from, and the override both of those read.
 * One directory, so one listing and one rotation cover the app and the
 * scheduled script alike.
 */
export function databaseBackupsDir(dataDir: string = PS_DATA_DIR): string {
  return readEnv("PS_DB_BACKUP_DIR") ?? dataDir + "/backups/db";
}

/** The database file's name without its extension: `patterstage`, or `control-hub` on a legacy install. */
function dbBase(dbPath: string): string {
  return basename(dbPath).replace(/\.db$/, "");
}

/**
 * `<dbBase>.<label>.<ts>.db` — sorts by name and by time alike, and stays a
 * `.db` so a restore is a plain copy.
 *
 * @public Kept exported for tests/unit/b6-database-backup.test.ts, which pins
 * the name shape a restore command is written against. `snapshotDatabase`
 * below is its only caller in the product.
 */
export function backupFileName(dbPath: string, label: string, ts: string = backupTimestamp()): string {
  return `${dbBase(dbPath)}.${label}.${ts}.db`;
}

/**
 * When the file name carries the moment it was taken, believe the name.
 * `cp` without `-p` and a Windows copy both reset mtime, so a backup carried
 * between machines would otherwise report when it was copied.
 */
function takenAtFrom(name: string, fallback: () => string): string {
  const snapshot = /\.(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.db$/.exec(name);
  if (snapshot) {
    const [, day, h, m, s, ms] = snapshot;
    return `${day}T${h}:${m}:${s}.${ms}Z`;
  }
  const migrate = /\.pre-migrate-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.bak$/.exec(name);
  if (migrate) {
    const [, y, mo, d, h, mi, s] = migrate;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  }
  const baseline = /\.pre-baseline-(\d{10,})$/.exec(name);
  if (baseline) {
    const at = new Date(Number(baseline[1]));
    if (!Number.isNaN(at.getTime())) return at.toISOString();
  }
  return fallback();
}

/** Never a WAL or shared-memory sibling: those are halves of a database, not backups. */
function isSidecar(name: string): boolean {
  return name.endsWith("-wal") || name.endsWith("-shm");
}

function entry(dir: string, name: string, kind: DatabaseBackup["kind"]): DatabaseBackup | null {
  const path = join(dir, name);
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    return {
      name,
      path,
      bytes: stat.size,
      takenAt: takenAtFrom(name, () => stat.mtime.toISOString()),
      kind,
    };
  } catch {
    // Vanished between the readdir and the stat. A listing is a read; it
    // reports what it can see and never fails the page over one file.
    return null;
  }
}

function namesIn(dir: string): string[] {
  try {
    return existsSync(dir) ? readdirSync(dir) : [];
  } catch {
    return [];
  }
}

/**
 * Every backup of THIS database, newest first: the snapshots in the backups
 * directory, and the `pre-migrate` / `pre-baseline` files the deploy path
 * leaves beside the database. Reading never creates the directory.
 */
export function listDatabaseBackups(
  deps: { dataDir?: string; dbPath?: string } = {},
): DatabaseBackup[] {
  const dbPath = deps.dbPath ?? getDbPath();
  const dir = databaseBackupsDir(deps.dataDir ?? PS_DATA_DIR);
  const base = dbBase(dbPath);
  const file = basename(dbPath);

  const snapshots = namesIn(dir)
    .filter((n) => n.startsWith(base + ".") && n.endsWith(".db") && !isSidecar(n))
    .map((n) => entry(dir, n, "snapshot"));

  const beside = dirname(dbPath);
  const migrations = namesIn(beside)
    .filter(
      (n) =>
        !isSidecar(n) &&
        ((n.startsWith(`${file}.pre-migrate-`) && n.endsWith(".bak")) ||
          n.startsWith(`${file}.pre-baseline-`)),
    )
    .map((n) => entry(beside, n, "migration"));

  return [...snapshots, ...migrations]
    .filter((b): b is DatabaseBackup => b !== null)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

/**
 * Take one, through the driver's online backup. `ensureDir` first: better-sqlite3
 * throws `Cannot save backup because the directory does not exist` rather than
 * creating it.
 */
export async function snapshotDatabase(
  label: BackupLabel,
  deps: { db?: Database.Database; dbPath?: string; dataDir?: string } = {},
): Promise<DatabaseBackup> {
  const dbPath = deps.dbPath ?? getDbPath();
  const dir = databaseBackupsDir(deps.dataDir ?? PS_DATA_DIR);
  ensureDir(dir);

  const name = backupFileName(dbPath, label);
  const target = join(dir, name);
  await (deps.db ?? getDb()).backup(target);

  const made = entry(dir, name, "snapshot");
  if (!made) throw new Error(`Backup wrote no file at ${target}`);
  return made;
}

/**
 * The restore, as the operator will run it. The `-wal`/`-shm` removal is part
 * of the command, not a footnote: a stale WAL beside a restored file is
 * replayed onto it, which is why the baseline rebuild deletes them too.
 */
export function restoreCommand(dbPath: string, backupPath: string): string {
  return [
    "# stop the server first",
    `cp "${backupPath}" "${dbPath}"`,
    `rm -f "${dbPath}-wal" "${dbPath}-shm"`,
    "# then start the server again",
  ].join("\n");
}
