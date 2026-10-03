/** @jest-environment node */

// The rotation in `scripts/hardware/ps-db-backup.mjs`, held to what its own
// header promises: that it deletes its OWN rotated snapshots and nothing else.
//
// It did not. The filter was `f.startsWith(DB_BASE + ".") && f.endsWith(".db")`,
// and since T-0100 the product writes `manual`, `pre-restore` and `pre-clean`
// snapshots into that same directory, all of them named `<base>.<label>.<ts>.db`.
// Every one of those matched. An operator who took a backup by hand before a
// risky change, and meant to keep it, could have it deleted by the next
// scheduled run simply for being the oldest file in the directory.
//
// So the seed here is one of each kind, with the hand-taken one made the OLDEST
// file present: that is the file the buggy rotation reaches for first, and the
// file the operator would least forgive losing. The script is run as the
// operator's scheduler runs it, from its shipped path with only its documented
// environment set, because a rotation tested through a re-implementation of its
// filter proves nothing about the script that ships.

import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = join(__dirname, "..", "..", "scripts", "hardware", "ps-db-backup.mjs");

/** The name shape the script itself writes: `<base>.<YYYYMMDDTHHMMSSZ>.db`. */
const SCRIPT_SNAPSHOT = /^patterstage\.\d{8}T\d{6}Z\.db$/;

/** A hand-taken backup, and the two the product takes before it overwrites rows. */
const MANUAL = "patterstage.manual.2026-01-03T00-00-00-000Z.db";
const PRE_RESTORE = "patterstage.pre-restore.2026-01-03T00-00-01-000Z.db";
const PRE_CLEAN = "patterstage.pre-clean.2026-01-03T00-00-02-000Z.db";

/** The script's own snapshots already in the directory, oldest first. */
const OLDEST_OWN = "patterstage.20260101T000000Z.db";
const NEWER_OWN = "patterstage.20260102T000000Z.db";

let dataDir = "";
let backupDir = "";
let listing: string[] = [];
let exitCode = -1;

/** Write `name` into the backups directory and date it `daysAgo` days back. */
function seed(name: string, daysAgo: number): void {
  const path = join(backupDir, name);
  writeFileSync(path, "");
  const when = new Date(Date.now() - daysAgo * 86_400_000);
  utimesSync(path, when, when);
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ps-db-backup-rot-"));
  backupDir = join(dataDir, "backups", "db");
  mkdirSync(backupDir, { recursive: true });
  // An empty file is a valid empty SQLite database, so both halves of the
  // script's write path (the `sqlite3` CLI where it exists, the plain copy
  // where it does not) produce a snapshot from it.
  writeFileSync(join(dataDir, "patterstage.db"), "");

  seed(OLDEST_OWN, 4);
  seed(NEWER_OWN, 3);
  // Older than either of the script's own snapshots, which is what makes this
  // the first file a rotation sorting on mtime alone would delete.
  seed(MANUAL, 9);
  seed(PRE_RESTORE, 8);
  seed(PRE_CLEAN, 7);

  const env = {
    ...process.env,
    PS_DATA_DIR: dataDir,
    PS_DB_BACKUP_DIR: backupDir,
    PS_DB_BACKUP_KEEP: "2",
  };
  try {
    execFileSync(process.execPath, [SCRIPT], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    exitCode = 0;
  } catch (e) {
    exitCode = (e as { status?: number }).status ?? 1;
  }
  listing = readdirSync(backupDir);
});

afterAll(() => {
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe("ps-db-backup rotation", () => {
  it("takes the snapshot it was run for", () => {
    expect(exitCode).toBe(0);
    expect(listing.filter((f) => SCRIPT_SNAPSHOT.test(f)).length).toBeGreaterThan(0);
  });

  it("keeps a backup the operator took by hand, however old it is", () => {
    expect(listing).toContain(MANUAL);
  });

  it("keeps the snapshots the product takes before it overwrites rows", () => {
    expect(listing).toContain(PRE_RESTORE);
    expect(listing).toContain(PRE_CLEAN);
  });

  it("still prunes its own oldest snapshot down to the keep count", () => {
    expect(listing).not.toContain(OLDEST_OWN);
    expect(listing).toContain(NEWER_OWN);
    // Two of its own: the one it just wrote, and the newer of the two seeded.
    expect(listing.filter((f) => SCRIPT_SNAPSHOT.test(f))).toHaveLength(2);
  });
});
