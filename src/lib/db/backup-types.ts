// ═══════════════════════════════════════════════════════════════
// db/backup-types.ts — the shape of a database backup, and nothing else
//
// Dependency-free on purpose, the way `status/runtime-status-format.ts` is:
// the Settings > System card needs these names, and importing them from
// `./backup.ts` would drag `better-sqlite3` and `fs` into the browser bundle
// through a value import (T-0099 learned that the hard way).
// ═══════════════════════════════════════════════════════════════

/**
 * Why a backup was taken. A server-side allow-list: it is never read from a
 * request, so no caller can steer the file name.
 */
export type BackupLabel = "manual" | "pre-restore" | "pre-clean";

export interface DatabaseBackup {
  /** File name, which is also what the card shows and the audit line records. */
  name: string;
  path: string;
  bytes: number;
  /** ISO-8601. From the name when the name carries a stamp, else the mtime. */
  takenAt: string;
  /**
   * `snapshot` is one this product took (or the scheduled script wrote beside
   * it); `migration` is one the deploy path left next to the database before
   * a migrate or a baseline rebuild.
   */
  kind: "snapshot" | "migration";
}

/** The answer `GET /api/backup` gives, and what the System card renders. */
export interface BackupList {
  dbPath: string;
  dir: string;
  backups: DatabaseBackup[];
  /** The shell the operator runs themselves; the product never runs it. */
  restoreCommand: string;
}
