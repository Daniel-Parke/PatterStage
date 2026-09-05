// ═══════════════════════════════════════════════════════════════
// apply-memory-providers-migration.ts
//
// Creates the memory_providers table (see 022_memory_providers.sql) and seeds
// the default Hindsight provider row (127.0.0.1:9177, bank "hermes") so an
// existing Hindsight install is reachable out of the box — but now editable in
// the DB/UI instead of via ~/.hermes/hindsight/config.json. Version-guarded at
// schema_version 22, wired LAST in runMigrations.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const MEMORY_PROVIDERS_SCHEMA_VERSION = 22;

export function applyMemoryProvidersMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= MEMORY_PROVIDERS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "022_memory_providers.sql"));

  // Seed the default Hindsight provider (active) if no providers exist yet.
  // No try/catch: see apply-frameworks-migration.ts. A missing table here means
  // the CREATE above did not happen, and hiding that records the migration as
  // applied against a database that does not have it.
  const count = (
    database.prepare("SELECT COUNT(*) AS c FROM memory_providers").get() as { c: number }
  ).c;
  if (count === 0) {
    database
      .prepare(
        `INSERT INTO memory_providers (type, label, enabled, is_active, config_json)
         VALUES ('hindsight', 'Hindsight', 1, 1, ?)`,
      )
      .run(JSON.stringify({ host: "127.0.0.1", port: 9177, bank: "hermes" }));
  }

  setSchemaVersion(database, MEMORY_PROVIDERS_SCHEMA_VERSION);
  return MEMORY_PROVIDERS_SCHEMA_VERSION;
}
