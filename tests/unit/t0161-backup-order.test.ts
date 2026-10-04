/** @jest-environment node */
/* load the real SQLite driver outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-backup-order-";
type RealDb = import("better-sqlite3").Database;
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as new (path: string) => RealDb;

function gitBash(): string {
  const windowsBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  return process.platform === "win32" && existsSync(windowsBash) ? windowsBash : "bash";
}

describe("T-0161 migration stops after backup failure", () => {
  it("returns failure and never invokes npm migration for an existing database", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const fakeBin = join(root, "bin");
      const backupMarker = join(root, "backup-attempted");
      const npmMarker = join(root, "npm-invoked");
      const resultFile = join(root, "migration-status");
      mkdirSync(dataDir);
      mkdirSync(fakeBin);
      mkdirSync(join(root, "hermes"));
      mkdirSync(join(root, "legacy-data"));
      const db = new DatabaseCtor(join(dataDir, "patterstage.db"));
      try {
        db.exec("CREATE TABLE oracle_sentinel (value TEXT NOT NULL)");
        db.prepare("INSERT INTO oracle_sentinel (value) VALUES (?)").run("existing data");
      } finally {
        db.close();
      }
      writeFileSync(join(fakeBin, "npm"), "#!/usr/bin/env bash\nprintf 'called' > \"$ORACLE_NPM_MARKER\"\nexit 0\n", { mode: 0o755 });

      const script = `
        set +e
        if command -v cygpath >/dev/null 2>&1; then
          export PS_DATA_DIR="$(cygpath -u "$ORACLE_DATA_DIR")"
          export HERMES_HOME="$(cygpath -u "$ORACLE_HERMES_HOME")"
          export CH_DATA_DIR="$(cygpath -u "$ORACLE_LEGACY_DIR")"
          export ORACLE_BACKUP_MARKER="$(cygpath -u "$ORACLE_BACKUP_MARKER")"
          export ORACLE_NPM_MARKER="$(cygpath -u "$ORACLE_NPM_MARKER")"
          export ORACLE_RESULT_FILE="$(cygpath -u "$ORACLE_RESULT_FILE")"
          export PS_NPM_BIN="$(cygpath -u "$ORACLE_FAKE_BIN")/npm"
        else
          export PS_DATA_DIR="$ORACLE_DATA_DIR" HERMES_HOME="$ORACLE_HERMES_HOME"
          export CH_DATA_DIR="$ORACLE_LEGACY_DIR"
          export PS_NPM_BIN="$ORACLE_FAKE_BIN/npm"
        fi
        source scripts/lib/ps-migrate.sh || exit 91
        ps_info() { :; }
        ps_step() { :; }
        ps_warn() { :; }
        ps_ok() { :; }
        ps_err() { :; }
        ps_dim() { :; }
        ps_backup_db() { printf 'attempted' > "$ORACLE_BACKUP_MARKER"; return 23; }
        ps_migrate_run "$PWD" "$PS_DATA_DIR"
        printf '%s' "$?" > "$ORACLE_RESULT_FILE"
      `;
      const launched = spawnSync(gitBash(), ["-c", script], {
        cwd: ROOT,
        env: {
          ...process.env,
          EOS_SESSION_ID: "T-0161-safety-oracle",
          ORACLE_DATA_DIR: dataDir,
          ORACLE_HERMES_HOME: join(root, "hermes"),
          ORACLE_LEGACY_DIR: join(root, "legacy-data"),
          ORACLE_FAKE_BIN: fakeBin,
          ORACLE_BACKUP_MARKER: backupMarker,
          ORACLE_NPM_MARKER: npmMarker,
          ORACLE_RESULT_FILE: resultFile,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        windowsHide: true,
      });
      if (launched.error || launched.signal || launched.status !== 0 || !existsSync(resultFile)) {
        throw new Error(`INFRASTRUCTURE: Git Bash migration harness failed (${launched.error?.message ?? launched.signal ?? launched.status})`);
      }
      if (!existsSync(backupMarker)) {
        const diagnostic = `${launched.stderr ?? ""}\n${launched.stdout ?? ""}`.replaceAll(root, "<fixture>").slice(-1200);
        throw new Error(`INFRASTRUCTURE: migration harness did not reach its stubbed backup: ${diagnostic}`);
      }

      expect({
        failed: readFileSync(resultFile, "utf8") !== "0",
        migrationInvoked: existsSync(npmMarker),
      }).toEqual({ failed: true, migrationInvoked: false });
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });
});
