/** @jest-environment node */
/* open real SQLite files outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-backup-selection-";
type RealDb = import("better-sqlite3").Database;
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as new (path: string) => RealDb;

function bashBin(): string {
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  return process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
}

function dispose(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: fixture escaped the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

function exerciseBackup(): { root: string; dataDir: string; stdout: string } {
  const root = mkdtempSync(join(tmpdir(), PREFIX));
  const dataDir = join(root, "data");
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, "patterstage.db"), Buffer.alloc(64, 0x11));
  writeFileSync(join(dataDir, "patterstage.db-wal"), Buffer.from("canonical WAL sentinel"));
  writeFileSync(join(dataDir, "patterstage.db-shm"), Buffer.from("canonical SHM sentinel"));
  writeFileSync(join(dataDir, "control-hub.db"), Buffer.alloc(4096, 0x22));
  writeFileSync(join(dataDir, "control-hub.db-wal"), Buffer.from("legacy WAL sentinel"));
  writeFileSync(join(dataDir, "control-hub.db-shm"), Buffer.from("legacy SHM sentinel"));
  const script = `
    set -e
    lib="$ORACLE_LIB"
    data="$ORACLE_DATA"
    if command -v cygpath >/dev/null 2>&1; then
      lib="$(cygpath -u "$lib")"
      data="$(cygpath -u "$data")"
    fi
    source "$lib"
    umask 000
    ps_backup_db "$data"
  `;
  const result = spawnSync(bashBin(), ["-c", script], {
    cwd: ROOT,
    env: {
      ...process.env,
      ORACLE_LIB: join(ROOT, "scripts", "lib", "ps-migrate.sh"),
      ORACLE_DATA: dataDir,
    },
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.signal || result.status !== 0) {
    dispose(root);
    throw new Error(`INFRASTRUCTURE: backup harness failed (${result.error?.message ?? result.signal ?? result.status}); ${result.stderr?.slice(-500) ?? ""}`);
  }
  return { root, dataDir, stdout: result.stdout.trim() };
}

describe("T-0161 shell backup follows runtime database selection", () => {
  it("backs up the larger legacy database and both sidecars when both database names exist", () => {
    const fixture = exerciseBackup();
    try {
      const names = readdirSync(fixture.dataDir);
      const backup = names.find((name) => /^control-hub\.db\.pre-migrate-.*\.bak$/.test(name));
      const canonicalBackup = names.find((name) => /^patterstage\.db\.pre-migrate-.*\.bak$/.test(name));
      expect({
        selectedLegacy: fixture.stdout.endsWith(backup ?? "<missing>"),
        legacyBackupCount: names.filter((name) => /^control-hub\.db\.pre-migrate-.*\.bak$/.test(name)).length,
        canonicalBackupCount: names.filter((name) => /^patterstage\.db\.pre-migrate-.*\.bak$/.test(name)).length,
      }).toEqual({ selectedLegacy: true, legacyBackupCount: 1, canonicalBackupCount: 1 });
      if (!backup || !canonicalBackup) return;
      expect(readFileSync(join(fixture.dataDir, backup))).toEqual(Buffer.alloc(4096, 0x22));
      expect(readFileSync(join(fixture.dataDir, `${backup}-wal`))).toEqual(Buffer.from("legacy WAL sentinel"));
      expect(readFileSync(join(fixture.dataDir, `${backup}-shm`))).toEqual(Buffer.from("legacy SHM sentinel"));
      expect(readFileSync(join(fixture.dataDir, canonicalBackup))).toEqual(Buffer.alloc(64, 0x11));
      expect(readFileSync(join(fixture.dataDir, `${canonicalBackup}-wal`))).toEqual(Buffer.from("canonical WAL sentinel"));
      expect(readFileSync(join(fixture.dataDir, `${canonicalBackup}-shm`))).toEqual(Buffer.from("canonical SHM sentinel"));
    } finally {
      dispose(fixture.root);
    }
  });

  it("creates the database backup and sidecars as owner-only files under a permissive Linux umask", () => {
    const fixture = exerciseBackup();
    try {
      if (process.platform === "win32") return; // NTFS ACLs are not POSIX mode bits.
      const backups = readdirSync(fixture.dataDir).filter((name) => /^(?:control-hub|patterstage)\.db\.pre-migrate-.*\.bak$/.test(name));
      expect(backups).toHaveLength(2);
      for (const backup of backups) {
        for (const suffix of ["", "-wal", "-shm"]) {
          expect(statSync(join(fixture.dataDir, `${backup}${suffix}`)).mode & 0o777).toBe(0o600);
        }
      }
    } finally {
      dispose(fixture.root);
    }
  });

  it("applies direct legacy-data migration to the larger populated database", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      const canonicalPath = join(dataDir, "patterstage.db");
      const legacyPath = join(dataDir, "control-hub.db");
      for (const path of [canonicalPath, legacyPath]) {
        const db = new DatabaseCtor(path);
        try {
          db.exec("CREATE TABLE schedules (id TEXT, mission_id TEXT, name TEXT, schedule TEXT, schedule_display TEXT, enabled INTEGER, catch_up_policy TEXT, repeat_done INTEGER, profile_name TEXT, next_run_at TEXT, created_at TEXT, updated_at TEXT); CREATE TABLE missions (id TEXT PRIMARY KEY, status TEXT, deleted_at TEXT, result TEXT, updated_at TEXT); CREATE TABLE runs (mission_id TEXT)");
          if (path === legacyPath) {
            db.exec("CREATE TABLE payload (bytes BLOB)");
            db.prepare("INSERT INTO payload (bytes) VALUES (?)").run(Buffer.alloc(32_768, 0x6d));
            db.prepare("INSERT INTO missions (id, status) VALUES (?, ?)").run("legacy-dispatched", "dispatched");
          }
        } finally {
          db.close();
        }
      }
      if (statSync(legacyPath).size <= statSync(canonicalPath).size) {
        throw new Error("INFRASTRUCTURE: legacy fixture must be larger than canonical database");
      }
      const result = spawnSync(process.execPath, [join(ROOT, "scripts", "tooling", "migrate-to-runtime.mjs"), "--apply"], {
        cwd: ROOT,
        env: { ...process.env, PS_DATA_DIR: dataDir, HERMES_HOME: hermesHome },
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      });
      if (result.error || result.signal || /ERR_MODULE_NOT_FOUND|Cannot find package/.test(result.stderr ?? "")) {
        throw new Error(`INFRASTRUCTURE: direct migrator could not launch (${result.error?.message ?? result.signal ?? result.stderr?.slice(-500)})`);
      }
      if (result.status !== 0) {
        throw new Error(`Direct migrator exited ${result.status}: ${(result.stderr ?? "").slice(-1000)}`);
      }
      const legacy = new DatabaseCtor(legacyPath);
      const canonical = new DatabaseCtor(canonicalPath);
      try {
        expect(legacy.prepare("SELECT status FROM missions WHERE id = ?").get("legacy-dispatched")).toEqual({ status: "failed" });
        expect(canonical.prepare("SELECT COUNT(*) AS count FROM missions").get()).toEqual({ count: 0 });
      } finally {
        legacy.close();
        canonical.close();
      }
    } finally {
      dispose(root);
    }
  });
});
