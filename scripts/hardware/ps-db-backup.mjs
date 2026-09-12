#!/usr/bin/env node
// ps-db-backup.mjs — snapshot the PatterStage SQLite DB + rotate. Cross-platform.
// Uses the `sqlite3` CLI `.backup` (consistent online copy) when available, else
// a plain file copy. Only writes into the backups dir; deletes only the rotated
// snapshots it wrote itself, recognised by their timestamp name, beyond the keep
// count. The app's own `manual` / `pre-restore` / `pre-clean` backups share the
// directory and are never touched.
//   PS_DATA_DIR / PS_DB_BACKUP_DIR / PS_DB_BACKUP_KEEP (14)

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

function dataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && raw.trim()) return raw.trim().replace(/[/\\]+$/, "");
  const next = join(homedir(), "patterstage", "data");
  const legacy = join(homedir(), "control-hub", "data");
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}
function dbPath(dir) {
  const next = join(dir, "patterstage.db");
  const legacy = join(dir, "control-hub.db");
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}
const log = (m) => console.log(`[${new Date().toISOString()}] [ps-db-backup] ${m}`);

const DATA = dataDir();
const DB = dbPath(DATA);
const BACKUP_DIR = process.env.PS_DB_BACKUP_DIR || join(DATA, "backups", "db");
const KEEP = Number(process.env.PS_DB_BACKUP_KEEP || 14);
const DB_BASE = (DB.split(/[/\\]/).pop() || "patterstage.db").replace(/\.db$/, "");

if (!existsSync(DB)) {
  log(`ERROR: database not found: ${DB}`);
  process.exit(1);
}
mkdirSync(BACKUP_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const dest = join(BACKUP_DIR, `${DB_BASE}.${ts}.db`);

let viaSqlite = false;
try {
  execFileSync("sqlite3", [DB, `.backup '${dest}'`], { stdio: "ignore" });
  viaSqlite = true;
} catch {
  /* sqlite3 CLI absent — fall back to a file copy */
}
if (!viaSqlite) copyFileSync(DB, dest);
log(`${viaSqlite ? "sqlite .backup" : "cp"} → ${dest}`);

// Rotate: keep the newest KEEP snapshots this script wrote, delete the rest.
//
// The filter used to be `startsWith(DB_BASE + ".") && endsWith(".db")`, which
// also swept up the `manual`, `pre-restore` and `pre-clean` snapshots the app
// writes into this same directory: a backup an operator took by hand before a
// risky change could be deleted by the next scheduled run for being the oldest
// file present. Matching our own timestamp shape rather than tagging new files
// with an infix is deliberate: an infix would only mark files written from here
// on, and every snapshot already sitting on a running install would stop being
// rotated and grow without bound. The shape below is what both this script and
// its bash twin have always produced, so existing files keep rotating and the
// app's labelled names (`<base>.<label>.<ts>.db`) fall outside it.
const OWN_SNAPSHOT = new RegExp(`^${DB_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d{8}T\\d{6}Z\\.db$`);
const snaps = readdirSync(BACKUP_DIR)
  .filter((f) => OWN_SNAPSHOT.test(f))
  .map((f) => ({ f, m: statSync(join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
let pruned = 0;
for (const { f } of snaps.slice(KEEP)) {
  try {
    unlinkSync(join(BACKUP_DIR, f));
    pruned++;
    log(`pruned ${f}`);
  } catch {
    /* ignore */
  }
}
log(`backup complete (${snaps.length} snapshot(s), keeping ${KEEP}, pruned ${pruned})`);
