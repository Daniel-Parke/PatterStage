// ═══════════════════════════════════════════════════════════════
// apply-models-api-style-migration.ts
//
// Adds models.api_style (the direct-provider wire protocol) and repairs
// existing rows by inferring it from provider/base_url (see
// 024_models_api_style.sql). Version-guarded at schema_version 24, wired LAST
// in runMigrations. Guarded ALTER + idempotent, NULL-only repair.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const MODELS_API_STYLE_SCHEMA_VERSION = 24;

export function applyModelsApiStyleMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= MODELS_API_STYLE_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "024_models_api_style.sql"));

  try {
    database.exec("ALTER TABLE models ADD COLUMN api_style TEXT");
  } catch {
    // column already present (re-run / older partial apply)
  }

  // Idempotent repair: infer api_style only where it is still NULL, so a
  // user-set value is never clobbered. An '/anthropic' base path (MiniMax's
  // Anthropic-compatible endpoint) or the anthropic provider ⇒ anthropic;
  // everything else ⇒ openai. Mirrors inferApiStyle() in llm-endpoint.ts.
  try {
    database.exec(
      `UPDATE models SET api_style = CASE
         WHEN provider = 'anthropic' THEN 'anthropic'
         WHEN base_url LIKE '%/anthropic' OR base_url LIKE '%/anthropic/%' THEN 'anthropic'
         ELSE 'openai'
       END
       WHERE api_style IS NULL`,
    );
  } catch {
    // models table missing or already repaired — safe to ignore.
  }

  setSchemaVersion(database, MODELS_API_STYLE_SCHEMA_VERSION);
  return MODELS_API_STYLE_SCHEMA_VERSION;
}
