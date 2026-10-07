import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const AUTH_SESSIONS_SCHEMA_VERSION = 43;
const FILE = "043_auth_sessions.sql";

/** A version number alone cannot prove that browser authentication storage exists. */
export function assertAuthSessionsSchema(database: Database.Database): void {
  const columns = database.prepare("PRAGMA table_info(auth_sessions)").all() as Array<{
    name: string; type: string; notnull: number; pk: number;
  }>;
  const actual = new Map(columns.map((column) => [column.name, column]));
  const required: ReadonlyArray<readonly [string, string]> = [
    ["id", "TEXT"],
    ["secret_hash", "BLOB"],
    ["created_at_ms", "INTEGER"],
    ["last_active_at_ms", "INTEGER"],
    ["idle_expires_at_ms", "INTEGER"],
    ["absolute_expires_at_ms", "INTEGER"],
    ["revoked_at_ms", "INTEGER"],
    ["boot_generation", "TEXT"],
    ["token_binding", "BLOB"],
  ];
  if (required.some(([name, type]) => actual.get(name)?.type.toUpperCase() !== type)) {
    throw new Error("auth_sessions schema is missing or incompatible");
  }
  if (actual.get("id")?.pk !== 1 ||
      required.some(([name]) => name !== "id" && name !== "revoked_at_ms" && actual.get(name)?.notnull !== 1)) {
    throw new Error("auth_sessions schema has incompatible constraints");
  }
  const indexes = database.prepare("PRAGMA index_list(auth_sessions)").all() as Array<{ name: string; unique: number }>;
  const hasUniqueHash = indexes.some((index) => index.unique === 1 &&
    (database.prepare(`PRAGMA index_info("${index.name.replaceAll('"', '""')}")`).all() as Array<{ name: string }>).
      map((column) => column.name).join(",") === "secret_hash");
  if (!hasUniqueHash) throw new Error("auth_sessions secret hash is not unique");
}

/** Require v43 SQL, execute it and publish the version in one transaction. */
export function applyAuthSessionsMigration(database: Database.Database, migrationsDir: string): number {
  // Read even at v43: a deployed bundle without this file cannot admit sessions.
  const sql = readFileSync(join(migrationsDir, FILE), "utf-8");
  const current = getSchemaVersion(database);
  if (current >= AUTH_SESSIONS_SCHEMA_VERSION) {
    assertAuthSessionsSchema(database);
    return current;
  }
  database.transaction(() => {
    database.exec(sql);
    assertAuthSessionsSchema(database);
    setSchemaVersion(database, AUTH_SESSIONS_SCHEMA_VERSION);
  })();
  return AUTH_SESSIONS_SCHEMA_VERSION;
}
