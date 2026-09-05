/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform; same construction as the-numbers-are-measured.test.ts */

// B6 (T-0100) oracle, group backups, the helper half: `src/lib/db/backup.ts`
// and its dependency-free twin `src/lib/db/backup-types.ts`.
//
// Contract section 7, the helper lines: databaseBackupsDir honours
// PS_DB_BACKUP_DIR and otherwise sits at PS_DATA_DIR/backups/db;
// backupFileName is `<dbBase>.<label>.<ts>.db` with the fs-helpers timestamp;
// listDatabaseBackups lists the directory's snapshots and the pre-migrate /
// pre-baseline files beside the database, never a -wal or -shm, never the live
// file, newest first, takenAt from the name when the name carries one, and a
// read never creates the directory; snapshotDatabase writes one self-contained
// file through the driver's online backup so an un-checkpointed WAL row is in
// it; restoreCommand is the exact four lines the System card shows.
//
// Written before the module exists, so this whole file is a suite-level red
// until `@/lib/db/backup` resolves. There is nothing to split off: every test
// here needs the module. The database is the REAL driver over a temp
// directory, injected through `deps`, because the global better-sqlite3 mock
// has no `backup` and a helper whose whole job is that method cannot be tested
// against a stub. Nothing touches the operator's data dir: `dataDir` and
// `dbPath` are handed in on every call, and PS_DB_BACKUP_DIR is cleared for
// the run so the default directory rule is what is under test.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

import { execBaselineSchema } from "../helpers/baseline-db";
import { PS_DATA_DIR } from "@/lib/paths";
import * as backupModule from "@/lib/db/backup";

type SqliteDatabase = import("better-sqlite3").Database;

// Read off the namespace through one loose view so the file type-checks while
// the module's exports are still the contract's, not the tree's.
type BackupEntry = { name: string; path: string; bytes: number; takenAt: string; kind: string };
type Helper = {
  databaseBackupsDir: () => string;
  backupFileName: (dbPath: string, label: string, ts?: string) => string;
  listDatabaseBackups: (deps: { dataDir: string; dbPath: string }) => BackupEntry[];
  snapshotDatabase: (
    label: string,
    deps: { db?: SqliteDatabase; dbPath?: string; dataDir?: string },
  ) => Promise<BackupEntry>;
  restoreCommand: (dbPath: string, backupPath: string) => string;
};
const helper = backupModule as unknown as Helper;

/** Forward slashes, whatever the platform spells: the repo builds paths as
 *  `dir + "/sub"` (paths.ts) while path.join answers backslashes on win32,
 *  and the contract cares WHERE the directory is, not which slash spells it. */
const fwd = (p: string): string => p.split(String.fromCharCode(92)).join("/");

function openReal(path: string): SqliteDatabase {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  return new (Database as unknown as new (p: string) => SqliteDatabase)(path);
}

let dataDir = "";
const savedEnv = { ...process.env };

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ps-b6-backup-"));
  delete process.env.PS_DB_BACKUP_DIR;
});

afterEach(() => {
  process.env = { ...savedEnv };
  delete process.env.PS_DB_BACKUP_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

/** A file with a chosen mtime, so the mtime and the name can be made to agree or disagree on purpose. */
function plant(path: string, mtime: Date, bytes = 16): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, Buffer.alloc(bytes, 1));
  utimesSync(path, mtime, mtime);
}

// ───────────────────────────────────────────────────────────────
// where the backups live
// ───────────────────────────────────────────────────────────────

