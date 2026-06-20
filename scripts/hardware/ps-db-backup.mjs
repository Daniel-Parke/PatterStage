#!/usr/bin/env node
// ps-db-backup.mjs — snapshot the PatterStage SQLite DB + rotate. Cross-platform.
// Uses the `sqlite3` CLI `.backup` (consistent online copy) when available, else
// a plain file copy. Only writes into the backups dir; deletes its OWN rotated
// snapshots beyond the keep count.
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

// Rotate: keep the newest KEEP snapshots for this DB, delete the rest.
const snaps = readdirSync(BACKUP_DIR)
  .filter((f) => f.startsWith(`${DB_BASE}.`) && f.endsWith(".db"))
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
