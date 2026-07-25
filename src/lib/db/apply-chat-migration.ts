// ═══════════════════════════════════════════════════════════════
// apply-chat-migration.ts
//
// Creates the agent-chat tables (see 013_chat.sql): chat_conversations +
// chat_messages. Idempotent (CREATE ... IF NOT EXISTS), wired in
// runMigrations at schema_version 13 so it lands on fresh installs and
// already-migrated dev DBs alike. See [[db-migration-applier-footgun]] —
// a .sql file is inert without a version-guarded applier wired into
// runMigrations().
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

export const CHAT_SCHEMA_VERSION = 13;

export function applyChatMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= CHAT_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "013_chat.sql"));

  setSchemaVersion(database, CHAT_SCHEMA_VERSION);
  return CHAT_SCHEMA_VERSION;
}
