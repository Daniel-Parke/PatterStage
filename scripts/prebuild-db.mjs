// scripts/prebuild-db.mjs
// Forces SQLite migrations and seeds before `next build`.
// Run automatically via `prebuild` npm script.

import Database from "better-sqlite3";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_DIR = join(ROOT, "data");
const DB_PATH = join(DB_DIR, "control-hub.db");
const MIGRATIONS_DIR = join(ROOT, "src/lib/db/migrations");
const SEEDS_DIR = join(ROOT, "src/lib/db/seeds");

// Ensure data dir
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// Bootstrap meta table
const db = new Database(DB_PATH);
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

// ── Run pending migrations ───────────────────────────────────
const currentVersion = getSchemaVersion(db);
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let migrationsApplied = 0;
for (const file of migrationFiles) {
  const num = parseInt(file.split("_")[0], 10);
  if (!isNaN(num) && num > currentVersion) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    db.exec(sql);
    setSchemaVersion(db, num);
    console.log(`✓ Migration ${num} (${file}) applied`);
    migrationsApplied++;
  }
}

if (migrationsApplied === 0) {
  console.log("✓ Database schema up to date");
} else {
  console.log(`✓ ${migrationsApplied} migration(s) applied`);
}

// ── Run pending seeds ────────────────────────────────────────
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

db.close();
