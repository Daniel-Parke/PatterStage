// Phase 1.5-A — models.api_style column + idempotent NULL-only repair (v24).
// Verified against REAL SQLite (the global better-sqlite3 mock is bypassed via
// the on-disk lib path), mirroring legacy-column-repair-migration.test.ts.

import { readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyModelsApiStyleMigration } from "@/lib/db/apply-models-api-style-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

/** Fresh baseline DB (models table without api_style), marked pre-v24. */
function baselineDb(): RealDb {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
  setSchemaVersion(db, 23);
  return db;
}

function insertModel(db: RealDb, id: string, provider: string, baseUrl: string | null): void {
  db.prepare(
    "INSERT INTO models (id, name, provider, model_id, base_url) VALUES (?, ?, ?, ?, ?)",
  ).run(id, id, provider, id, baseUrl);
}

function styleOf(db: RealDb, id: string): string | null {
  return (db.prepare("SELECT api_style FROM models WHERE id = ?").get(id) as { api_style: string | null })
    .api_style;
}

describe("applyModelsApiStyleMigration", () => {
  it("adds api_style and infers it for existing rows", () => {
    const db = baselineDb();
    insertModel(db, "minimax", "minimax", "https://api.minimax.io/anthropic");
    insertModel(db, "openai", "openai", "https://api.openai.com/v1");
    insertModel(db, "claude", "anthropic", "https://api.anthropic.com");
    expect(cols(db, "models")).not.toContain("api_style");

    const result = applyModelsApiStyleMigration(db, migrationsDir);

    expect(result).toBe(24);
    expect(getSchemaVersion(db)).toBe(24);
    expect(cols(db, "models")).toContain("api_style");
    // MiniMax's /anthropic base ⇒ anthropic protocol (the bug fix).
    expect(styleOf(db, "minimax")).toBe("anthropic");
    expect(styleOf(db, "openai")).toBe("openai");
    expect(styleOf(db, "claude")).toBe("anthropic");
    db.close();
  });

  it("is idempotent and preserves a user-set value on re-run", () => {
    const db = baselineDb();
    insertModel(db, "openai", "openai", "https://api.openai.com/v1");
    applyModelsApiStyleMigration(db, migrationsDir);

    // User overrides the inferred style.
    db.prepare("UPDATE models SET api_style = 'anthropic' WHERE id = 'openai'").run();
    setSchemaVersion(db, 23); // force the guard to re-enter

    applyModelsApiStyleMigration(db, migrationsDir);

    // Repair only touches NULL rows — the override survives.
    expect(styleOf(db, "openai")).toBe("anthropic");
    expect(getSchemaVersion(db)).toBe(24);
    db.close();
  });

  it("returns early without re-running once at version 24", () => {
    const db = baselineDb();
    setSchemaVersion(db, 24);
    expect(applyModelsApiStyleMigration(db, migrationsDir)).toBe(24);
    db.close();
  });
});
