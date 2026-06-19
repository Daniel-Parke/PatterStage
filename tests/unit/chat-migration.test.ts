/** @jest-environment node */
// Verifies the v13 chat migration against REAL SQLite (the global better-sqlite3
// mock is bypassed via requireActual). Covers: tables + indexes created,
// schema_version bumped to 13, idempotency, and the version-guard early-return.
// The full-chain wiring (runMigrations actually calls the applier) is guarded
// separately in run-migrations-upgrade.integration.test.ts.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyChatMigration, CHAT_SCHEMA_VERSION } from "@/lib/db/apply-chat-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}
function indexNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[]
  ).map((r) => r.name);
}
function withMeta(db: RealDb): RealDb {
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  return db;
}

describe("chat migration (v13, real SQLite)", () => {
  it("creates both tables + indexes and bumps schema_version to 13", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 12);

    applyChatMigration(db, migrationsDir);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["chat_conversations", "chat_messages"]),
    );
    expect(indexNames(db)).toEqual(
      expect.arrayContaining([
        "idx_chat_messages_conversation",
        "idx_chat_messages_run",
        "idx_chat_conversations_updated",
      ]),
    );
    expect(getSchemaVersion(db)).toBe(CHAT_SCHEMA_VERSION);
    expect(CHAT_SCHEMA_VERSION).toBe(13);
    db.close();
  });

  it("cascades message deletes when the parent conversation is removed", () => {
    const db = withMeta(new Database(":memory:"));
    db.pragma("foreign_keys = ON");
    setSchemaVersion(db, 12);
    applyChatMigration(db, migrationsDir);

    db.prepare("INSERT INTO chat_conversations (id, title) VALUES ('c1', 'T')").run();
    db.prepare(
      "INSERT INTO chat_messages (id, conversation_id, role, content) VALUES ('m1','c1','user','hi')",
    ).run();
    db.prepare("DELETE FROM chat_conversations WHERE id = 'c1'").run();

    expect(
      (db.prepare("SELECT COUNT(*) c FROM chat_messages").get() as { c: number }).c,
    ).toBe(0);
    db.close();
  });

  it("is idempotent — a second apply is a no-op and does not throw", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 12);

    applyChatMigration(db, migrationsDir);
    expect(() => applyChatMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(13);
    db.close();
  });

  it("version-guards: a DB already at v13 is left untouched (early return)", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 13);

    const result = applyChatMigration(db, migrationsDir);

    expect(result).toBe(13);
    expect(tableNames(db)).not.toContain("chat_conversations");
    db.close();
  });
});
