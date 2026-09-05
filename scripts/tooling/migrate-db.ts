#!/usr/bin/env npx tsx
/**
 * Apply ALL PatterStage SQLite migrations to the runtime database (PS_DATA_DIR).
 *
 * Single source of truth: this delegates to `getDb()` → `runMigrations()` in
 * src/lib/db/index.ts — the exact applier chain the app runs at boot — so
 * `npm run db:migrate` and the running app can never drift. This replaces the
 * old partial migrate-db.mjs that stopped at schema_version 3 and relied on the
 * app to silently finish the chain at first boot (the migration-applier
 * footgun). Idempotent.
 *
 * Usage:
 *   npm run db:migrate
 *   npx tsx scripts/tooling/migrate-db.ts
 * Reads PS_DATA_DIR from env or .env.local (falls back to ~/control-hub/data).
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadEnvLocal(): void {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** Peek the stored schema_version with a throwaway read-only connection. */
function readSchemaVersion(dbPath: string): number {
  if (!existsSync(dbPath)) return 0;
  try {
    const probe = new Database(dbPath, { readonly: true });
    const row = probe
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    probe.close();
    return row?.value ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Single source of truth: reuse the app's resolver (respects PS_DATA_DIR env,
  // else discovers an existing populated data dir). Replaces the old hardcoded
  // lowercase ~/patterstage/data + control-hub.db, which on a case-sensitive
  // install could create/migrate the WRONG (or an empty) database.
  const { getPsDataDir, getDbPath } = await import("../../src/lib/paths");
  const dataDir = getPsDataDir();
  process.env.PS_DATA_DIR = dataDir;
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const dbPath = getDbPath(dataDir);
  console.log(`Database: ${dbPath}`);

  const before = readSchemaVersion(dbPath);
  console.log(`schema_version before: ${before}`);

  // Dynamic import AFTER PS_DATA_DIR is set — db.ts resolves the data dir at
  // import time (via paths.ts). getDb() opens the connection and runs the full
  // applier chain (runMigrations), exactly as the app does at boot.
  // The specifier is unchanged across the D8 move of db.ts into db/index.ts:
  // tsx resolves the directory to its index, same as the bundler and Jest.
  // Smoke-tested both ways on a fresh database (0 -> 30) before leaving it.
  const { getDb, runMigrations } = await import("../../src/lib/db");
  const database = getDb();

  const versionOf = (): number => {
    const row = database
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    return row?.value ? parseInt(row.value, 10) : 0;
  };

  // Converge to the terminal schema version. On a brand-new DB, runMigrations
  // applies the baseline (the full current schema) and returns early; the
  // upgrade-only appliers run on subsequent passes. The app reaches the terminal
  // version across boot, but a standalone migrator should finish in one
  // invocation — so re-run until the version stops advancing (idempotent; capped).
  let last = versionOf();
  for (let i = 0; i < 5; i++) {
    runMigrations(database);
    const next = versionOf();
    if (next === last) break;
    last = next;
  }

  const after = versionOf();
  console.log(`schema_version after: ${after}`);
  console.log(
    after > before
      ? `✓ Migrated schema_version ${before} → ${after}`
      : `✓ Already at schema_version ${after}`,
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
