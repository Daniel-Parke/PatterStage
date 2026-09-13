// scripts/tooling/prebuild-db.mjs
// Forces SQLite migrations and seeds before `next build`.
// Run automatically via `prebuild` npm script.

import Database from "better-sqlite3";
import { readFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { importHermesRegistry } from "./hermes-registry-import.mjs";
import {
  applyProfilesToolsParityUpgrade,
  ensureProfilesToolsParity,
} from "./db-schema-ensure.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_DIR = join(ROOT, "data");
// Prefer the canonical patterstage.db; fall back to an existing legacy
// control-hub.db so an un-migrated checkout isn't handed a duplicate empty DB.
const NEXT_DB = join(DB_DIR, "patterstage.db");
const LEGACY_DB = join(DB_DIR, "control-hub.db");
const DB_PATH = !existsSync(NEXT_DB) && existsSync(LEGACY_DB) ? LEGACY_DB : NEXT_DB;
const MIGRATIONS_DIR = join(ROOT, "src/lib/db/migrations");
const SEEDS_DIR = join(ROOT, "src/lib/db/seeds");

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

let db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function getMeta(database, key) {
  const row = database.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setMeta(database, key, value) {
  database.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
}

function getSchemaVersion(database) {
  const v = getMeta(database, "schema_version");
  return v ? parseInt(v, 10) : 0;
}

function setSchemaVersion(database, version) {
  setMeta(database, "schema_version", String(version));
}

const BASELINE_VERSION = 3;

const currentVersion = getSchemaVersion(db);
if (currentVersion < BASELINE_VERSION) {
  db.close();
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    for (const suffix of ["-wal", "-shm"]) {
      const p = DB_PATH + suffix;
      if (existsSync(p)) unlinkSync(p);
    }
  }
  const fresh = new Database(DB_PATH);
  fresh.pragma("journal_mode = WAL");
  fresh.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const baselinePath = join(MIGRATIONS_DIR, "001_baseline.sql");
  fresh.exec(readFileSync(baselinePath, "utf-8"));
  setSchemaVersion(fresh, BASELINE_VERSION);
  console.log("✓ Baseline schema applied");
  fresh.close();
}

db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const upgraded = applyProfilesToolsParityUpgrade(db, MIGRATIONS_DIR);
if (upgraded >= BASELINE_VERSION) {
  console.log(`✓ Schema at version ${upgraded}`);
} else {
  ensureProfilesToolsParity(db);
}

if (!existsSync(SEEDS_DIR)) {
  console.log("✓ No seeds directory — skipping");
} else {
  const seedFiles = readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const seedsRun = getMeta(db, "seeds_run") || "";
  const seedsRunSet = new Set(seedsRun ? seedsRun.split(",") : []);

  let seedsApplied = 0;
  for (const file of seedFiles) {
    if (!seedsRunSet.has(file)) {
      const sql = readFileSync(join(SEEDS_DIR, file), "utf-8");
      db.exec(sql);
      seedsRunSet.add(file);
      setMeta(db, "seeds_run", [...seedsRunSet].join(","));
      console.log(`✓ Seed ${file} applied`);
      seedsApplied++;
    }
  }

  if (seedsApplied === 0) {
    console.log("✓ Seeds up to date");
  } else {
    console.log(`✓ ${seedsApplied} seed(s) applied`);
  }
}

try {
  importHermesRegistry(db);
} catch (err) {
  console.warn(`⚠  Hermes model import skipped: ${err}`);
}

db.close();

const seedCatalog = spawnSync(
  "npx",
  ["tsx", join(ROOT, "scripts/tooling/seed-catalog.ts"), "--merge"],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PS_DATA_DIR: DB_DIR },
    shell: process.platform === "win32",
  },
);
if (seedCatalog.status !== 0) {
  console.warn("⚠  seed-catalog.ts failed — templates/profiles may be empty until npm run db:seed");
} else {
  console.log("✓ Professional catalog seeded");
}
