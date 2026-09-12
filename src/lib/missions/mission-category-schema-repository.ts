// ═══════════════════════════════════════════════════════════════
// missions/mission-category-schema-repository.ts — is the
// mission_categories table there, and how full is it
//
// The two statements behind db.ts's getSchemaHealth(), which reports
// whether a database that claims schema_version >= 2 actually has the
// table that version added.
//
// They take an open database rather than calling getDb(), and that is
// the whole reason this is a separate file from
// mission-category-repository.ts: db.ts is the caller, so a repository
// that reached back for getDb() would put a cycle through the
// connection module every process boots through. With a handle
// parameter this file imports nothing at runtime at all -- the
// better-sqlite3 import is type-only and erases -- which is the same
// shape db-schema.ts already uses for the same reason.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";

/** Whether the `mission_categories` table exists on this database. */
export function missionCategoriesTableExists(database: Database.Database): boolean {
  const tableRow = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mission_categories'",
    )
    .get() as { name: string } | undefined;
  return Boolean(tableRow);
}

/** How many mission categories the table holds. Call only when the table exists. */
export function countMissionCategories(database: Database.Database): number {
  const row = database
    .prepare("SELECT COUNT(*) AS c FROM mission_categories")
    .get() as { c: number };
  return row.c ?? 0;
}
