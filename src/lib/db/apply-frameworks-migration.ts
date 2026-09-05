// ═══════════════════════════════════════════════════════════════
// apply-frameworks-migration.ts
//
// Creates the frameworks registry (see 027_frameworks.sql) and seeds the
// default Hermes framework row (active) so the control plane has a DB-owned
// record of its agent framework + home config — a FrameworkAdapter seam for
// adding a second framework later. Version-guarded at schema_version 27, wired
// LAST in runMigrations.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const FRAMEWORKS_SCHEMA_VERSION = 27;

export function applyFrameworksMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= FRAMEWORKS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "027_frameworks.sql"));

  // Seed the default Hermes framework (active) if no frameworks exist yet.
  // config.home = null ⇒ the adapter resolves the default Hermes root.
  //
  // No try/catch: if the table is missing here the CREATE above did not happen,
  // and swallowing that leaves a database recorded at v27 with no `frameworks`
  // table. The old comment claimed "the next pass retries", which the version
  // guard at the top of this function makes impossible.
  const count = (database.prepare("SELECT COUNT(*) AS c FROM frameworks").get() as { c: number }).c;
  if (count === 0) {
    database
      .prepare(
        `INSERT INTO frameworks (type, name, enabled, is_active, config_json)
         VALUES ('hermes', 'Hermes', 1, 1, ?)`,
      )
      .run(JSON.stringify({ home: null }));
  }

  setSchemaVersion(database, FRAMEWORKS_SCHEMA_VERSION);
  return FRAMEWORKS_SCHEMA_VERSION;
}
