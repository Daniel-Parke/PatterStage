// ═══════════════════════════════════════════════════════════════
// apply-recroom-library-migration.ts
//
// Creates Story Weaver's reusable character + theme library (029). Version
// guarded at schema_version 29, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version is
// NOT bumped — see src/lib/db/apply-sql.ts for why that matters.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const RECROOM_LIBRARY_SCHEMA_VERSION = 29;

export function applyRecroomLibraryMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RECROOM_LIBRARY_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "029_recroom_library.sql"));

  setSchemaVersion(database, RECROOM_LIBRARY_SCHEMA_VERSION);
  return RECROOM_LIBRARY_SCHEMA_VERSION;
}