describe("databaseBackupsDir", () => {
  it("defaults to <PS_DATA_DIR>/backups/db, the directory the scheduled script and the runbook already use", () => {
    // Separator-tolerant: the repo builds paths as `dir + "/sub"` (paths.ts)
    // while path.join would answer backslashes on win32, and the contract cares
    // about WHERE the directory is, not which slash spells it.
    expect(fwd(helper.databaseBackupsDir())).toBe(`${fwd(PS_DATA_DIR)}/backups/db`);
  });

  it("honours PS_DB_BACKUP_DIR, so the card lists what the scheduled script wrote", () => {
    // ps-db-backup.mjs and ps-db-backup.sh both read this override. A card
    // that ignored it would list none of the scheduled snapshots and write
    // its own somewhere else (critique gap 2).
    process.env.PS_DB_BACKUP_DIR = "/srv/ps-backups";
    expect(fwd(helper.databaseBackupsDir())).toBe("/srv/ps-backups");
  });
});

// ───────────────────────────────────────────────────────────────
// naming
// ───────────────────────────────────────────────────────────────

describe("backupFileName", () => {
  it("is <dbBase>.<label>.<ts>.db, derived from the database file so a legacy install says control-hub", () => {
    expect(helper.backupFileName("/srv/ps/data/control-hub.db", "manual", "2026-09-05T09-00-00-123Z")).toBe(
      "control-hub.manual.2026-09-05T09-00-00-123Z.db",
    );
    expect(helper.backupFileName("/srv/ps/data/patterstage.db", "pre-restore", "2026-09-05T09-00-00-123Z")).toBe(
      "patterstage.pre-restore.2026-09-05T09-00-00-123Z.db",
    );
  });

  it("defaults the timestamp to fs-helpers' backupTimestamp() form", () => {
    // .getTime(): this fake-timers wants milliseconds (fs-helpers.test.ts:110).
    jest.useFakeTimers({ now: new Date("2026-06-11T11:08:35.585Z").getTime() });
    try {
      expect(helper.backupFileName("/srv/ps/data/patterstage.db", "pre-clean")).toBe(
        "patterstage.pre-clean.2026-06-11T11-08-35-585Z.db",
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

// ───────────────────────────────────────────────────────────────
// the restore command, verbatim
// ───────────────────────────────────────────────────────────────

describe("restoreCommand", () => {
  it("is the exact four lines the card shows, -wal and -shm removal included", () => {
    // A stale WAL beside a restored file would be replayed onto it
    // (upgrade.ts does the same removal on rebuild), so the rm line is part
    // of the command, not a footnote.
    expect(helper.restoreCommand("/srv/ps/data/patterstage.db", "/srv/ps/data/backups/db/x.db")).toBe(
      '# stop the server first\ncp "/srv/ps/data/backups/db/x.db" "/srv/ps/data/patterstage.db"\nrm -f "/srv/ps/data/patterstage.db-wal" "/srv/ps/data/patterstage.db-shm"\n# then start the server again',
    );
  });
});

// ───────────────────────────────────────────────────────────────
// listing
// ───────────────────────────────────────────────────────────────

describe("listDatabaseBackups", () => {
  it("answers [] when there is no backups directory, and does not create one", () => {
    const dbPath = join(dataDir, "patterstage.db");
    plant(dbPath, new Date("2026-09-01T00:00:00Z"));

    expect(helper.listDatabaseBackups({ dataDir, dbPath })).toEqual([]);
    expect(existsSync(join(dataDir, "backups"))).toBe(false);
    expect(existsSync(join(dataDir, "backups", "db"))).toBe(false);
  });

  it("lists the directory's snapshots and the migration files beside the database, newest first, and nothing else", () => {
    const dbPath = join(dataDir, "patterstage.db");
    const dir = join(dataDir, "backups", "db");
    plant(dbPath, new Date("2026-09-07T00:00:00Z"), 4096);
    plant(join(dataDir, "patterstage.db-wal"), new Date("2026-09-07T00:00:00Z"));
    plant(join(dataDir, "seed-state.json"), new Date("2026-09-07T00:00:00Z"));
    plant(join(dir, "patterstage.manual.2026-09-05T09-00-00-000Z.db"), new Date("2026-09-05T09:00:00Z"), 300);
    plant(join(dir, "patterstage.pre-clean.2026-09-06T09-00-00-000Z.db"), new Date("2026-09-06T09:00:00Z"), 400);
    plant(join(dir, "patterstage.manual.2026-09-05T09-00-00-000Z.db-wal"), new Date("2026-09-05T09:00:00Z"));
    plant(join(dataDir, "patterstage.db.pre-migrate-20260901T120000.bak"), new Date("2026-09-01T12:00:00Z"), 200);
    plant(join(dataDir, "patterstage.db.pre-migrate-20260901T120000.bak-wal"), new Date("2026-09-01T12:00:00Z"));
    plant(join(dataDir, "patterstage.db.pre-baseline-1779387782973"), new Date(1779387782973), 100);
    plant(join(dataDir, "patterstage.db.pre-baseline-1779387782973-shm"), new Date(1779387782973));

    const list = helper.listDatabaseBackups({ dataDir, dbPath });

    expect(list.map((b) => b.name)).toEqual([
      "patterstage.pre-clean.2026-09-06T09-00-00-000Z.db",
      "patterstage.manual.2026-09-05T09-00-00-000Z.db",
      "patterstage.db.pre-migrate-20260901T120000.bak",
      "patterstage.db.pre-baseline-1779387782973",
    ]);
    expect(list.map((b) => b.kind)).toEqual(["snapshot", "snapshot", "migration", "migration"]);
    expect(resolve(list[0]!.path)).toBe(resolve(join(dir, "patterstage.pre-clean.2026-09-06T09-00-00-000Z.db")));
    expect(list[0]).toMatchObject({ bytes: 400 });
    expect(resolve(list[2]!.path)).toBe(resolve(join(dataDir, "patterstage.db.pre-migrate-20260901T120000.bak")));
    expect(list[2]).toMatchObject({ bytes: 200 });
    for (const entry of list) {
      expect(Number.isNaN(new Date(entry.takenAt).getTime())).toBe(false);
      expect(entry.name).not.toMatch(/-(wal|shm)$/);
    }
    const names = list.map((b) => b.name);
    expect(names).not.toContain("patterstage.db");
    expect(names).not.toContain("seed-state.json");
  });

  it("reads takenAt from the name when the name carries a timestamp, not from the copy time", () => {
    // `cp` without -p and a Windows copy both reset mtime, so a snapshot
    // moved between machines would otherwise report the copy time. The app's
    // own names carry backupTimestamp(); that is the truth when present.
    const dbPath = join(dataDir, "patterstage.db");
    plant(dbPath, new Date("2026-09-07T00:00:00Z"));
    const dir = join(dataDir, "backups", "db");
    plant(join(dir, "patterstage.manual.2026-09-05T09-00-00-000Z.db"), new Date("2026-09-07T10:30:00Z"));

    const [entry] = helper.listDatabaseBackups({ dataDir, dbPath });

    expect(entry?.takenAt).toBe("2026-09-05T09:00:00.000Z");
  });

  it("falls back to mtime for a name without a timestamp", () => {
    const dbPath = join(dataDir, "patterstage.db");
    plant(dbPath, new Date("2026-09-07T00:00:00Z"));
    const dir = join(dataDir, "backups", "db");
    const file = join(dir, "patterstage.before-upgrade.db");
    plant(file, new Date("2026-08-30T08:15:00Z"));

    const [entry] = helper.listDatabaseBackups({ dataDir, dbPath });

    expect(entry?.name).toBe("patterstage.before-upgrade.db");
    expect(entry?.takenAt).toBe(statSync(file).mtime.toISOString());
  });

  it("only lists the family of THIS database, so a control-hub install does not see patterstage names", () => {
    const dbPath = join(dataDir, "control-hub.db");
    plant(dbPath, new Date("2026-09-07T00:00:00Z"));
    const dir = join(dataDir, "backups", "db");
    plant(join(dir, "control-hub.manual.2026-09-05T09-00-00-000Z.db"), new Date("2026-09-05T09:00:00Z"));
    plant(join(dir, "patterstage.manual.2026-09-05T09-00-00-000Z.db"), new Date("2026-09-05T09:00:00Z"));
    plant(join(dataDir, "control-hub.db.pre-baseline-1779387782973"), new Date(1779387782973));
    plant(join(dataDir, "patterstage.db.pre-baseline-1779387782973"), new Date(1779387782973));

    expect(helper.listDatabaseBackups({ dataDir, dbPath }).map((b) => b.name)).toEqual([
      "control-hub.manual.2026-09-05T09-00-00-000Z.db",
      "control-hub.db.pre-baseline-1779387782973",
    ]);
  });
});

// ───────────────────────────────────────────────────────────────
// taking one
// ───────────────────────────────────────────────────────────────

describe("snapshotDatabase", () => {
  let source: SqliteDatabase | null = null;
  let dbPath = "";

  beforeEach(() => {
    dbPath = join(dataDir, "patterstage.db");
    source = openReal(dbPath);
    source.pragma("journal_mode = WAL");
    execBaselineSchema(source);
  });

  afterEach(() => {
    source?.close();
    source = null;
  });

  it("creates the directory, writes one <dbBase>.manual.<ts>.db, and returns the stat'd entry", async () => {
    const dir = join(dataDir, "backups", "db");
    expect(existsSync(dir)).toBe(false);

    const entry = await helper.snapshotDatabase("manual", { db: source!, dbPath, dataDir });

    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^patterstage\.manual\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/);
    expect(resolve(entry.path)).toBe(resolve(join(dir, files[0]!)));
    expect(entry).toMatchObject({
      name: files[0],
      bytes: statSync(join(dir, files[0]!)).size,
      kind: "snapshot",
    });
    expect(entry.bytes).toBeGreaterThan(0);
    expect(Number.isNaN(new Date(entry.takenAt).getTime())).toBe(false);
  });

  it("the file opens as a database whose meta.schema_version equals the source's", async () => {
    const entry = await helper.snapshotDatabase("manual", { db: source!, dbPath, dataDir });

    const copy = openReal(entry.path);
    try {
      const row = copy.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
        | { value: string }
        | undefined;
      const expected = source!.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
        value: string;
      };
      expect(row?.value).toBe(expected.value);
    } finally {
      copy.close();
    }
  });

  it("on a WAL source with an un-checkpointed row, produces ONE self-contained file that contains the row", async () => {
    // The live database runs in WAL mode (db/index.ts sets it on every open).
    // A plain file copy while the server runs misses committed pages still
    // sitting in <db>-wal; the online backup API does not. This is the
    // reason the helper exists rather than `cp`.
    source!.prepare("INSERT INTO meta (key, value) VALUES ('b6-probe', 'in-the-wal')").run();
    const walPath = `${dbPath}-wal`;
    expect(existsSync(walPath)).toBe(true);
    expect(statSync(walPath).size).toBeGreaterThan(0);

    const entry = await helper.snapshotDatabase("pre-restore", { db: source!, dbPath, dataDir });

    expect(entry.name).toMatch(/^patterstage\.pre-restore\./);
    expect(existsSync(`${entry.path}-wal`)).toBe(false);
    expect(existsSync(`${entry.path}-shm`)).toBe(false);
    expect(readdirSync(join(dataDir, "backups", "db"))).toEqual([entry.name]);

    const copy = openReal(entry.path);
    try {
      const row = copy.prepare("SELECT value FROM meta WHERE key = 'b6-probe'").get() as { value: string } | undefined;
      expect(row?.value).toBe("in-the-wal");
    } finally {
      copy.close();
    }
  });

  it("a snapshot it just took is what listDatabaseBackups lists", async () => {
    const entry = await helper.snapshotDatabase("pre-clean", { db: source!, dbPath, dataDir });

    const list = helper.listDatabaseBackups({ dataDir, dbPath });

    expect(list.map((b) => b.name)).toEqual([entry.name]);
    expect(list[0]).toMatchObject({ path: entry.path, bytes: entry.bytes, kind: "snapshot" });
  });
});
