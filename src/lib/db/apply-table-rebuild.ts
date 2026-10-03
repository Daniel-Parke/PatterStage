import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

/** Require every copied column before the atomic rebuild; retain incoming FK mode. */
export function applyTableRebuild(
  database: Database.Database,
  migrationsDir: string,
  version: number,
  file: string,
  expectedColumns: Record<string, readonly string[]>,
): number {
  const current = getSchemaVersion(database);
  if (current >= version) return current;
  const sql = readFileSync(join(migrationsDir, file), "utf-8");
  for (const [table, expected] of Object.entries(expectedColumns)) {
    const live = (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
    const missing = expected.filter((column) => !live.includes(column));
    const extra = live.filter((column) => !expected.includes(column));
    if (missing.length || extra.length) {
      throw new Error(`Migration ${version} refuses to rebuild ${table}: columns have drifted. ` +
        `Unexpected: [${extra.join(", ")}]. Missing: [${missing.join(", ")}]. ` +
        `The copy in ${file} must preserve the complete column set.`);
    }
  }
  const foreignKeys = database.pragma("foreign_keys", { simple: true }) as number;
  if (foreignKeys && database.inTransaction) {
    throw new Error(`Migration ${version} cannot disable foreign keys inside an existing transaction`);
  }
  database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      database.exec(sql);
      setSchemaVersion(database, version);
    })();
  } finally {
    database.pragma(`foreign_keys = ${foreignKeys}`);
  }
  return version;
}
